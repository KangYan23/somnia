// src/pages/api/query-by-events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { normalizePhone, hashPhone } from '../../lib/phone';

const CONTRACT_ADDRESS = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';

// Event signature for UserRegistrationBroadcast
const eventAbi = {
  type: 'event',
  name: 'UserRegistrationBroadcast',
  inputs: [
    { name: 'phoneHash', type: 'bytes32', indexed: true },
    { name: 'walletAddress', type: 'address', indexed: false },
    { name: 'registeredAt', type: 'uint64', indexed: false }
  ]
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const phone = (req.method === 'GET' ? req.query.phone : req.body?.phone) as string;
    
    if (!phone) {
      return res.status(400).json({ error: 'phone parameter required' });
    }

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      return res.status(500).json({ error: 'RPC_URL not configured' });
    }

    // normalize & hash
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);

    // Create viem client
    const client = createPublicClient({
      chain: somniaTestnet,
      transport: http(rpcUrl)
    });

    // Query logs for UserRegistrationBroadcast events with this phoneHash
    // The phoneHash is indexed (first topic after event signature)
    // RPC limits to 1000 blocks, so we chunk the query
    const latestBlock = await client.getBlockNumber();
    const CHUNK_SIZE = 1000;
    const MAX_CHUNKS = 50; // Search up to 50k blocks back
    
    let allLogs: any[] = [];
    let currentBlock = latestBlock;
    
    // Search in chunks until we find events or reach limit
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const fromBlock = currentBlock - BigInt(CHUNK_SIZE);
      
      console.log(`Searching blocks ${fromBlock} to ${currentBlock}...`);
      
      const logs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: eventAbi,
        args: {
          phoneHash: phoneHash as `0x${string}`
        },
        fromBlock,
        toBlock: currentBlock
      });
      
      if (logs.length > 0) {
        allLogs.push(...logs);
        console.log(`Found ${logs.length} events in this chunk`);
        // Continue searching in case there are more registrations further back
        // but limit to reasonable range
        if (i >= 5) break; // Stop after finding events and checking 5 more chunks
      }
      
      currentBlock = fromBlock - BigInt(1);
      
      // Stop if we've gone back far enough
      if (currentBlock < 0) break;
    }
    
    console.log(`Found ${allLogs.length} total registration events for phone ${normalized}`);

    if (allLogs.length === 0) {
      return res.json({
        found: false,
        phone: normalized,
        phoneHash,
        registrations: []
      });
    }

    // Decode all events
    const registrations = allLogs.map((log: any) => {
      const decoded = decodeEventLog({
        abi: [eventAbi],
        data: log.data,
        topics: log.topics
      });

      return {
        phoneHash: decoded.args.phoneHash,
        walletAddress: decoded.args.walletAddress,
        registeredAt: Number(decoded.args.registeredAt),
        registeredAtISO: new Date(Number(decoded.args.registeredAt)).toISOString(),
        blockNumber: log.blockNumber.toString(),
        transactionHash: log.transactionHash
      };
    });

    return res.json({
      found: true,
      phone: normalized,
      phoneHash,
      count: registrations.length,
      registrations
    });

  } catch (err: any) {
    console.error('Query error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
