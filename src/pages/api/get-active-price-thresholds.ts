// src/pages/api/get-active-price-thresholds.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    // Get publisher address (the one that sets price thresholds)
    const publisherAddress = process.env.WALLET_ADDRESS || process.env.PUBLISHER_ADDRESS;
    
    if (!publisherAddress) {
      return res.status(500).json({ 
        error: 'WALLET_ADDRESS or PUBLISHER_ADDRESS not configured in environment'
      });
    }

    // Get schemaId for priceThreshold
    const schemaIdRaw = await sdk.streams.idToSchemaId('priceThreshold') as `0x${string}` | null;
    if (!schemaIdRaw) {
      return res.status(500).json({ error: 'priceThreshold schema not registered. Run register-schemas first.' });
    }
    const schemaId = schemaIdRaw as `0x${string}`;

    // Query all price threshold data for this publisher
    const results = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisherAddress as `0x${string}`);
    
    if (!results || results.length === 0) {
      return res.json({ found: false, message: 'No price thresholds found for this publisher', activeThresholds: [] });
    }

    // Process and normalize the results
    const processed = results.map((item: any) => {
      const obj: any = {};
      if (Array.isArray(item)) {
        // Schema: bytes32 phoneHash, string tokenSymbol, uint256 minPrice, uint256 maxPrice, uint64 updatedAt
        if (item.length >= 5) {
          obj.phoneHash = ((item[0] as any)?.value?.value || item[0]) as string;
          obj.tokenSymbol = ((item[1] as any)?.value?.value || item[1]) as string;
          obj.minPrice = ((item[2] as any)?.value?.value || item[2]);
          obj.maxPrice = ((item[3] as any)?.value?.value || item[3]);
          obj.updatedAt = ((item[4] as any)?.value?.value || item[4]);
          
          // Convert BigInt to string
          ['minPrice', 'maxPrice', 'updatedAt'].forEach(field => {
            if (typeof obj[field] === 'bigint') {
              obj[field] = obj[field].toString();
            }
          });
        }
      }
      return obj;
    });

    // Group by phoneHash and get the most recent threshold for each phone
    const phoneGroups: { [phoneHash: string]: any } = {};
    
    processed.forEach((item: any) => {
      const phoneHash = item.phoneHash;
      if (phoneHash) {
        const timestamp = Number(item.updatedAt || 0);
        if (!phoneGroups[phoneHash] || timestamp > Number(phoneGroups[phoneHash].updatedAt || 0)) {
          phoneGroups[phoneHash] = item;
        }
      }
    });

    // Convert to array and format for monitoring
    const activeThresholds = Object.values(phoneGroups).map((threshold: any) => ({
      phoneHash: threshold.phoneHash,
      tokenSymbol: threshold.tokenSymbol || 'STT',
      minPrice: Number(threshold.minPrice || 0) / 1e18, // Convert from wei to USD
      maxPrice: Number(threshold.maxPrice || 0) / 1e18, // Convert from wei to USD
      updatedAt: Number(threshold.updatedAt || 0),
      minPriceWei: threshold.minPrice,
      maxPriceWei: threshold.maxPrice
    }));

    // Sort by most recent first
    activeThresholds.sort((a, b) => b.updatedAt - a.updatedAt);

    console.log('📊 Active price thresholds for monitoring:', activeThresholds.length);
    activeThresholds.forEach((threshold, idx) => {
      console.log(`${idx + 1}. Phone: ${threshold.phoneHash.slice(0, 10)}... Range: $${threshold.minPrice.toFixed(6)} - $${threshold.maxPrice.toFixed(6)}`);
    });

    return res.json({
      found: true,
      activeThresholds,
      count: activeThresholds.length,
      publisher: publisherAddress
    });

  } catch (err: any) {
    console.error('Active thresholds error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}