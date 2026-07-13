import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HealthAI Portal',
  description: 'AI symptom consultation and doctor recommendation portal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
