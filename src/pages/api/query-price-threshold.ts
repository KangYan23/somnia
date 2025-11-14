// src/pages/api/query-price-threshold.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';
import { normalizePhone, hashPhone } from '../../lib/phone';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const params = req.method === 'GET' ? req.query : req.body;
    const { phone, publisher } = params;

    if (!phone || !publisher) {
      return res.status(400).json({ error: 'phone and publisher are required' });
    }

    // Normalize & hash phone
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);

    // Get schemaId for priceThreshold
    const schemaIdRaw = await sdk.streams.idToSchemaId('priceThreshold') as `0x${string}` | null;
    if (!schemaIdRaw) {
      return res.status(500).json({ error: 'priceThreshold schema not registered. Run register-schemas first.' });
    }
    const schemaId = schemaIdRaw as `0x${string}`;

    // Query all data for this publisher
    const results = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher as `0x${string}`);
    if (!results || results.length === 0) {
      return res.json({ found: false, message: 'No priceThreshold found for this publisher' });
    }

    // Normalize results with proper field mapping
    console.log('🔍 Raw results for debugging:', JSON.stringify(results, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    
    const processed = results.map((item: any, index: number) => {
      console.log(`📋 Processing item ${index}:`, item);
      const obj: any = {};
      if (Array.isArray(item)) {
        // Map fields by position since field names might not be reliable
        // Schema: bytes32 phoneHash, string tokenSymbol, uint256 minPrice, uint256 maxPrice, uint64 updatedAt
        if (item.length >= 5) {
          obj.phoneHash = item[0]?.value?.value || item[0];
          obj.tokenSymbol = item[1]?.value?.value || item[1];
          obj.minPrice = item[2]?.value?.value || item[2];
          obj.maxPrice = item[3]?.value?.value || item[3];
          obj.updatedAt = item[4]?.value?.value || item[4];
          
          // Convert BigInt to string
          ['minPrice', 'maxPrice', 'updatedAt'].forEach(field => {
            if (typeof obj[field] === 'bigint') {
              obj[field] = obj[field].toString();
            }
          });
          
          console.log(`✅ Mapped item ${index}:`, obj);
        } else {
          // Fallback to name-based mapping
          item.forEach((field: any) => {
            if (field?.name && field?.value?.value !== undefined) {
              obj[field.name] = typeof field.value.value === 'bigint' ? field.value.value.toString() : field.value.value;
            }
          });
          console.log(`📛 Fallback mapping for item ${index}:`, obj);
        }
      }
      return obj;
    });

    // Find matching phoneHash
    const match = processed.find((item: any) => item.phoneHash === phoneHash);
    if (!match) {
      return res.json({ found: false, message: 'No priceThreshold found for this phone' });
    }

    return res.json({
      found: true,
      phone,
      minPrice: match.minPrice,
      maxPrice: match.maxPrice,
      updatedAt: match.updatedAt
    });

  } catch (err: any) {
    console.error('Query error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
