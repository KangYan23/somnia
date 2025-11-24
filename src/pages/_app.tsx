// src/pages/_app.tsx
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { WalletProvider } from '../../providers/WalletProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <Component {...pageProps} />
    </WalletProvider>
  );
}
