"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { ArrowLeftIcon, FileTextIcon, ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import MaintenanceForm from "@/components/maintenance/MaintenanceForm";
import DashboardLayout from "@/components/DashboardLayout";
import { RequestStatus } from "@prisma/client";

interface ServiceReportPart {
  id: string;
  itemNumber: number;
  description: string;
  snPnOld: string;
  snPnNew: string;
}

interface ServiceReport {
  id: string;
  reportNumber: string;
  customer: string;
  location: string;
  brand: string;
  model: string;
  dateIn: string;
  reasonForReturn: string;
  findings: string;
  action: string;
  sensorCO: boolean;
  sensorH2S: boolean;
  sensorO2: boolean;
  sensorLEL: boolean;
  lampClean: boolean;
  lampReplace: boolean;
  pumpTested: boolean;
  pumpRebuilt: boolean;
  pumpReplaced: boolean;
  pumpClean: boolean;
  instrumentCalibrate: boolean;
  instrumentUpgrade: boolean;
  instrumentCharge: boolean;
  instrumentClean: boolean;
  instrumentSensorAssembly: boolean;
  parts: ServiceReportPart[];
}

interface TechnicalReportPart {
  id: string;
  itemNumber: number;
  namaUnit: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
}

interface TechnicalReport {
  id: string;
  csrNumber: string;
  deliveryTo: string;
  quoNumber: string;
  dateReport: string;
  techSupport: string;
  dateIn: string;
  estimateWork: string;
  reasonForReturn: string;
  findings: string;
  action: string;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  termsConditions?: string;
  partsList: TechnicalReportPart[];
}

interface MaintenanceData {
  id: string;
  itemSerial: string;
  status: RequestStatus;
  startDate: string;
  endDate: string | null;
  item: {
    serialNumber: string;
    name: string;
    partNumber: string;
    description: string;
  };
  serviceReport: ServiceReport | null;
  technicalReport: TechnicalReport | null;
  statusLogs: Array<{
    id: string;
    status: string;
    notes: string | null;
    createdAt: string;
    changedBy: {
      name: string;
    };
  }>;
}

export default function MaintenanceDetailPage() {
  const [maintenance, setMaintenance] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  
  const maintenanceId = params.id;

  useEffect(() => {
    if (maintenanceId) {
      fetchMaintenanceDetails();
    }
  }, [maintenanceId]);

  const fetchMaintenanceDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/maintenance/${maintenanceId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mengambil detail maintenance");
      }

      setMaintenance(data);
    } catch (error) {
      console.error("Error fetching maintenance details:", error);
      toast.error("Gagal mengambil detail maintenance");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!maintenance) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-100 p-6 text-center">
            <h3 className="text-lg font-medium text-gray-900">
              Maintenance tidak ditemukan
            </h3>
            <p className="mt-2 text-gray-500">
              Data maintenance yang Anda cari tidak ditemukan atau Anda tidak memiliki akses.
            </p>
            <Link
              href="/user/maintenance"
              className="mt-4 inline-flex items-center text-green-600 hover:text-green-800"
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Kembali ke daftar maintenance
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isPending = maintenance.status === "PENDING";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Link
            href="/user/maintenance"
            className="inline-flex items-center text-green-600 hover:text-green-800"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Kembali ke daftar maintenance
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <h1 className="text-2xl font-bold mb-4">Detail Maintenance</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-600">Barang</p>
              <p className="font-semibold">{maintenance.item.name}</p>
            </div>
            <div>
              <p className="text-gray-600">Serial Number</p>
              <p className="font-semibold">{maintenance.itemSerial}</p>
            </div>
            <div>
              <p className="text-gray-600">Tanggal Mulai</p>
              <p className="font-semibold">{formatDate(maintenance.startDate)}</p>
            </div>
            <div>
              <p className="text-gray-600">Tanggal Selesai</p>
              <p className="font-semibold">
                {maintenance.endDate ? formatDate(maintenance.endDate) : "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Part Number</p>
              <p className="font-semibold">{maintenance.item.partNumber}</p>
            </div>
            <div>
              <p className="text-gray-600">Status</p>
              <p className="font-semibold">
                {maintenance.status === "PENDING"
                  ? "Dalam Proses"
                  : maintenance.status === "COMPLETED"
                  ? "Selesai"
                  : maintenance.status}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-gray-600">Deskripsi Barang</p>
            <p className="font-semibold">{maintenance.item.description || "-"}</p>
          </div>
        </div>

        {/* Riwayat Status */}
        {maintenance.statusLogs && maintenance.statusLogs.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-4">Riwayat Status</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diubah Oleh
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Catatan
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {maintenance.statusLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            log.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : log.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : log.status === "CANCELLED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {log.status === "PENDING"
                            ? "Dalam Proses"
                            : log.status === "COMPLETED"
                            ? "Selesai"
                            : log.status === "CANCELLED"
                            ? "Dibatalkan"
                            : log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.changedBy?.name || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isPending ? (
          <MaintenanceForm maintenance={maintenance} onSuccess={() => router.push("/user/maintenance")} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-4">Laporan Maintenance</h2>

            {maintenance.serviceReport && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <FileTextIcon className="mr-2 h-5 w-5 text-green-600" />
                  Customer Service Report
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-md">
                  <div>
                    <p className="text-gray-600">Alasan Maintenance</p>
                    <p className="font-medium">{maintenance.serviceReport.reasonForReturn || "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Temuan</p>
                    <p className="font-medium">{maintenance.serviceReport.findings || "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Tindakan</p>
                    <p className="font-medium">{maintenance.serviceReport.action || "-"}</p>
                  </div>
                </div>
                <a
                  href={`/api/user/maintenance/${maintenance.id}/report?type=csr`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-green-600 hover:text-green-800"
                >
                  <span className="mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </span>
                  Download Customer Service Report
                </a>
              </div>
            )}

            {maintenance.technicalReport && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <ClipboardListIcon className="mr-2 h-5 w-5 text-green-600" />
                  Technical Report
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-md">
                  <div>
                    <p className="text-gray-600">Nomor CSR</p>
                    <p className="font-medium">{maintenance.technicalReport.csrNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Alasan Maintenance</p>
                    <p className="font-medium">{maintenance.technicalReport.reasonForReturn || "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Temuan</p>
                    <p className="font-medium">{maintenance.technicalReport.findings || "-"}</p>
                  </div>
                </div>
                <a
                  href={`/api/user/maintenance/${maintenance.id}/report?type=technical`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-green-600 hover:text-green-800"
                >
                  <span className="mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </span>
                  Download Technical Report
                </a>
              </div>
            )}

            {!maintenance.serviceReport && !maintenance.technicalReport && (
              <p className="text-gray-500 italic">Tidak ada laporan tersedia.</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 