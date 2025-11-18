// src/scripts/register-price-alert-event.ts
import { sdk } from "../lib/somnia";

async function main() {
  console.log("Registering PriceAlert event schema...");

  const eventIds = ["PriceAlert"];
  const eventSchemas = [
    {
      params: [
        { name: "phoneHash", paramType: "bytes32", isIndexed: true },
        { name: "currentPrice", paramType: "uint256", isIndexed: false }
      ],
      eventTopic: "PriceAlert(bytes32 indexed phoneHash, uint256 currentPrice)"
    }
  ];

  const tx = await sdk.streams.registerEventSchemas(eventIds, eventSchemas);
  console.log("Event schema registration tx:", JSON.stringify(tx, null, 2));

  console.log("✅ PriceAlert event schema registered!");
}

main().catch(console.error);
