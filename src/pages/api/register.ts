// src/pages/api/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';
import { normalizePhone, hashPhone } from '../../lib/phone';
import { AbiCoder, hexlify, randomBytes } from 'ethers';

function abiEncodeUserRegistration(phoneHash: string, wallet: string, metainfo: string, ts: number) {
  // use ethers AbiCoder to encode the tuple in the same order as schema
  const abiCoder = new AbiCoder();
  // types: bytes32, address, string, uint64
  return abiCoder.encode(['bytes32','address','string','uint64'], [phoneHash, wallet, metainfo, BigInt(ts)]);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const { phone, walletAddress, metainfo } = req.body;
    if (!phone || !walletAddress) return res.status(400).json({ error: 'phone & walletAddress required' });

    // normalize & hash
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);
    const ts = Date.now();

    // compute schemaId (optional); you must have registered schema previously
    const schemaIdRaw = await sdk.streams.idToSchemaId('userRegistration') as `0x${string}` | null;
    if (!schemaIdRaw) {
      return res.status(500).json({ error: 'schema not registered. run register-schemas script.' });
    }
    const schemaId = schemaIdRaw as `0x${string}`;

    const dataHex = abiEncodeUserRegistration(phoneHash, walletAddress, metainfo || '', ts) as `0x${string}`;

    // Use phoneHash as dataId so we can query by phone hash later
    const dataId = phoneHash as `0x${string}`;

    // Basic payload validation to surface errors before calling the contract
    function isHex32(h: string) {
      return /^0x[0-9a-fA-F]{64}$/.test(h);
    }

    if (!/^0x[0-9a-fA-F]*$/.test(dataHex)) {
      return res.status(400).json({ error: 'data is not a hex string' });
    }
    if (!isHex32(dataId)) return res.status(500).json({ error: 'generated dataId is not 32 bytes' });
    if (!isHex32(phoneHash)) return res.status(400).json({ error: 'phoneHash must be 32 bytes (0x + 64 hex chars)' });

    // Event argument topics must be 32-byte hex values for indexed params
    const argumentTopics = [phoneHash as `0x${string}`];
    for (const t of argumentTopics) {
      if (!isHex32(t as string)) return res.status(400).json({ error: `argument topic ${t} is not 32 bytes` });
    }

    // Event data: encode non-indexed params (address walletAddress, uint64 registeredAt)
    // The event schema is: UserRegistrationBroadcast(bytes32 indexed phoneHash, address walletAddress, uint64 registeredAt)
    // indexed -> topics; non-indexed -> data
    const abiCoder = new AbiCoder();
    const eventData = abiCoder.encode(['address', 'uint64'], [walletAddress, BigInt(ts)]) as `0x${string}`;

    // Set Data only (ignoring events for now)
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
