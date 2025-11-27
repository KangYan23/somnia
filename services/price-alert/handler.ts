import { sdk, walletClient, somniaTestnet, account } from "../../src/lib/somnia";
import { sendWhatsAppMessage } from "../../bot/whatsapp";
import { hashPhone } from "../../src/lib/phone";
import { encodeAbiParameters, parseUnits, parseAbi } from "viem";
import fs from "fs";
import path from "path";

// 🧾 On-chain schema ID for priceThreshold
const PRICE_THRESHOLD_SCHEMA_ID =
  "0x2b9ecdb54560ad5c48f26b46e029f4b9b05dda40e5b5e3daa532abc910e64455";

// 🌐 Somnia Data Stream contract address
const CONTRACT_ADDRESS = "0x6AB397FF662e42312c003175DCD76EfF69D048Fc";

// 🧠 ABI (minimal version for writing data)
const dataStreamAbi = parseAbi([
  "function set(bytes32 schemaId, bytes data) external returns (bytes32 recordId)",
]);

const USER_MAP_PATH = path.join(process.cwd(), "data", "user-map.json");

function saveUserMapping(phoneHash: string, phoneNumber: string) {
  try {
    let map: Record<string, string> = {};
    if (!fs.existsSync(path.dirname(USER_MAP_PATH))) {
      fs.mkdirSync(path.dirname(USER_MAP_PATH), { recursive: true });
    }
    if (fs.existsSync(USER_MAP_PATH)) {
      map = JSON.parse(fs.readFileSync(USER_MAP_PATH, "utf-8"));
    }
    map[phoneHash] = phoneNumber;
    fs.writeFileSync(USER_MAP_PATH, JSON.stringify(map, null, 2));
    console.log(`💾 Saved user mapping: ${phoneHash.slice(0, 10)}... -> ${phoneNumber}`);
  } catch (e) {
    console.error("❌ Failed to save user mapping:", e);
  }
}

export async function handleSetPriceAlert(action: any) {
  try {
    const { token, threshold_percent, target_price, direction, sender_phone } = action;

    if (!sender_phone) {
      return "❌ Error: Sender phone number not found.";
    }

    if (!token || (!threshold_percent && !target_price)) {
      return "❌ Please specify the token and either a percentage or exact price (e.g., 'Alert me when STT drops 10%' or 'Alert me at 0.23').";
    }

    console.log(`🔔 Setting price alert for ${sender_phone}: ${token} ${direction || 'moves'} ${target_price ? 'to ' + target_price : threshold_percent + '%'}`);

    // 1. Hash phone number
    const phoneHash = hashPhone(sender_phone);

    // 2. Save mapping for the subscriber to use later
    saveUserMapping(phoneHash, sender_phone);

    // 3. Calculate min/max price
    // Fetch current price (mock or real)
    let currentPrice = 0.26; // Default fallback
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=somnia&vs_currencies=usd");
      const data = await res.json() as any;
      if (data.somnia?.usd) {
        currentPrice = data.somnia.usd;
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch current price, using default $0.26");
    }

    let minPrice = 0;
    let maxPrice = 1000000; // High default max

    if (target_price) {
      const target = parseFloat(target_price);
      if (direction === "drop" || direction === "below" || direction === "down") {
        minPrice = target;
        maxPrice = 999999;
      } else if (direction === "rise" || direction === "above" || direction === "up") {
        minPrice = 0;
        maxPrice = target;
      } else {
        // If direction ambiguous but target set, assume alert if it CROSSES this price.
        if (currentPrice > target) {
          minPrice = target;
          maxPrice = 999999;
        } else {
          minPrice = 0;
          maxPrice = target;
        }
      }
    } else {
      const percent = parseFloat(threshold_percent);

      if (direction === "drop" || direction === "below" || direction === "down") {
        minPrice = currentPrice * (1 - percent / 100);
        maxPrice = 999999;
      } else if (direction === "rise" || direction === "above" || direction === "up") {
        minPrice = 0;
        maxPrice = currentPrice * (1 + percent / 100);
      } else {
        // "moves 10%" -> both directions
        minPrice = currentPrice * (1 - percent / 100);
        maxPrice = currentPrice * (1 + percent / 100);
      }
    }

    // 4. Encode data
    const minPriceWei = parseUnits(minPrice.toFixed(18), 18); // Ensure string format
    const maxPriceWei = parseUnits(maxPrice.toFixed(18), 18);
    const updatedAt = BigInt(Math.floor(Date.now() / 1000));

    console.log("📝 Encoding Data:", {
      phoneHash,
      token,
      minPrice: minPrice.toFixed(6),
      maxPrice: maxPrice.toFixed(6),
      minPriceWei: minPriceWei.toString(),
      maxPriceWei: maxPriceWei.toString(),
      updatedAt: updatedAt.toString()
    });

    const encoded = encodeAbiParameters(
      [
        { type: "bytes32", name: "phoneHash" },
        { type: "string", name: "tokenSymbol" },
        { type: "uint256", name: "minPrice" },
        { type: "uint256", name: "maxPrice" },
        { type: "uint64", name: "updatedAt" },
      ],
      [phoneHash as `0x${string}`, token, minPriceWei, maxPriceWei, updatedAt]
    );

    // 5. Write to contract
    // We use the bot's wallet (configured in .env)
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: dataStreamAbi,
      functionName: "set",
      args: [PRICE_THRESHOLD_SCHEMA_ID, encoded],
      chain: somniaTestnet,
      account,
      gas: 500000n // Manual gas limit to avoid estimation errors
    });

    // --- DEMO: Instant Alert Trigger ---
    // Send these messages asynchronously so we don't block the main return
    (async () => {
      try {
        // Wait a bit to let the first message arrive
        await new Promise(r => setTimeout(r, 2000));

        // 1. Send current price message
        await sendWhatsAppMessage(sender_phone, `Current price fetched from coingeckco: $${currentPrice}`);

        // Wait another bit
        await new Promise(r => setTimeout(r, 1000));

        // 2. Send trigger message
        await sendWhatsAppMessage(sender_phone, `🚨 Price Alert Triggered: The market price has reached your set limit.`);
      } catch (err) {
        console.error("❌ Demo alert failed:", err);
      }
    })();
    // -----------------------------------

    return `✅ Price alert set for ${token}!\n\n📉 Alert if below: $${minPrice.toFixed(4)}\n📈 Alert if above: $${maxPrice > 9999 ? '∞' : maxPrice.toFixed(4)}\n\nTx: ${txHash}`;

  } catch (error: any) {
    console.error("❌ Error setting price alert:", error);
    return `❌ Failed to set price alert: ${error.message}`;
  }
}
