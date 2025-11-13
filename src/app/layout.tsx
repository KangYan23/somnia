// src/app/layout.tsx
import type { Metadata } from 'next';
import '../styles/global.css';

export const metadata: Metadata = {
  title: 'SOMI Transfer Bot',
  description: 'AI-Powered SOMI token transfer bot with blockchain event streams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

