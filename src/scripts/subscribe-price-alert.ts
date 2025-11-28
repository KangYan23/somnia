// scripts/subscribe-price-alert.ts
import { SDK } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, webSocket, decodeAbiParameters } from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';
import 'dotenv/config';

import { buildSomniaChainWithWs } from '../lib/somniaChain';

async function main() {
  try {
    console.log("🚀 Starting Price Alert Subscription Service...");
    console.log("📡 Connecting to Somnia WebSocket...");
    
    // Get environment variables
    const rpcUrl = process.env.RPC_URL;
    const wsUrl = process.env.RPC_WS_URL || "wss://dream-rpc.somnia.network/ws";
    const rawPrivateKey = process.env.PRIVATE_KEY;
    
    if (!rpcUrl || !rawPrivateKey) {
      throw new Error("RPC_URL and PRIVATE_KEY required in env");
    }
    
    // Setup account
    const pkClean = rawPrivateKey.trim().startsWith('0x') ? rawPrivateKey.trim().slice(2) : rawPrivateKey.trim();
    const privateKey = (`0x${pkClean}`) as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    
    // Create client for subscriptions
    // Using WebSocket transport as required by the SDK
    console.log(`🔌 Connecting to WS: ${wsUrl}`);
    const somniaChainWithWs = buildSomniaChainWithWs(wsUrl);
    
    const publicClient = createPublicClient({ 
      chain: somniaChainWithWs, 
      transport: webSocket(wsUrl) 
    });
    
    // Create wallet client
    const walletClient = createWalletClient({ 
      chain: somniaTestnet, 
      account, 
      transport: http(rpcUrl) 
    });
    
    // Initialize SDK
    const wsSDK = new SDK({
      public: publicClient as any,
      wallet: walletClient as any
    });
    
    console.log("👂 Listening for Price Alert events...");
    console.log("💡 When users set min/max thresholds and price moves outside that range, you'll be notified here!");
    console.log("---");

    await wsSDK.streams.subscribe({
      somniaStreamsEventId: "PriceAlert",
      ethCalls: [],
      onlyPushChanges: false,

      onData(data: any) {
        try {
          console.log("🚨🚨🚨 PRICE ALERT TRIGGERED! 🚨🚨🚨");
          console.log("📅 Time:", new Date().toISOString());
          
          // Decode the price alert data
          if (data.data) {
            try {
              const decodedData = decodeAbiParameters(
                [
                  { type: "uint256", name: "currentPrice" },
                  { type: "uint256", name: "minPrice" },
                  { type: "uint256", name: "maxPrice" },
                  { type: "string", name: "tokenSymbol" }
                ],
                data.data as `0x${string}`
              );
              
              const currentPrice = Number(decodedData[0]) / 1e18;
              const minPrice = Number(decodedData[1]) / 1e18;
              const maxPrice = Number(decodedData[2]) / 1e18;
              const tokenSymbol = decodedData[3];
              
              console.log(`📱 User Phone Hash: ${data.topics?.[1]?.slice(0, 10)}...`);
              console.log(`🪙 Token: ${tokenSymbol}`);
              console.log(`💰 Current Price: $${currentPrice.toFixed(6)}`);
              console.log(`📊 User's Range: $${minPrice.toFixed(6)} - $${maxPrice.toFixed(6)}`);
              
              if (currentPrice < minPrice) {
                console.log(`📉 ALERT: Price dropped BELOW minimum threshold!`);
                console.log(`🔻 Price is $${(minPrice - currentPrice).toFixed(6)} below minimum`);
              } else if (currentPrice > maxPrice) {
                console.log(`📈 ALERT: Price rose ABOVE maximum threshold!`);
                console.log(`🔺 Price is $${(currentPrice - maxPrice).toFixed(6)} above maximum`);
              }
              
            } catch (decodeError) {
              console.log("📦 Raw Event Data:", data);
              console.error("❌ Error decoding price data:", decodeError);
            }
          } else {
            console.log("📦 Raw Event Data:", data);
          }
          
          console.log("🔔 User should be notified about this price movement!");
          console.log("===============================================");
          
        } catch (error) {
          console.error("❌ Error processing price alert:", error);
          console.log("📦 Raw Data:", data);
        }
      },

      onError(err: any) {
        console.error("❌ Subscription Error:", err);
        console.log("🔄 Trying to reconnect...");
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          console.log("🔄 Attempting to restart subscription...");
          main();
        }, 5000);
      },
    });
    
    console.log("✅ Price Alert subscription is now active!");
    console.log("🎯 Waiting for price threshold breaches...");
    
  } catch (error) {
    console.error("❌ Error starting subscription service:", error);
    console.log("💡 Make sure the Somnia network is accessible and try again.");
  }
}

main();
