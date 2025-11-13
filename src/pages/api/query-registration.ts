// src/pages/api/query-registration.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';
import { normalizePhone, hashPhone } from '../../lib/phone';
import { AbiCoder } from 'ethers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const phone = (req.method === 'GET' ? req.query.phone : req.body?.phone) as string;
    
    if (!phone) {
      return res.status(400).json({ error: 'phone parameter required' });
    }

    // normalize & hash
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);

    // Get the schema ID
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    if (!schemaId || schemaId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return res.status(404).json({ error: 'schema not registered' });
    }

    // Query data by phoneHash
    // getByKey requires: schemaId, publisher address, key
    // For querying any publisher's data, we may need to know the publisher or query all
    // The SDK may require the publisher address; if unknown, we'd need to iterate or use events
    // For now, assume we're querying our own published data (use the wallet from env)
    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    
    if (!publisherAddress) {
      return res.status(500).json({ 
        error: 'PUBLISHER_ADDRESS or WALLET_ADDRESS must be set in environment to query data' 
      });
    }

    const results = await sdk.streams.getByKey(
      schemaId as `0x${string}`, 
      publisherAddress as `0x${string}`,
      phoneHash as `0x${string}`
    );
    
    console.log('Query results:', results);
    console.log('Results type:', typeof results, Array.isArray(results));
    
    if (!results || results.length === 0) {
      return res.json({ 
        found: false, 
        phone: normalized,
        phoneHash,
        registrations: [] 
      });
    }

    // Decode all registrations
    // results can be Hex[] (raw) or SchemaDecodedItem[][] (decoded)
    const abiCoder = new AbiCoder();
    const registrations = [];

    for (const item of results) {
      console.log('Processing item:', item, 'Type:', typeof item, 'IsArray:', Array.isArray(item));
      
      try {
        let dataHex: string;
        
        // Check if item is already decoded or is raw hex
        if (typeof item === 'string') {
          dataHex = item;
        } else if (Array.isArray(item)) {
          // Already decoded by SDK; extract values
          // SchemaDecodedItem has { name, type, value }
          const decoded = item as any[];
          registrations.push({
            phoneHash: decoded[0]?.value || decoded[0],
            walletAddress: decoded[1]?.value || decoded[1],
            metainfo: decoded[2]?.value || decoded[2] || '',
            registeredAt: Number(decoded[3]?.value || decoded[3]),
            registeredAtISO: new Date(Number(decoded[3]?.value || decoded[3])).toISOString()
          });
          continue;
        } else {
          // Unknown format
          registrations.push({ error: 'unknown format', rawItem: item });
          continue;
        }
        
        const decoded = abiCoder.decode(
          ['bytes32', 'address', 'string', 'uint64'],
          dataHex
        );
        
        registrations.push({
          phoneHash: decoded[0],
          walletAddress: decoded[1],
          metainfo: decoded[2] || '',
          registeredAt: Number(decoded[3]),
          registeredAtISO: new Date(Number(decoded[3])).toISOString()
        });
      } catch (e: any) {
        console.error('Failed to decode item:', e?.message);
        registrations.push({
          error: 'decode failed',
          rawItem: item
        });
      }
    }

    return res.json({
      found: true,
      phone: normalized,
      phoneHash,
      count: registrations.length,
      registrations: JSON.parse(JSON.stringify(registrations, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ))
    });

  } catch (err: any) {
    console.error('Query error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
