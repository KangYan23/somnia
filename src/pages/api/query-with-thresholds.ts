// src/pages/api/query-with-thresholds.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { AbiCoder } from 'ethers';
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
  try {
    const phone = (req.method === 'GET' ? req.query.phone : req.body?.phone) as string;

    if (!phone) {
      return res.status(400).json({ error: 'phone parameter required' });
    }

    // Import SDK here to avoid import issues
    const { sdk, account } = await import('../../lib/somnia');

    const phoneHash = hashPhone(normalizePhone(phone));
    console.log(`=== Querying phone: ${phone}, hash: ${phoneHash} ===`);

    try {
      // Get all data for the userRegistrationWithThresholds schema
      const schemaId = await sdk.streams.idToSchemaId('userRegistrationWithThresholds');
      if (!schemaId) {
        return res.status(500).json({ error: 'userRegistrationWithThresholds schema not found' });
      }

      console.log(`📋 Schema ID for userRegistrationWithThresholds: ${schemaId}`);

      // Get all published data for this schema
      const allData = await sdk.streams.getAllPublisherDataForSchema(schemaId, account.address);

      if (!allData) {
        console.log('No data found for this schema');
        return res.json({
          registered: false,
          message: 'No registration found for this phone number'
        });
      }

      console.log(`📦 Found ${allData.length} records in userRegistrationWithThresholds schema`);

      const registrations = [];

      // Decode each data entry and check if it matches our phone hash
      for (let i = 0; i < allData.length; i++) {
        try {
          const dataItem = allData[i];
          console.log(`🔍 Checking data item ${i}: ${dataItem.slice(0, 100)}...`);

          if (typeof dataItem === 'string' && dataItem !== '0x' && dataItem.length > 200) {
            const abiCoder = new AbiCoder();

            try {
              // Decode with integrated schema: phoneHash, address, string, uint64, uint256, uint256, string
              const decoded = abiCoder.decode(
                ['bytes32', 'address', 'string', 'uint64', 'uint256', 'uint256', 'string'],
                dataItem
              );

              const [decodedPhoneHash, walletAddress, metainfo, timestamp, minLoss, maxProfit, tokenSymbol] = decoded;

              console.log(`📱 Decoded phone hash: ${decodedPhoneHash}, looking for: ${phoneHash}`);

              if (decodedPhoneHash === phoneHash) {
                console.log(`✅ Found matching registration!`);
                console.log(`📊 MinLoss: ${minLoss}, MaxProfit: ${maxProfit}, Token: ${tokenSymbol}`);

                registrations.push({
                  walletAddress: walletAddress,
                  registeredAt: new Date(Number(timestamp)).toISOString(),
                  phoneHash: decodedPhoneHash,
                  recordId: `schema_${i}`,
                  metainfo: metainfo,
                  // Price thresholds from the integrated registration data
                  minLossPercentage: Number(minLoss),
                  maxProfitPercentage: Number(maxProfit),
                  tokenSymbol: tokenSymbol || 'STT',
                  updatedAt: new Date(Number(timestamp)).toISOString()
                });

                break; // Found our registration, no need to continue
              }
            } catch (decodeError) {
              console.log(`❌ Failed to decode data item ${i}:`, (decodeError as Error).message);
            }
          }
        } catch (itemError) {
          console.log(`❌ Error processing data item ${i}:`, (itemError as Error).message);
        }
      }

      console.log(`=== Found ${registrations.length} matching registrations ===`);

      if (registrations.length === 0) {
        return res.json({
          registered: false,
          message: 'No registration found for this phone number'
        });
      }

      return res.json({
        registered: true,
        data: registrations[0] // Return the first (and should be only) match
      });

    } catch (sdkError) {
      console.error('Error querying with SDK:', (sdkError as Error).message);

      // Fallback to event log scanning if SDK query fails
      return await queryViaEvents(req, res, phone, phoneHash);
    }

  } catch (error) {
    console.error('Query handler error:', (error as Error).message);
    return res.status(500).json({
      error: 'Internal server error',
      details: (error as Error).message
    });
  }
}

// Fallback method using event log scanning
async function queryViaEvents(req: NextApiRequest, res: NextApiResponse, phone: string, phoneHash: string) {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ error: 'RPC_URL not configured' });
  }

  // Create viem client
  const client = createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl)
  });

  console.log(`=== Fallback: Querying phone via events: ${phone}, hash: ${phoneHash} ===`);

  try {
    // Query user registration events (simplified event scanning)
    const latestBlock = await client.getBlockNumber();

    const logs = await client.getLogs({
      address: CONTRACT_ADDRESS,
      event: eventAbi,
      args: { phoneHash: phoneHash as `0x${string}` },
      fromBlock: latestBlock - BigInt(5000), // Look back 5000 blocks
      toBlock: 'latest'
    });

    console.log(`Found ${logs.length} registration events via fallback`);

    if (logs.length === 0) {
      return res.json({
        registered: false,
        message: 'No registration found for this phone number'
      });
    }

    // For fallback, just return basic info from the event
    const log = logs[0]; // Get the first/latest registration
    const decoded = decodeEventLog({
      abi: [eventAbi],
      data: log.data,
      topics: log.topics
    });

    return res.json({
      registered: true,
      data: {
        walletAddress: decoded.args.walletAddress,
        registeredAt: new Date(Number(decoded.args.registeredAt)).toISOString(),
        phoneHash: phoneHash,
        recordId: `event_${log.blockNumber}_${log.transactionIndex}_${log.logIndex}`,
        transactionHash: log.transactionHash,
        metainfo: 'Event data only',
        // Thresholds not available from events
        minLossPercentage: null,
        maxProfitPercentage: null,
        tokenSymbol: 'Unknown',
        updatedAt: new Date(Number(decoded.args.registeredAt)).toISOString(),
        note: 'Limited data from event fallback - thresholds not available'
      }
    });

  } catch (error) {
    console.error('Fallback query error:', (error as Error).message);
    return res.status(500).json({
      error: 'Query failed',
      details: (error as Error).message
    });
  }
}