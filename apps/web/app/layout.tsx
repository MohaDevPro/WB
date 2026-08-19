import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

import { AuthProvider } from './auth-provider';

export const metadata: Metadata = {
  description:
    'WB is an Arabic-first professional platform for learning, trusted connection, and meaningful opportunities.',
  title: 'WB | مساحة مهنية حيّة',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html dir="rtl" lang="ar">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
