// src/scripts/manage-price-thresholds.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { keccak256, toBytes } from 'viem';

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

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function hashPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return keccak256(toBytes(normalized));
}

function loadThresholds(): PriceThreshold[] {
  if (existsSync(thresholdFile)) {
    try {
      return JSON.parse(readFileSync(thresholdFile, 'utf8'));
    } catch (e) {
      console.warn('Failed to load thresholds file');
      return [];
    }
  }
  return [];
}

function saveThresholds(thresholds: PriceThreshold[]) {
  writeFileSync(thresholdFile, JSON.stringify(thresholds, null, 2));
}

function listThresholds() {
  const thresholds = loadThresholds();
  
  if (thresholds.length === 0) {
    console.log('📊 No price thresholds found');
    return;
  }
  
  console.log('📊 Current Price Thresholds:');
  console.log('='.repeat(50));
  
  thresholds.forEach((t, index) => {
    const date = new Date(t.timestamp).toLocaleString();
    console.log(`${index + 1}. ${t.phoneNumber}`);
    console.log(`   📉 Min Loss: ${t.minLossPercentage}%`);
    console.log(`   📈 Max Profit: ${t.maxProfitPercentage}%`);
    console.log(`   🕐 Set: ${date}`);
    console.log(`   👤 Wallet: ${t.walletAddress}`);
    console.log(`   🔐 Hash: ${t.phoneHash}`);
    console.log('');
  });
}

function getThreshold(phoneNumber: string): PriceThreshold | null {
  const thresholds = loadThresholds();
  const phoneHash = hashPhone(phoneNumber);
  return thresholds.find(t => t.phoneHash === phoneHash) || null;
}

function removeThreshold(phoneNumber: string): boolean {
  const thresholds = loadThresholds();
  const phoneHash = hashPhone(phoneNumber);
  const initialLength = thresholds.length;
  
  const filtered = thresholds.filter(t => t.phoneHash !== phoneHash);
  
  if (filtered.length < initialLength) {
    saveThresholds(filtered);
    console.log(`✅ Removed threshold for ${phoneNumber}`);
    return true;
  } else {
    console.log(`❌ No threshold found for ${phoneNumber}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'list':
    case 'ls':
      listThresholds();
      break;
      
    case 'get':
      if (args[1]) {
        const threshold = getThreshold(args[1]);
        if (threshold) {
          console.log(`📱 ${threshold.phoneNumber}: ${threshold.minLossPercentage}% loss / ${threshold.maxProfitPercentage}% profit`);
        } else {
          console.log(`❌ No threshold found for ${args[1]}`);
        }
      } else {
        console.log('Usage: npm run manage-thresholds get <phone-number>');
      }
      break;
      
    case 'remove':
    case 'rm':
      if (args[1]) {
        removeThreshold(args[1]);
      } else {
        console.log('Usage: npm run manage-thresholds remove <phone-number>');
      }
      break;
      
    case 'clear':
      const thresholds = loadThresholds();
      if (thresholds.length > 0) {
        saveThresholds([]);
        console.log(`✅ Cleared all ${thresholds.length} thresholds`);
      } else {
        console.log('📊 No thresholds to clear');
      }
      break;
      
    default:
      console.log('📊 Price Threshold Manager');
      console.log('');
      console.log('Available commands:');
      console.log('  list, ls           - List all thresholds');
      console.log('  get <phone>        - Get threshold for specific phone');
      console.log('  remove <phone>     - Remove threshold for specific phone');
      console.log('  clear              - Clear all thresholds');
      console.log('');
      console.log('Examples:');
      console.log('  npx ts-node src/scripts/manage-price-thresholds.ts list');
      console.log('  npx ts-node src/scripts/manage-price-thresholds.ts get +60123456789');
      console.log('  npx ts-node src/scripts/manage-price-thresholds.ts remove +60123456789');
      break;
  }
}

main();