// src/lib/somnia.ts
import 'dotenv/config';
import { SDK } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, webSocket } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';
import { buildSomniaChainWithWs } from './somniaChain';

const RPC_URL = process.env.RPC_URL;
let RPC_WS_URL = process.env.RPC_WS_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!RPC_URL) throw new Error('RPC_URL is required in .env');
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required in .env');

// Normalize private key
const pkClean = PRIVATE_KEY.trim().startsWith('0x') ? PRIVATE_KEY.trim() : `0x${PRIVATE_KEY.trim()}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(pkClean)) {
  throw new Error(`Invalid PRIVATE_KEY: ${PRIVATE_KEY}`);
}

const account = privateKeyToAccount(pkClean as `0x${string}`);

const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(RPC_URL) });
const walletClient = createWalletClient({ chain: somniaTestnet, account, transport: http(RPC_URL) });

export const sdk = new SDK({
  public: publicClient as any,
  wallet: walletClient as any
});
export { walletClient, account, publicClient };

// If you want WebSocket subscription later, init a public websocket client similarly (for bot)
export function createPublicWsClient(wsUrl: string) {
  const somniaChainWithWs = buildSomniaChainWithWs(wsUrl);
  return createPublicClient({ chain: somniaChainWithWs, transport: webSocket(wsUrl) });
}
