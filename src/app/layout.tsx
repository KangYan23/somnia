// src/app/layout.tsx
import type { Metadata } from 'next';
import '../styles/globals.css';
import { WalletProvider } from '../../providers/WalletProvider';

export const metadata: Metadata = {
  title: 'Somnia DApp',
  description: 'AI-Powered SOMI token transfer bot with blockchain event streams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}