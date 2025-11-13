// src/types/events.ts

export type EventType = 'TransferIntentCreated' | 'TransferConfirmed';

export interface ExpectedEventData {
  fromPhoneHash: `0x${string}`;
  toPhoneHash: `0x${string}`;
  fromPhone: string;
  toPhone: string;
  amount: string; // BigInt as string
  token: string;
  txHash?: `0x${string}`; // Only for TransferConfirmed
}

export interface ReceivedEventData {
  fromPhone: string;
  toPhone: string;
  amount: bigint;
  token: string;
  txHash?: `0x${string}`;
}

export interface VerificationResult {
  verified: boolean;
  reason?: 'timeout' | 'mismatch' | 'connection_failed' | 'error';
  receivedEvent?: ReceivedEventData;
  matchDetails?: {
    phoneHashesMatch: boolean;
    amountMatch: boolean;
    tokenMatch: boolean;
    txHashMatch?: boolean;
  };
  error?: string;
}

export interface VerificationRequest {
  eventType: EventType;
  expected: ExpectedEventData;
  timeout?: number; // milliseconds, default 20000
}

