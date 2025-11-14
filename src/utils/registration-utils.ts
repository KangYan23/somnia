// src/utils/registration-utils.ts
import { normalizePhone, hashPhone } from '../lib/phone';
import { AbiCoder } from 'ethers';

// Unified phone registration utilities
export interface RegistrationData {
  phoneHash: string;
  walletAddress: string;
  metainfo: string;
  registeredAt: number;
  registeredAtISO?: string;
  publisher?: string;
  source?: string;
}

// ABI encoder for user registration schema
export function abiEncodeUserRegistration(phoneHash: string, wallet: string, metainfo: string, ts: number): string {
  const abiCoder = new AbiCoder();
  return abiCoder.encode(['bytes32','address','string','uint64'], [phoneHash, wallet, metainfo, BigInt(ts)]);
}

// Unified ABI decoder for user registration data
export function abiDecodeUserRegistration(data: string): RegistrationData {
  const abiCoder = new AbiCoder();
  const decoded = abiCoder.decode(['bytes32', 'address', 'string', 'uint64'], data);
  
  return {
    phoneHash: decoded[0] as string,
    walletAddress: decoded[1] as string,
    metainfo: decoded[2] as string,
    registeredAt: Number(decoded[3]),
    registeredAtISO: new Date(Number(decoded[3])).toISOString()
  };
}

// Process SDK results into standardized format
export function processRegistrationResult(item: any, publisher: string, source: string = 'data_stream'): RegistrationData | null {
  try {
    let registration: RegistrationData | null = null;

    if (Array.isArray(item)) {
      // Decoded format: array of field objects
      registration = {
        phoneHash: item[0]?.value?.value || item[0]?.value || item[0],
        walletAddress: item[1]?.value?.value || item[1]?.value || item[1],
        metainfo: item[2]?.value?.value || item[2]?.value || item[2] || '',
        registeredAt: Number(item[3]?.value?.value || item[3]?.value || item[3] || 0)
      };
    } else if (typeof item === "string") {
      // Raw hex format: decode using ABI
      registration = abiDecodeUserRegistration(item);
    } else if (item?.data && typeof item.data === "string") {
      // Data wrapper format
      registration = abiDecodeUserRegistration(item.data);
    }

    if (registration && registration.phoneHash && registration.walletAddress) {
      return {
        ...registration,
        registeredAtISO: new Date(registration.registeredAt).toISOString(),
        publisher,
        source
      };
    }
    
    return null;
  } catch (error: any) {
    console.warn(`Failed to process registration result: ${error.message}`);
    return null;
  }
}

// Create phone hash from raw phone input
export function createPhoneHash(rawPhone: string, defaultCountryCode?: string): { normalized: string, phoneHash: string } {
  const withCc = rawPhone.startsWith('+') 
    ? rawPhone 
    : ((defaultCountryCode || '').trim() + rawPhone);
  
  const normalized = normalizePhone(withCc);
  const phoneHash = hashPhone(normalized);
  
  return { normalized, phoneHash };
}

// Validate phone hash matches expected value
export function validatePhoneHash(expectedHash: string, actualHash: string): boolean {
  return expectedHash === actualHash;
}

// Generate deterministic data ID from phone hash (for storage key matching)
export function generateDataId(phoneHash: string): string {
  return phoneHash; // Use phone hash as data ID for consistent lookup
}