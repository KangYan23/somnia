// src/pages/api/get-publisher.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    
    if (!publisherAddress) {
      return res.status(500).json({ 
        error: 'PUBLISHER_ADDRESS or WALLET_ADDRESS not configured in environment'
      });
    }

    return res.json({ 
      publisherAddress,
      source: process.env.PUBLISHER_ADDRESS ? 'PUBLISHER_ADDRESS' : 'WALLET_ADDRESS'
    });

  } catch (err: any) {
    console.error('Get publisher error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}