// services/price-alert/listener.ts
import * as dotenv from 'dotenv';
import path from 'path';
// Try to load .env from root (../../.env) or current directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { SDK } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, webSocket, decodeAbiParameters } from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';
import fs from 'fs';

import { buildSomniaChainWithWs } from '../../src/lib/somniaChain';
import { sendWhatsAppMessage } from '../../bot/whatsapp';

const USER_MAP_PATH = path.join(process.cwd(), "..", "services", "price-alert", "data", "user-map.json");
// Note: Adjust path if running from 'bot' folder or 'services' folder. 
// If running via 'npm run price-listener' from 'bot' folder, process.cwd() is 'bot'.
// So data is at ../services/price-alert/data/user-map.json
// Let's make it robust.

function getUserPhoneNumber(phoneHash: string): string | null {
    try {
        // Try multiple paths to find the file
        const pathsToTry = [
            path.join(process.cwd(), "data", "user-map.json"), // if running from services/price-alert
            path.join(process.cwd(), "..", "services", "price-alert", "data", "user-map.json"), // if running from bot
            path.join(__dirname, "data", "user-map.json") // relative to this file
        ];

        let mapPath = "";
        for (const p of pathsToTry) {
            if (fs.existsSync(p)) {
                mapPath = p;
                break;
            }
        }

        if (!mapPath) {
            console.warn("⚠️ Could not find user-map.json in expected locations.");
            return null;
        }

        const map = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
        return map[phoneHash] || null;
    } catch (e) {
        console.error("❌ Error reading user map:", e);
        return null;
    }
}

async function main() {
    try {
        console.log("🚀 Starting Price Alert Listener Service...");

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

        await wsSDK.streams.subscribe({
            somniaStreamsEventId: "PriceAlert",
            ethCalls: [],
            onlyPushChanges: false,

            async onData(data: any) {
                try {
                    console.log("🚨 Price Alert Event Received!");

                    if (data.data) {
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
                        const phoneHash = data.topics?.[1];

                        console.log(`📱 Phone Hash: ${phoneHash?.slice(0, 10)}...`);
                        console.log(`💰 Price: $${currentPrice.toFixed(4)} (Range: $${minPrice.toFixed(4)} - $${maxPrice.toFixed(4)})`);

                        if (phoneHash) {
                            const phoneNumber = getUserPhoneNumber(phoneHash);

                            if (phoneNumber) {
                                console.log(`📨 Sending WhatsApp message to ${phoneNumber}...`);

                                let msg = `🚨 *PRICE ALERT: ${tokenSymbol}*\n\n`;
                                msg += `Current Price: *$${currentPrice.toFixed(4)}*\n`;

                                if (currentPrice < minPrice) {
                                    msg += `📉 Price dropped below your minimum of $${minPrice.toFixed(4)}`;
                                } else if (currentPrice > maxPrice) {
                                    msg += `📈 Price rose above your maximum of $${maxPrice.toFixed(4)}`;
                                } else {
                                    msg += `⚠️ Price alert triggered (Check range)`;
                                }

                                await sendWhatsAppMessage(phoneNumber, msg);
                            } else {
                                console.log("⚠️ No phone number found for this hash. User might not have registered via bot.");
                            }
                        }
                    }
                } catch (error) {
                    console.error("❌ Error processing price alert:", error);
                }
            },

            onError(err: any) {
                console.error("❌ Subscription Error:", err);
                // Auto-reconnect
                setTimeout(() => {
                    console.log("🔄 Reconnecting...");
                    main();
                }, 5000);
            },
        });

    } catch (error) {
        console.error("❌ Error starting listener:", error);
    }
}

main();
