import { Chain } from 'viem';
import { somniaTestnet } from 'viem/chains';

/**
 * Returns a Somnia chain object that includes the provided WebSocket URL.
 * The Somnia definition in viem lacks a default WS endpoint, so we clone the
 * chain and inject the runtime URL to satisfy viem.webSocket() callers.
 */
export function buildSomniaChainWithWs(wsUrl: string): Chain {
  const webSocketUrls = [wsUrl];
  const defaultRpc = somniaTestnet.rpcUrls.default;
  const publicRpc = (somniaTestnet.rpcUrls as any).public ?? defaultRpc;
  return {
    ...somniaTestnet,
    rpcUrls: {
      ...somniaTestnet.rpcUrls,
      default: {
        ...defaultRpc,
        webSocket: webSocketUrls,
      },
      public: {
        ...publicRpc,
        webSocket: webSocketUrls,
      },
    },
  };
}
