// src/pages/api/query-datastream.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    // Extract parameters from query (GET) or body (POST)
    const params = req.method === 'GET' ? req.query : req.body;
    const { schemaName, publisher, dataId } = params;
    
    if (!schemaName || !publisher || !dataId) {
      return res.status(400).json({ 
        error: 'schemaName, publisher, and dataId parameters required',
        example: {
          schemaName: 'userRegistration',
          publisher: '0x123...abc',
          dataId: '0x456...def'
        }
      });
    }

    // Validate hex formats
    if (!/^0x[0-9a-fA-F]+$/.test(publisher)) {
      return res.status(400).json({ error: 'publisher must be a valid hex address' });
    }
    
    if (!/^0x[0-9a-fA-F]+$/.test(dataId)) {
      return res.status(400).json({ error: 'dataId must be a valid hex value' });
    }

    // Get the schema ID from schema name
    const schemaId = await sdk.streams.idToSchemaId(schemaName);
    if (!schemaId || schemaId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return res.status(404).json({ 
        error: `schema '${schemaName}' not registered. Please register the schema first.`
      });
    }

    // Debug: Also check environment publisher if available
    const envPublisher = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    console.log('Environment publisher:', envPublisher);
    console.log('Requested publisher:', publisher);

    console.log('Querying datastream:', {
      schemaName,
      schemaId,
      publisher,
      dataId
    });

    // Query data using getByKey with error handling
    let results;
    try {
      results = await sdk.streams.getByKey(
        schemaId as `0x${string}`, 
        publisher as `0x${string}`,
        dataId as `0x${string}`
      );
      console.log('Query results:', results);
    } catch (queryError: any) {
      console.error('getByKey failed:', queryError);
      
      // Check if it's the "Array index is out of bounds" error
      if (queryError.reason === 'Array index is out of bounds.' || 
          queryError.message?.includes('Array index is out of bounds')) {
        return res.json({ 
          found: false,
          schemaName,
          schemaId,
          publisher,
          dataId,
          message: 'No data found for the given parameters (publisher has no data for this schema/dataId)',
          debug: {
            error: 'Array index out of bounds - likely means no data exists for this publisher/schema/dataId combination',
            suggestions: [
              'Check if you have published any data using /api/register',
              'Verify the publisher address matches the one used to publish data',
              'Try using the environment publisher address if set: ' + (process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS || 'not set'),
              'Use /api/query-registration with a phone number to see if any data exists'
            ]
          }
        });
      }
      
      // Re-throw other errors
      throw queryError;
    }
    
    if (!results || (Array.isArray(results) && results.length === 0)) {
      return res.json({ 
        found: false,
        schemaName,
        schemaId,
        publisher,
        dataId,
        message: 'No data found for the given parameters'
      });
    }

    // Return raw results - let the client handle decoding based on their schema
    return res.json({
      found: true,
      schemaName,
      schemaId,
      publisher,
      dataId,
      results: JSON.parse(JSON.stringify(results, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )),
      metadata: {
        resultType: typeof results,
        isArray: Array.isArray(results),
        count: Array.isArray(results) ? results.length : 1
      }
    });

  } catch (err: any) {
    console.error('Datastream query error:', err);
    return res.status(500).json({ 
      error: err.message || String(err),
      hint: 'Make sure the schema is registered and the publisher has published data with this dataId'
    });
  }
}