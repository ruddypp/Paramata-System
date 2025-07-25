import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Providers } from "./providers";
import ToastContainer from "@/components/ui/ToastContainer";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import ClientReminderWrapper from './ClientReminderWrapper';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paramata Inventory Management System",
  description: "Paramata Inventory Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers session={session}>
          {children}
          <ToastContainer />
          <ClientReminderWrapper />
        </Providers>
        
        {/* Script to set up required statuses */}
        <Script id="setup-statuses">
          {`
            // Set up required statuses once when the app loads
            (async function setupStatuses() {
              try {
                await fetch('/api/admin/setup-statuses');
                console.log('Status setup check completed');
              } catch (e) {
                console.error('Status setup error:', e);
              }
            })();
          `}
        </Script>
        
        {/* Script to ensure uploads directory exists */}
        <Script id="setup-assets">
          {`
            // Ensure uploads directory exists via API call
            (async function setupAssets() {
              try {
                await fetch('/api/admin/setup-assets');
                console.log('Asset setup completed');
              } catch (e) {
                console.error('Asset setup error:', e);
              }
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
