// src/lib/somnia.ts
// Load environment variables from .env when present so scripts run with ts-node
// without requiring manual env export in the shell.
import 'dotenv/config';
import { SDK } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, webSocket } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';

const rpcUrl = process.env.RPC_URL;
const rawPrivateKey = process.env.PRIVATE_KEY;

function mask(s?: string) {
  if (!s) return '<missing>';
  const show = 6;
  return s.length <= show * 2 ? s : `${s.slice(0, show)}...${s.slice(-4)}`;
}

if (!rpcUrl || !rawPrivateKey) {
  throw new Error(`RPC_URL and PRIVATE_KEY required in env. Got RPC_URL=${rpcUrl ? 'present' : 'missing'}, PRIVATE_KEY=${rawPrivateKey ? 'present' : 'missing'}`);
}

// Normalize the private key: accept with or without 0x, strip whitespace
const pkClean = rawPrivateKey.trim().startsWith('0x') ? rawPrivateKey.trim().slice(2) : rawPrivateKey.trim();
if (!/^[0-9a-fA-F]{64}$/.test(pkClean)) {
  throw new Error(`Invalid PRIVATE_KEY in env: expected 32-byte hex (64 hex chars). Received: ${mask(rawPrivateKey)} (hex chars: ${pkClean.length})`);
}
const privateKey = (`0x${pkClean}`) as `0x${string}`;

export const account = privateKeyToAccount(privateKey);

const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) });
export const walletClient = createWalletClient({ chain: somniaTestnet, account, transport: http(rpcUrl) });

export const sdk = new SDK({
  public: createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) }),
  wallet: createWalletClient({ chain: somniaTestnet, account, transport: http(rpcUrl) })
});

// If you want WebSocket subscription later, init a public websocket client similarly (for bot)
export function createPublicWsClient(wsUrl: string) {
  return createPublicClient({ chain: somniaTestnet, transport: webSocket(wsUrl) });
}