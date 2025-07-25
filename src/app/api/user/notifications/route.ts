import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { 
  getUserNotifications, 
  markAllNotificationsAsRead,
  deleteAllReadNotifications,
  getUnreadNotificationCount,
  getOverdueNotifications
} from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    console.log('User notifications API called');
    
    // Coba dapatkan user dari request terlebih dahulu
    const user = await getUserFromRequest(request);
    
    // Jika tidak ada user, coba dapatkan dari next-auth session
    if (!user) {
      console.log('No user from request, trying server session');
      const session = await getServerSession();
      
      if (session?.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email }
        });
        
        if (dbUser) {
          console.log(`User found via session: ${dbUser.id}`);
          // Lanjutkan dengan user dari session
          const { searchParams } = new URL(request.url);
          const countOnly = searchParams.get('countOnly') === 'true';
          const overdueOnly = searchParams.get('overdueOnly') === 'true';
          const type = searchParams.get('type') as 'SCHEDULE' | 'CALIBRATION' | 'RENTAL' | 'MAINTENANCE' | 'ALL' || 'ALL';
          const page = parseInt(searchParams.get('page') || '1');
          
          // Add anti-cache headers to all responses
          const headers = {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          };
          
          if (countOnly) {
            try {
              const count = await getUnreadNotificationCount(dbUser.id);
              return NextResponse.json({ count }, { headers });
            } catch (error) {
              console.error('Error getting unread notification count:', error);
              return NextResponse.json({ error: 'Failed to get unread count', count: 0 }, { status: 500, headers });
            }
          }
          
          if (overdueOnly) {
            try {
              const notifications = await getOverdueNotifications(dbUser.id);
              return NextResponse.json({ notifications }, { headers });
            } catch (error) {
              console.error('Error fetching overdue notifications:', error);
              return NextResponse.json({ error: 'Failed to fetch overdue notifications', notifications: [] }, { status: 500, headers });
            }
          }
          
          try {
            const data = await getUserNotifications(dbUser.id, { page, type });
            return NextResponse.json(data, { headers });
          } catch (error) {
            console.error('Error fetching notifications:', error);
            return NextResponse.json({ error: 'Failed to fetch notifications', notifications: [], total: 0, page: 1, totalPages: 0 }, { status: 500, headers });
          }
        }
      }
      
      // Jika masih tidak ada user, kembalikan unauthorized
      console.log('No user found in session, returning unauthorized');
      return NextResponse.json({ 
        error: 'Unauthorized - Silakan login kembali', 
        notifications: [] 
      }, { status: 401 });
    }
    
    // Kode asli dengan user dari getUserFromRequest
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('countOnly') === 'true';
    const overdueOnly = searchParams.get('overdueOnly') === 'true';
    const type = searchParams.get('type') as 'SCHEDULE' | 'CALIBRATION' | 'RENTAL' | 'MAINTENANCE' | 'ALL' || 'ALL';
    const page = parseInt(searchParams.get('page') || '1');
    
    // Add anti-cache headers to all responses
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    if (countOnly) {
      try {
        const count = await getUnreadNotificationCount(user.id);
        // console.log(`Unread notification count for user ${user.id}: ${count}`);
        
        return NextResponse.json({ count }, { headers });
      } catch (error) {
        console.error('Error getting unread notification count:', error);
        return NextResponse.json({ error: 'Failed to get unread count', count: 0 }, { status: 500, headers });
      }
    }
    
    if (overdueOnly) {
      try {
        const notifications = await getOverdueNotifications(user.id);
        // console.log(`Found ${notifications.length} overdue notifications for user ${user.id}`);
        
        return NextResponse.json({ notifications }, { headers });
      } catch (error) {
        console.error('Error fetching overdue notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch overdue notifications', notifications: [] }, { status: 500, headers });
      }
    }
    
    try {
      const data = await getUserNotifications(user.id, { page, type });
      // console.log(`Found ${data.notifications.length} notifications for user ${user.id}`);
      
      return NextResponse.json(data, { headers });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications', notifications: [], total: 0, page: 1, totalPages: 0 }, { status: 500, headers });
    }
  } catch (error) {
    console.error('Error in notifications API:', error);
    return NextResponse.json({ error: 'Internal server error', notifications: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Coba dapatkan user dari request terlebih dahulu
    const user = await getUserFromRequest(request);
    
    // Jika tidak ada user, coba dapatkan dari next-auth session
    if (!user) {
      console.log('No user from request, trying server session for POST');
      const session = await getServerSession();
      
      if (session?.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email }
        });
        
        if (dbUser) {
          console.log(`User found via session for POST: ${dbUser.id}`);
          
          const body = await request.json();
          const { action } = body;
          
          if (action === 'markAllRead') {
            try {
              await markAllNotificationsAsRead(dbUser.id);
              const response = NextResponse.json({ success: true, message: 'All notifications marked as read' });
              response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
              return response;
            } catch (error) {
              console.error('Error marking all notifications as read:', error);
              return NextResponse.json({ error: 'Failed to mark all notifications as read' }, { status: 500 });
            }
          }
          
          if (action === 'deleteAllRead') {
            try {
              await deleteAllReadNotifications(dbUser.id);
              const response = NextResponse.json({ success: true, message: 'All read notifications deleted' });
              response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
              return response;
            } catch (error) {
              console.error('Error deleting all read notifications:', error);
              return NextResponse.json({ error: 'Failed to delete all read notifications' }, { status: 500 });
            }
          }
          
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
      }
      
      return NextResponse.json({ error: 'Unauthorized - Silakan login kembali' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action } = body;
    
    if (action === 'markAllRead') {
      try {
        await markAllNotificationsAsRead(user.id);
        const response = NextResponse.json({ success: true, message: 'All notifications marked as read' });
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return response;
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return NextResponse.json({ error: 'Failed to mark all notifications as read' }, { status: 500 });
      }
    }
    
    if (action === 'deleteAllRead') {
      try {
        await deleteAllReadNotifications(user.id);
        const response = NextResponse.json({ success: true, message: 'All read notifications deleted' });
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return response;
      } catch (error) {
        console.error('Error deleting all read notifications:', error);
        return NextResponse.json({ error: 'Failed to delete all read notifications' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in notifications POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 