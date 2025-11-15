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
    let results = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher as `0x${string}`);
    
    // If no results with environment publisher, try with wallet address (in case data was stored with wallet)
    if ((!results || results.length === 0) && process.env.WALLET_ADDRESS && publisher !== process.env.WALLET_ADDRESS) {
      console.log('🔄 No data found with environment publisher, trying wallet address:', process.env.WALLET_ADDRESS);
      try {
        results = await sdk.streams.getAllPublisherDataForSchema(schemaId, process.env.WALLET_ADDRESS as `0x${string}`);
      } catch (walletError) {
        console.log('⚠️ Wallet address query also failed:', walletError);
      }
    }
    
    if (!results || results.length === 0) {
      return res.json({ found: false, message: 'No priceThreshold found for this publisher or wallet address' });
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

    // Find all matching phoneHashes and get the most recent one
    const matches = processed.filter((item: any) => item.phoneHash === phoneHash);
    if (!matches || matches.length === 0) {
      return res.json({ found: false, message: 'No priceThreshold found for this phone' });
    }

    // Sort by updatedAt timestamp to get the most recent one
    const match = matches.sort((a: any, b: any) => {
      const aTime = Number(a.updatedAt || 0);
      const bTime = Number(b.updatedAt || 0);
      return bTime - aTime; // Sort descending (most recent first)
    })[0];

    console.log(`📊 Found ${matches.length} records for phone, using most recent:`, match);

    console.log('🎯 Final result:', {
      found: true,
      phone,
      tokenSymbol: match.tokenSymbol,
      minPrice: match.minPrice,
      maxPrice: match.maxPrice,
      updatedAt: match.updatedAt
    });

    // Convert wei prices back to USD for display
    const minPriceUSD = Number(match.minPrice) / 1e18;
    const maxPriceUSD = Number(match.maxPrice) / 1e18;

    return res.json({
      found: true,
      phone,
      tokenSymbol: match.tokenSymbol,
      minPrice: minPriceUSD.toFixed(6),
      maxPrice: maxPriceUSD.toFixed(6),
      updatedAt: match.updatedAt
    });

  } catch (err: any) {
    console.error('Query error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
