import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAdmin } from '@/app/api/auth/authUtils';
import { RequestStatus, ItemStatus, ActivityType } from '@prisma/client';
import { logRentalActivity } from '@/lib/activity-logger';
import { handleRentalStatusChange } from '@/lib/reminder-service';

// GET - Get rental by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAdmin(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Properly await params in Next.js 15
    const { id: rentalId } = await params;

    // Get rental with related data
    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: {
        item: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        statusLogs: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    return NextResponse.json(rental);
  } catch (error) {
    console.error('Error fetching rental:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rental' },
      { status: 500 }
    );
  }
}

// PATCH - Update specific rental
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAdmin(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminId = user.userId;  // Use userId instead of id
    // Properly await params in Next.js 15
    const { id: rentalId } = await params;
    const { status, notes, poNumber, doNumber, startDate, endDate } = await req.json();

    // Find rental
    const currentRental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: {
        item: true,
        user: true
      }
    });

    if (!currentRental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    // Note: Admins can approve any rental, including their own
    console.log(`Admin ${adminId} updating rental ${rentalId} status to ${status}`);

    // Prepare update data
    const updateData: any = {};

    // Only include fields that are provided
    if (status) updateData.status = status;
    if (poNumber !== undefined) updateData.poNumber = poNumber;
    if (doNumber !== undefined) updateData.doNumber = doNumber;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = endDate ? new Date(endDate) : null;
    
    // If completing a rental, set the returnDate if not already set
    if (status === RequestStatus.COMPLETED && !currentRental.returnDate) {
      updateData.returnDate = new Date();
    }

    // Start a transaction
    const updatedRental = await prisma.$transaction(async (tx) => {
      // Update the rental
      const updated = await tx.rental.update({
        where: { id: rentalId },
        data: updateData,
        include: {
          item: true,
          user: true
        }
      });

      // Create status log if status changed
      if (status) {
        await tx.rentalStatusLog.create({
          data: {
            rentalId,
            status: status as RequestStatus,
            userId: adminId,
            notes: notes || `Status updated to ${status} by admin`
          }
        });

        // Update item status based on rental status
        let newItemStatus: ItemStatus | undefined;
        
        if (status === RequestStatus.APPROVED) {
          newItemStatus = ItemStatus.RENTED;
        } else if (status === RequestStatus.COMPLETED) {
          newItemStatus = ItemStatus.AVAILABLE;
        } else if (status === RequestStatus.REJECTED || status === RequestStatus.CANCELLED) {
          newItemStatus = ItemStatus.AVAILABLE;
        }

        // Update the item status if needed
        if (newItemStatus) {
          await tx.item.update({
            where: { serialNumber: currentRental.itemSerial },
            data: { status: newItemStatus }
          });
        }

        // Create activity log
        await tx.activityLog.create({
          data: {
            type: ActivityType.RENTAL_UPDATED,
            action: `Updated rental status to ${status}`,
            userId: adminId,
            itemSerial: currentRental.itemSerial,
            rentalId,
            affectedUserId: currentRental.userId
          }
        });
      } else {
        // If only details were updated (not status)
        await tx.activityLog.create({
          data: {
            type: ActivityType.RENTAL_UPDATED,
            action: `Updated rental details for ${currentRental.item.name}`,
            userId: adminId,
            itemSerial: currentRental.itemSerial,
            rentalId,
            affectedUserId: currentRental.userId
          }
        });
      }

      return updated;
    });

    // Create activity log
    await logRentalActivity(
      adminId,
      ActivityType.RENTAL_UPDATED,
      rentalId,
      currentRental.itemSerial,
      `Admin ${user.name || 'Unknown'} updated rental status to ${status}`
    );
    
    // Create rental reminder if status is APPROVED
    if (status === RequestStatus.APPROVED) {
      try {
        await handleRentalStatusChange(rentalId, 'APPROVED');
      } catch (error) {
        console.error('Error creating rental reminder:', error);
        // Don't fail the request if reminder creation fails
      }
    }

    return NextResponse.json(updatedRental);
  } catch (error) {
    console.error('Error updating rental:', error);
    return NextResponse.json(
      { error: 'Failed to update rental' },
      { status: 500 }
    );
  }
}

// DELETE - Delete rental (soft delete or cancel)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAdmin(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminId = user.userId;
    // Properly await params in Next.js 15
    const { id: rentalId } = await params;

    // Find rental
    const rental = await prisma.rental.findUnique({
      where: { id: rentalId },
      include: {
        item: true
      }
    });

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    // Cancel the rental instead of deleting
    const updatedRental = await prisma.$transaction(async (tx) => {
      // Update rental status to cancelled
      const updated = await tx.rental.update({
        where: { id: rentalId },
        data: {
          status: RequestStatus.CANCELLED
        },
        include: {
          item: true,
          user: true
        }
      });

      // Create status log
      await tx.rentalStatusLog.create({
        data: {
          rentalId,
          status: RequestStatus.CANCELLED,
          userId: adminId,
          notes: 'Rental cancelled by admin'
        }
      });

      // Update item status to AVAILABLE if it was RENTED
      if (rental.item.status === ItemStatus.RENTED) {
        await tx.item.update({
          where: { serialNumber: rental.itemSerial },
          data: { status: ItemStatus.AVAILABLE }
        });
      }

      // Create activity log
      await tx.activityLog.create({
        data: {
          type: ActivityType.RENTAL_UPDATED,
          action: `Cancelled rental for ${rental.item.name}`,
          userId: adminId,
          itemSerial: rental.itemSerial,
          rentalId,
          affectedUserId: rental.userId
        }
      });

      return updated;
    });

    return NextResponse.json(updatedRental);
  } catch (error) {
    console.error('Error cancelling rental:', error);
    return NextResponse.json(
      { error: 'Failed to cancel rental' },
      { status: 500 }
    );
  }
} 