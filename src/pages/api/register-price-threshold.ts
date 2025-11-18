// src/pages/api/register-price-threshold.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';
import { normalizePhone, hashPhone } from '../../lib/phone';
import { AbiCoder } from 'ethers';

// Encode priceThreshold schema: bytes32 phoneHash, string tokenSymbol, uint256 minPrice, uint256 maxPrice, uint64 updatedAt
function abiEncodePriceThreshold(phoneHash: string, tokenSymbol: string, minPrice: number|string, maxPrice: number|string, ts: number) {
  const abiCoder = new AbiCoder();
  
  // Convert prices to wei (multiply by 1e18) before converting to BigInt
  const minPriceWei = BigInt(Math.floor(parseFloat(minPrice.toString()) * 1e18));
  const maxPriceWei = BigInt(Math.floor(parseFloat(maxPrice.toString()) * 1e18));
  
  return abiCoder.encode(
    ['bytes32', 'string', 'uint256', 'uint256', 'uint64'],
    [phoneHash, tokenSymbol, minPriceWei, maxPriceWei, BigInt(ts)]
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method must be POST' });

  try {
    const { phone, tokenSymbol, minPrice, maxPrice } = req.body;
    if (!phone || !tokenSymbol || minPrice === undefined || maxPrice === undefined) {
      return res.status(400).json({ error: 'phone, tokenSymbol, minPrice, and maxPrice are required' });
    }

    // Normalize & hash phone
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);
    const ts = Date.now();

    // Get schemaId for priceThreshold
    const schemaIdRaw = await sdk.streams.idToSchemaId('priceThreshold') as `0x${string}` | null;
    if (!schemaIdRaw) {
      return res.status(500).json({ error: 'priceThreshold schema not registered. Run register-schemas first.' });
    }
    const schemaId = schemaIdRaw as `0x${string}`;

    // Encode data
    const dataHex = abiEncodePriceThreshold(phoneHash, tokenSymbol, minPrice, maxPrice, ts) as `0x${string}`;
    const dataId = phoneHash as `0x${string}`; // Using phoneHash as unique ID

    // Basic validation
    if (!/^0x[0-9a-fA-F]*$/.test(dataHex)) {
      return res.status(400).json({ error: 'data is not a hex string' });
    }

    // Store on-chain
    const tx = await sdk.streams.set([
      { id: dataId, schemaId, data: dataHex }
    ]);

    console.log('Stored priceThreshold:', { dataId, tokenSymbol, minPrice, maxPrice, ts, tx });

    return res.json({ ok: true, tx });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
