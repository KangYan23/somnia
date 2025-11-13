// src/lib/somnia.ts
import 'dotenv/config';
import { SDK } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, webSocket } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';

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

// HTTP Clients
export const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(RPC_URL) });
export const walletClient = createWalletClient({ chain: somniaTestnet, account, transport: http(RPC_URL) });

// SDK for emitting events / transactions
export const sdk = new SDK({ public: publicClient, wallet: walletClient });

// Derive WS URL if missing
if (!RPC_WS_URL) {
  if (RPC_URL.startsWith('https://')) RPC_WS_URL = RPC_URL.replace('https://', 'wss://');
  else if (RPC_URL.startsWith('http://')) RPC_WS_URL = RPC_URL.replace('http://', 'ws://');
  else RPC_WS_URL = 'wss://dream-rpc.somnia.network/ws';
  console.log(`[Somnia SDK] Derived RPC_WS_URL: ${RPC_WS_URL}`);
}

// WebSocket Client (single reusable client)
export const publicWsClient = createPublicClient({ chain: somniaTestnet, transport: webSocket(RPC_WS_URL) });

// SDK for subscriptions (single reusable wsSdk)
export const wsSdk = new SDK({ public: publicWsClient });

// Export account and env variables for debugging
export { account, RPC_URL, RPC_WS_URL };
