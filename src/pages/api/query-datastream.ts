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
    
    if (!schemaName || !publisher) {
      return res.status(400).json({ 
        error: 'schemaName and publisher parameters required',
        example: {
          schemaName: 'userRegistration',
          publisher: '0x123...abc',
          dataId: '0x456...def (optional - phone hash to filter by)'
        }
      });
    }

    // Validate hex format
    if (!/^0x[0-9a-fA-F]+$/.test(publisher)) {
      return res.status(400).json({ error: 'publisher must be a valid hex address' });
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
      dataId: dataId || 'all records'
    });

    // Query ALL data from this publisher using getAllPublisherDataForSchema
    let results;
    try {
      results = await sdk.streams.getAllPublisherDataForSchema(
        schemaId as `0x${string}`, 
        publisher as `0x${string}`
      );
      console.log('Query results:', results);
      
      // Deep log to see actual values inside the [Object] entries (handle BigInt)
      console.log('Query results DEEP:', JSON.stringify(results, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
      
      // Log each field individually to see the structure
      if (results && Array.isArray(results) && results.length > 0) {
        console.log('First result analysis:');
        const firstResult = results[0];
        if (Array.isArray(firstResult)) {
          firstResult.forEach((field, index) => {
            console.log(`Field ${index}:`, {
              name: field.name,
              type: field.type,
              signature: field.signature,
              value: field.value,
              valueType: typeof field.value,
              valueString: String(field.value)
            });
          });
        }
      }
    } catch (queryError: any) {
      console.error('getAllPublisherDataForSchema failed:', queryError);
      
      // Check if it's the "Array index is out of bounds" error
      if (queryError.reason === 'Array index is out of bounds.' || 
          queryError.message?.includes('Array index is out of bounds')) {
        return res.json({ 
          found: false,
          schemaName,
          schemaId,
          publisher,
          message: 'No data found for this publisher under this schema',
          debug: {
            error: 'Array index out of bounds - publisher has no data for this schema',
            suggestions: [
              'Check if you have published any data using /api/register',
              'Verify the publisher address matches the one used to publish data',
              'Try using the environment publisher address if set: ' + (process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS || 'not set')
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
        message: 'No data found for this publisher under this schema'
      });
    }

    // Process and normalize the results to extract actual values
    const processedResults = results.map((item: any) => {
      if (Array.isArray(item)) {
        // Extract actual values from field objects
        const normalizedItem: any = {};
        item.forEach((field: any) => {
          if (field && field.name && field.value && field.value.value !== undefined) {
            let value = field.value.value;
            // Convert BigInt to string for JSON serialization
            if (typeof value === 'bigint') {
              value = value.toString();
            }
            normalizedItem[field.name] = value;
          }
        });
        return normalizedItem;
      }
      return item;
    });

    // Filter by dataId (phoneHash) if provided
    let filteredResults = processedResults;
    if (dataId) {
      console.log('🔍 Filtering by dataId (phoneHash):', dataId);
      filteredResults = processedResults.filter((item: any) => {
        const matches = item.phoneHash === dataId;
        console.log(`📱 Checking item phoneHash: ${item.phoneHash} === ${dataId} ? ${matches}`);
        return matches;
      });
      console.log(`✅ Filtered results: ${filteredResults.length} out of ${processedResults.length} records`);
    }

    // Return filtered or all results
    return res.json({
      found: filteredResults.length > 0,
      schemaName,
      schemaId,
      publisher,
      dataId: dataId || null,
      results: filteredResults,
      allResults: processedResults, // All results for debugging
      rawResults: JSON.parse(JSON.stringify(results, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )),
      metadata: {
        resultType: typeof results,
        isArray: Array.isArray(results),
        totalCount: Array.isArray(results) ? results.length : 1,
        filteredCount: filteredResults.length,
        wasFiltered: !!dataId
      }
    });

  } catch (err: any) {
    console.error('Datastream query error:', err);
    return res.status(500).json({ 
      error: err.message || String(err),
      hint: 'Make sure the schema is registered and the publisher has published data'
    });
  }
}