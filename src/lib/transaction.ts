// src/lib/transaction.ts
/**
 * Transaction utilities and type definitions
 * 
 * Shared utilities for transaction operations across the application.
 * Used by transfer service, transaction history, and notifications.
 */

import { formatEther, formatUnits } from 'viem';
import { AbiCoder } from 'ethers';

export interface TransferRecord {
  fromPhoneHash: `0x${string}`;
  toPhoneHash: `0x${string}`;
  fromPhone: string;
  toPhone: string;
  amount: bigint;
  token: string;
  txHash: `0x${string}`;
  timestamp: bigint;
}

export interface UserRegistration {
  phoneHash: `0x${string}`;
  walletAddress: string;
  phone: string;
  timestamp: bigint;
}

/**
 * Event signatures for transaction events
 */
export const TRANSFER_EVENT_SIGNATURES = {
  TransferIntentCreated: 'TransferIntentCreated(bytes32,bytes32,string,string,uint256,string)',
  TransferConfirmed: 'TransferConfirmed(bytes32,bytes32,string,string,uint256,string,bytes32)'
} as const;

/**
 * Decode userRegistration record from various formats
 * Handles: raw hex string, decoded array, or object with data property
 * 
 * @param record - Registration record in any format
 * @returns Decoded registration data or null if decoding fails
 */
export function decodeUserRegistration(record: any): UserRegistration | null {
  const abiCoder = new AbiCoder();
  let decoded: any;
  
  try {
    if (typeof record === 'string') {
      // Raw hex format
      decoded = abiCoder.decode(['bytes32', 'address', 'string', 'uint64'], record);
    } else if (Array.isArray(record)) {
      // Already decoded format
      decoded = record.map((item: any) => item?.value?.value || item?.value || item);
    } else if (record && typeof record === 'object' && 'data' in record) {
      // Data wrapper format
      decoded = abiCoder.decode(['bytes32', 'address', 'string', 'uint64'], (record as any).data);
    } else {
      return null;
    }
    
    return {
      phoneHash: decoded[0] as `0x${string}`,
      walletAddress: decoded[1] as string,
      phone: decoded[2] as string,
      timestamp: decoded[3] as bigint
    };
  } catch (error) {
    return null;
  }
}

/**
 * Decode transferHistory record from various formats
 * Handles: raw hex string, decoded array, or object with data property
 * 
 * @param record - Transfer record in any format
 * @returns Decoded transfer record or null if decoding fails
 */
export function decodeTransferRecord(record: any): TransferRecord | null {
  const abiCoder = new AbiCoder();
  let decoded: any;
  
  try {
    if (typeof record === 'string') {
      decoded = abiCoder.decode(
        ['bytes32', 'bytes32', 'string', 'string', 'uint256', 'string', 'bytes32', 'uint64'],
        record
      );
    } else if (Array.isArray(record)) {
      decoded = record.map((item: any) => item?.value?.value || item?.value || item);
    } else if (record && typeof record === 'object' && 'data' in record) {
      decoded = abiCoder.decode(
        ['bytes32', 'bytes32', 'string', 'string', 'uint256', 'string', 'bytes32', 'uint64'],
        (record as any).data
      );
    } else {
      return null;
    }
    
    return {
      fromPhoneHash: decoded[0] as `0x${string}`,
      toPhoneHash: decoded[1] as `0x${string}`,
      fromPhone: decoded[2] as string,
      toPhone: decoded[3] as string,
      amount: decoded[4] as bigint,
      token: decoded[5] as string,
      txHash: decoded[6] as `0x${string}`,
      timestamp: decoded[7] as bigint
    };
  } catch (error) {
    return null;
  }
}

/**
 * Format amount from Wei to readable string
 * Handles both native tokens (SOMI, STT, ETH) and ERC-20 tokens
 * 
 * @param amountWei - Amount in Wei (bigint)
 * @param token - Token symbol (e.g., "STT", "SOMI", "ETH")
 * @returns Formatted amount string
 */
export function formatAmount(amountWei: bigint, token: string): string {
  try {
    const amount = formatEther(amountWei);
    const num = parseFloat(amount);
    
    // Format based on amount size
    if (num < 0.0001) {
      return `${amount} ${token}`;
    } else if (num < 1) {
      return `${num.toFixed(4)} ${token}`;
    } else {
      return `${num.toFixed(2)} ${token}`;
    }
  } catch (error) {
    // Fallback: try formatUnits with 18 decimals
    try {
      const formatted = formatUnits(amountWei, 18);
      const num = parseFloat(formatted);
      if (num < 0.0001) {
        return `${formatted} ${token}`;
      } else if (num < 1) {
        return `${num.toFixed(4)} ${token}`;
      } else {
        return `${num.toFixed(2)} ${token}`;
      }
    } catch {
      return `${amountWei.toString()} ${token}`;
    }
  }
}

