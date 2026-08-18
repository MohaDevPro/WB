import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  description: 'WB foundation application',
  title: 'WB',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html dir="rtl" lang="ar">
      <body>{children}</body>
    </html>
  );
}
