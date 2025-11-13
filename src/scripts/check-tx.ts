// src/scripts/check-tx.ts
import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';

async function main() {
  const rpcUrl = process.env.RPC_URL;
  const txHash = process.env.TX_HASH as `0x${string}` | undefined;

  if (!rpcUrl) {
    console.error('RPC_URL is missing in your environment.');
    process.exit(1);
  }
  if (!txHash) {
    console.error('TX_HASH is missing in your environment.');
    process.exit(1);
  }

  const client = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) });

  console.log('Checking tx receipt for', txHash);
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  console.log('receipt:', receipt);

  // Print logs more verbosely so we can spot the schemaId in topics/data
  if (receipt && receipt.logs) {
    console.log('\nLogs (detailed):');
    for (const l of receipt.logs) {
      console.log(JSON.stringify({ address: l.address, topics: l.topics, data: l.data, logIndex: l.logIndex }, null, 2));
    }
  }

  // Try to extract schemaId for a named event id from logs (helpful for event schemas)
  const targetId = 'UserRegistrationBroadcast';
  try {
    for (let i = 0; i < (receipt?.logs ?? []).length; i++) {
      const l = receipt!.logs[i] as any;
      if (!l || !l.data) continue;
      // decode data bytes to string and look for the target id
      try {
        const raw = Buffer.from(l.data.replace(/^0x/, ''), 'hex').toString('utf8');
        if (raw.includes(targetId)) {
          // schemaId is commonly present as the second topic (topics[1]) in the paired log
          const possible = (l.topics && l.topics[1]) || null;
          console.log(`\nDetected '${targetId}' string in logIndex=${l.logIndex}.`);
          if (possible) console.log(`${targetId} canonical schemaId (from topics[1]):`, possible);
          else console.log('No topics[1] found alongside the id log; inspect logs above.');
          break;
        }
      } catch (e) {
        // ignore decode errors
      }
    }
  } catch (e) {
    /* ignore */
  }

  const CONTRACT = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';
  const idToSchemaAbi = [
    {
      inputs: [{ internalType: 'string', name: 'id', type: 'string' }],
      name: 'idToSchemaId',
      outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
      stateMutability: 'view',
      type: 'function'
    }
  ];

  try {
    const res = await client.readContract({
      address: CONTRACT,
      abi: idToSchemaAbi as any,
      functionName: 'idToSchemaId',
      args: ['UserRegistrationBroadcast']
    });
    console.log('idToSchemaId(UserRegistrationBroadcast):', res);
  } catch (err: any) {
    console.error('Failed to read idToSchemaId:', err?.message ?? err);
  }

  // Probe a few other likely function names/ABIs for event schema mappings.
  // Some contracts expose separate mappings for event schemas; try common variants.
  const probes: { name: string; abi: any; args: any[] }[] = [
    { name: 'eventIdToSchemaId', abi: idToSchemaAbi, args: ['UserRegistrationBroadcast'] },
    { name: 'getEventSchema', abi: [
      { inputs: [{ internalType: 'string', name: 'id', type: 'string' }], name: 'getEventSchema', outputs: [{ internalType: 'string', name: 'eventTopic', type: 'string' }, { internalType: 'bytes32', name: 'schemaId', type: 'bytes32' }], stateMutability: 'view', type: 'function' }
    ], args: ['UserRegistrationBroadcast'] },
    { name: 'getEvent', abi: [
      { inputs: [{ internalType: 'string', name: 'id', type: 'string' }], name: 'getEvent', outputs: [{ internalType: 'string', name: 'id', type: 'string' }, { internalType: 'bytes32', name: 'schemaId', type: 'bytes32' }], stateMutability: 'view', type: 'function' }
    ], args: ['UserRegistrationBroadcast'] }
  ];

  for (const p of probes) {
    try {
      const out = await client.readContract({ address: CONTRACT, abi: p.abi as any, functionName: p.name as any, args: p.args });
      console.log(`${p.name} ->`, out);
    } catch (err: any) {
      console.log(`${p.name} failed:`, err?.message ?? err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
