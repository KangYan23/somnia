import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { processNLP } from "./nlp";
import { routeAction } from "./router";
import { normalizePhone } from "../src/lib/phone";
import { startEventSubscribers } from "./subscriber";

dotenv.config();

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID!;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN!;
const PORT = process.env.PORT || 3000;

// ------------------------------
// 1. WEBHOOK VERIFICATION
// ------------------------------
app.get("/webhook", (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } catch (error) {
    console.error("Webhook verification error:", error);
    res.sendStatus(500);
  }
});

// ------------------------------
// 2. HANDLE INCOMING MESSAGES
// ------------------------------
app.post("/webhook", async (req, res) => {
  console.log("🔥 Incoming webhook:", JSON.stringify(req.body, null, 2));

  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  // Ignore read / delivered status
  if (value?.statuses) {
    console.log("↩️ Ignored: delivery/read status update");
    return res.sendStatus(200);
  }

  const message = value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const text = message.text?.body;

  console.log("📩 Message from:", from);
  console.log("💬 User said:", text);

  // ------------------------------
  // 3. NLP PROCESSING
  // ------------------------------
  console.log("🤖 Starting NLP processing...");
  const aiResponse = await processNLP(text);
  console.log("🤖 NLP Response:", aiResponse);

  // Extract JSON action (if any)
  const actionMatch = aiResponse.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
  let action = null;

  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]);
      console.log("🧩 Extracted Action:", action);
    } catch (e) {
      console.error("❌ Failed to parse JSON action:", e);
    }
  } else {
    console.log("ℹ️ No JSON action found in response");
  }

  // ------------------------------
  // 4. Route action to service
  // ------------------------------
  // Normalize sender phone from WhatsApp (from field is the phone number)
  let senderPhoneNormalized: string | undefined;
  try {
    // WhatsApp phone numbers come in format like "1234567890" or with country code
    // Normalize it to ensure consistent format
    senderPhoneNormalized = normalizePhone(from);
    console.log("📱 Sender phone normalized:", senderPhoneNormalized);
  } catch (e) {
    console.warn("⚠️ Failed to normalize sender phone:", e);
    // Continue without sender phone if normalization fails
  }

  // Add sender_phone to action if it needs it (transfer, check_balance)
  if (action && senderPhoneNormalized) {
    if (action.action === "transfer" || action.action === "check_balance") {
      action.sender_phone = senderPhoneNormalized;
      console.log(`✅ Added sender_phone to ${action.action} action:`, senderPhoneNormalized);
    }
  }

  // Fallback: Check original message for "all" keyword if check_balance action
  // This handles cases where NLP didn't extract "all" in token field
  if (action && action.action === "check_balance" && text) {
    const textLower = text.toLowerCase();
    if ((textLower.includes("all") || textLower.includes("every")) && !action.token) {
      action.token = "all";
      console.log(`✅ Detected "all" keyword in message, setting token to "all"`);
    }
  }

  console.log("🚀 Routing action:", action);
  let serviceReply;
  try {
    serviceReply = await routeAction(action, senderPhoneNormalized);
    console.log("🚀 Service reply:", serviceReply);
  } catch (error) {
    console.error("❌ Action execution failed:", error);
    serviceReply = `❌ Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  const finalReply = serviceReply || aiResponse.replace(/```(?:json)?\s*{[\s\S]*?}\s*```/g, "").trim();
  console.log("📤 Final reply to user:", finalReply);

  await sendWhatsAppMessage(from, finalReply);

  res.sendStatus(200);
});

// ------------------------------
// 5. SEND MESSAGE TO USER
// ------------------------------
async function sendWhatsAppMessage(to: string, msg: string) {
  try {
    const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      text: { body: msg }
    };

    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });

    console.log("✅ WhatsApp message sent!");
  } catch (e: any) {
    console.error("❌ Sending message failed:", e.response?.data || e);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 WhatsApp bot running on port ${PORT}`);
  console.log(`VERIFY TOKEN = ${VERIFY_TOKEN}`);
  console.log('');
  
  // Start event subscribers (for transfer notifications)
  console.log('📡 Starting event subscribers...');
  try {
    await startEventSubscribers();
    console.log('✅ All services started successfully!\n');
  } catch (error: any) {
    console.error('⚠️ Failed to start event subscribers:', error.message);
    console.error('   Bot will continue running, but notifications may not work.');
    console.error('   Check RPC_WS_URL and subscriber configuration.\n');
  }
});
