'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Skip tracking for analytics pages
    if (pathname?.includes('/analytics')) {
      return;
    }



  }, [pathname]);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
} 