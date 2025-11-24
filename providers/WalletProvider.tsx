'use client';

import "@rainbow-me/rainbowkit/styles.css";
import { 
  createConfig, 
  http,
  WagmiProvider 
} from "wagmi";
import {
  RainbowKitProvider,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { somniaTestnet } from "viem/chains";
import {
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';

const queryClient = new QueryClient();

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        metaMaskWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: 'Somnia Example App',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "default-project-id",
  }
);

const config = createConfig({
  connectors,
  chains: [somniaTestnet],
  transports: {
    [somniaTestnet.id]: http(),
  },
  ssr: true,
});

export const WalletProvider = ({ children }: { children: React.ReactNode }) => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
