// src/pages/api/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';
import { normalizePhone, hashPhone } from '../../lib/phone';
import { AbiCoder, hexlify, randomBytes } from 'ethers';

function abiEncodeUserRegistration(phoneHash: string, wallet: string, metainfo: string, ts: number, minLoss: number, maxProfit: number, tokenSymbol: string) {
  // use ethers AbiCoder to encode the tuple with thresholds included
  const abiCoder = new AbiCoder();
  // types: bytes32, address, string, uint64, uint256, uint256, string
  return abiCoder.encode(
    ['bytes32','address','string','uint64','uint256','uint256','string'], 
    [phoneHash, wallet, metainfo, BigInt(ts), BigInt(minLoss), BigInt(maxProfit), tokenSymbol]
  );
}

function abiEncodePriceThreshold(phoneHash: string, tokenSymbol: string, minPrice: number, maxPrice: number, ts: number) {
  // use ethers AbiCoder to encode the tuple: bytes32 phoneHash, string tokenSymbol, uint256 minPrice, uint256 maxPrice, uint64 updatedAt
  const abiCoder = new AbiCoder();
  return abiCoder.encode(['bytes32','string','uint256','uint256','uint64'], [phoneHash, tokenSymbol, BigInt(minPrice), BigInt(maxPrice), BigInt(ts)]);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const { phone, walletAddress, metainfo, minLossPercentage, maxProfitPercentage, tokenSymbol } = req.body;
    if (!phone || !walletAddress) return res.status(400).json({ error: 'phone & walletAddress required' });
    if (minLossPercentage === undefined || maxProfitPercentage === undefined) {
      return res.status(400).json({ error: 'minLossPercentage & maxProfitPercentage required' });
    }

    // normalize & hash
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);
    const ts = Date.now();

    // Get user registration schema ID only (we'll store thresholds in the user registration itself)
    const userSchemaIdRaw = await sdk.streams.idToSchemaId('userRegistrationWithThresholds') as `0x${string}` | null;
    if (!userSchemaIdRaw) {
      return res.status(500).json({ error: 'userRegistrationWithThresholds schema not registered. run register-schemas script.' });
    }
    const userSchemaId = userSchemaIdRaw as `0x${string}`;

    // Create user registration data that includes thresholds
    const userDataHex = abiEncodeUserRegistration(
      phoneHash, 
      walletAddress, 
      metainfo || '', 
      ts, 
      minLossPercentage, 
      maxProfitPercentage, 
      tokenSymbol || 'STT'
    ) as `0x${string}`;

    // Use phone hash as dataId for deterministic lookup
    // This allows querying user data directly by phone number
    const dataId = phoneHash as `0x${string}`;

    // Basic payload validation
    function isHex32(h: string) {
      return /^0x[0-9a-fA-F]{64}$/.test(h);
    }

    if (!/^0x[0-9a-fA-F]*$/.test(userDataHex)) {
      return res.status(400).json({ error: 'data is not a hex string' });
    }
    if (!isHex32(userDataId)) return res.status(500).json({ error: 'generated dataId is not 32 bytes' });
    if (!isHex32(phoneHash)) return res.status(400).json({ error: 'phoneHash must be 32 bytes (0x + 64 hex chars)' });
    if (!isHex32(phoneHash)) return res.status(400).json({ error: 'phoneHash must be 32 bytes (0x + 64 hex chars)' });

    // Publish data stream only (no events)
    console.log('Prepared payload:', {
      dataId,
      schemaId,
      dataHexLength: (dataHex || '').length
    });

    const tx = await sdk.streams.set([
      { id: dataId as `0x${string}`, schemaId, data: dataHex }
    ]);

    return res.json({ ok: true, tx });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
