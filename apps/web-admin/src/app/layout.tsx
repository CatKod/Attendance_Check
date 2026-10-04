import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'APES Lab - Hệ thống điểm danh',
    template: '%s · APES Lab',
  },
  description:
    'Hệ thống quản lý điểm danh phòng thí nghiệm APES — thành viên, nhóm, Wi-Fi, lịch Lab.',
  applicationName: 'APES Attendance',
  authors: [{ name: 'APES Lab' }],
  icons: {
    icon: '/apes-logo-256.png',
    apple: '/apes-logo-256.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#F04030',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}