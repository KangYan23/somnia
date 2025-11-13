// src/scripts/set-price-threshold-fallback.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, keccak256, toBytes } from 'viem';
import { somniaTestnet } from 'viem/chains';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) throw new Error('PRIVATE_KEY not found in environment');

const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) throw new Error('RPC_URL not found in environment');

const account = privateKeyToAccount(`0x${privateKey}`);
const walletClient = createWalletClient({
  account,
  chain: somniaTestnet,
  transport: http(rpcUrl)
});
const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(rpcUrl)
});

const contractAddress = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';

interface PriceThreshold {
  phoneNumber: string;
  phoneHash: string;
  minLossPercentage: number;
  maxProfitPercentage: number;
  timestamp: number;
  walletAddress: string;
}

// Local storage path
const dataDir = join(process.cwd(), 'data');
const thresholdFile = join(dataDir, 'price-thresholds.json');

function ensureDataDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function loadThresholds(): PriceThreshold[] {
  ensureDataDir();
  if (existsSync(thresholdFile)) {
    try {
      return JSON.parse(readFileSync(thresholdFile, 'utf8'));
    } catch (e) {
      console.warn('Failed to load existing thresholds, starting fresh');
      return [];
    }
  }
  return [];
}

function saveThresholds(thresholds: PriceThreshold[]) {
  ensureDataDir();
  writeFileSync(thresholdFile, JSON.stringify(thresholds, null, 2));
}

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function hashPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return keccak256(toBytes(normalized));
}

async function tryOnChainStorage(phoneHash: string, minLoss: number, maxProfit: number): Promise<boolean> {
  try {
    console.log('🔗 Attempting on-chain storage...');
    
    // Try using the existing userRegistration schema with creative encoding
    const userRegSchemaId = process.env.USER_REGISTRATION_SCHEMA_ID;
    if (!userRegSchemaId) {
      console.log('❌ USER_REGISTRATION_SCHEMA_ID not found');
      return false;
    }

    // Check if schema is available
    const schema = await publicClient.readContract({
      address: contractAddress,
      abi: [{
        inputs: [{ name: 'schemaId', type: 'bytes32' }],
        name: 'getSchema',
        outputs: [{ name: '', type: 'tuple', components: [
          { name: 'fields', type: 'tuple[]', components: [
            { name: 'name', type: 'string' },
            { name: 'valueType', type: 'string' }
          ]},
          { name: 'parent', type: 'bytes32' }
        ]}],
        stateMutability: 'view',
        type: 'function'
      }],
      functionName: 'getSchema',
      args: [userRegSchemaId as `0x${string}`]
    });

    console.log('✅ userRegistration schema is available');
    
    // Encode price threshold data into the userRegistration format
    // Schema: phoneHash (bytes32), walletAddress (address), registeredAt (uint64)
    // We'll encode: phoneHash, specialAddress (encoded values), timestamp
    
    // Encode the price thresholds into an address-like format
    // This is a creative workaround - encode both percentages into address bytes
    const encodedValues = `0x${minLoss.toString(16).padStart(8, '0')}${maxProfit.toString(16).padStart(8, '0')}${'FFFF'.repeat(6)}`;
    const timestamp = Math.floor(Date.now() / 1000);

    // Prepare data for storage using viem's built-in encoding
    const { encodeAbiParameters } = await import('viem');
    const encoded = encodeAbiParameters(
      [
        { name: 'phoneHash', type: 'bytes32' },
        { name: 'walletAddress', type: 'address' },
        { name: 'registeredAt', type: 'uint64' }
      ],
      [phoneHash as `0x${string}`, encodedValues as `0x${string}`, BigInt(timestamp)]
    );

    console.log('Encoded price threshold data:', {
      phoneHash,
      encodedAddress: encodedValues,
      timestamp,
      dataLength: encoded.length
    });

    // Attempt to store on-chain
    const tx = await walletClient.writeContract({
      address: contractAddress,
      abi: [{
        inputs: [
          { name: 'schemaId', type: 'bytes32' },
          { name: 'data', type: 'bytes' }
        ],
        name: 'set',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
      }],
      functionName: 'set',
      args: [userRegSchemaId as `0x${string}`, encoded]
    });

    console.log('🎉 On-chain storage successful! Transaction:', tx);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('✅ Transaction confirmed:', receipt.status);
    
    return receipt.status === 'success';

  } catch (error) {
    console.log('❌ On-chain storage failed:', (error as Error).message);
    return false;
  }
}

async function main() {
  try {
    // Example usage - set price threshold for a phone number
    const phoneNumber = '+60123456789';
    const minLossPercentage = 5; // 5%
    const maxProfitPercentage = 10; // 10%

    console.log(`📱 Setting price threshold for ${phoneNumber}`);
    console.log(`📉 Min loss: ${minLossPercentage}%`);
    console.log(`📈 Max profit: ${maxProfitPercentage}%`);

    const phoneHash = hashPhone(phoneNumber);
    console.log(`🔐 Phone hash: ${phoneHash}`);

    // Try on-chain storage first
    const onChainSuccess = await tryOnChainStorage(phoneHash, minLossPercentage, maxProfitPercentage);

    // Always save to local storage as backup/cache
    console.log('💾 Saving to local storage...');
    const thresholds = loadThresholds();
    
    // Remove existing threshold for this phone
    const filteredThresholds = thresholds.filter(t => t.phoneHash !== phoneHash);
    
    // Add new threshold
    const newThreshold: PriceThreshold = {
      phoneNumber,
      phoneHash,
      minLossPercentage,
      maxProfitPercentage,
      timestamp: Date.now(),
      walletAddress: account.address
    };
    
    filteredThresholds.push(newThreshold);
    saveThresholds(filteredThresholds);
    
    console.log('✅ Local storage successful!');
    console.log('📄 Data file:', thresholdFile);
    
    if (onChainSuccess) {
      console.log('🎉 Price threshold stored both on-chain and locally!');
    } else {
      console.log('⚠️  Price threshold stored locally only (on-chain failed)');
    }

    console.log('\n📊 Current thresholds:');
    filteredThresholds.forEach(t => {
      console.log(`  ${t.phoneNumber}: ${t.minLossPercentage}% loss / ${t.maxProfitPercentage}% profit`);
    });

  } catch (error) {
    console.error('❌ Error setting price threshold:', error);
  }
}

main();