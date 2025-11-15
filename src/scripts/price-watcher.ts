// scripts/price-watcher.ts
import fetch from "node-fetch";
import { encodeAbiParameters } from "viem";
import { sdk } from "../lib/somnia";

// Fetch SOMNIA price from CoinGecko
async function getSomniaPrice() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=somnia&vs_currencies=usd"
    );
    const data = await res.json() as any;
    const price = Number(data.somnia?.usd || 0);
    
    if (price === 0) {
      throw new Error("No price data available from CoinGecko");
    }
    
    return price;
  } catch (error) {
    console.error("Error fetching SOMNIA price:", error);
    throw error;
  }
}

async function main() {
  try {
    const schemaId = await sdk.streams.idToSchemaId("priceThreshold");
    console.log("✅ Schema ID for priceThreshold:", schemaId);
    
    if (!schemaId) {
      console.error("❌ Schema 'priceThreshold' not found. Make sure to register the schema first.");
      return;
    }

    console.log("🚀 Starting SOMNIA price monitoring with real CoinGecko data...");
    console.log("📊 Checking price every 10 seconds...");
    
    setInterval(async () => {
      try {
        const price = await getSomniaPrice();
        console.log(`💰 Current SOMNIA price (USD): $${price.toFixed(6)}`);

        // Use real wallet address to find your registered price thresholds
        const publisherAddress = (process.env.WALLET_ADDRESS || process.env.PUBLISHER_ADDRESS) as `0x${string}`;
        
        try {
          const all = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisherAddress);
          
          if (!all || all.length === 0) {
            console.log("📝 No price thresholds registered yet.");
            return;
          }

          for (const entry of all) {
            try {
              // Access data by array position - handle both string and object formats
              const phoneHash = ((entry[0] as any)?.value?.value || entry[0]) as string;
              const tokenSymbol = ((entry[1] as any)?.value?.value || entry[1]) as string; 
              const minPrice = Number((entry[2] as any)?.value?.value || entry[2]) / 1e18; // Convert from wei
              const maxPrice = Number((entry[3] as any)?.value?.value || entry[3]) / 1e18; // Convert from wei

              console.log(`🔍 Checking: ${tokenSymbol} ${phoneHash?.slice(0, 10)}... Range: $${minPrice.toFixed(6)} - $${maxPrice.toFixed(6)}`);

              if (price < minPrice || price > maxPrice) {
                console.log(`🚨 PRICE ALERT! ${tokenSymbol} price $${price.toFixed(6)} is outside range $${minPrice.toFixed(6)} - $${maxPrice.toFixed(6)}`);
                console.log(`📱 Alert for: ${phoneHash.slice(0, 10)}...`);

                await sdk.streams.emitEvents([
                  {
                    id: "PriceAlert",
                    argumentTopics: [phoneHash as `0x${string}`],
                    data: encodeAbiParameters(
                      [
                        { type: "uint256", name: "currentPrice" },
                        { type: "uint256", name: "minPrice" },
                        { type: "uint256", name: "maxPrice" },
                        { type: "string", name: "tokenSymbol" }
                      ],
                      [
                        BigInt(Math.floor(price * 1e18)),
                        BigInt(Math.floor(minPrice * 1e18)),
                        BigInt(Math.floor(maxPrice * 1e18)),
                        tokenSymbol
                      ]
                    ),
                  }
                ]);
              }
            } catch (entryError) {
              console.error("❌ Error processing threshold entry:", entryError);
            }
          }
        } catch (sdkError) {
          // Handle the "NoData" error gracefully
          if (sdkError instanceof Error && sdkError.message.includes("NoData")) {
            console.log("📝 No price thresholds registered yet.");
          } else {
            console.error("❌ Error fetching threshold data:", sdkError);
          }
        }
      } catch (intervalError) {
        console.error("❌ Error in monitoring interval:", intervalError);
      }
    }, 10000); // check every 10 seconds
    
  } catch (error) {
    console.error("❌ Error starting price monitor:", error);
  }
}

main();
