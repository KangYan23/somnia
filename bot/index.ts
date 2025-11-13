import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { processNLP } from "./nlp";
import { routeAction } from "./router";

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
    console.log("↩ Ignored: delivery/read status update");
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
  const aiResponse = await processNLP(text);

  // Extract JSON action (if any)
  const actionMatch = aiResponse.match(/json([\s\S]*?)/);
  let action = null;

  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]);
      console.log("🧩 Extracted Action:", action);
    } catch (e) {
      console.error("❌ Failed to parse JSON action:", e);
    }
  }

  // ------------------------------
  // 4. Route action to service (NO ACTUAL ACTION IMPLEMENTED)
  // ------------------------------
  const serviceReply = await routeAction(action);

  const finalReply = serviceReply || aiResponse.replace(/json([\s\S]*?)/g, "").trim();

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

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp bot running on port ${PORT}`);
  console.log(`VERIFY TOKEN = ${VERIFY_TOKEN}`);
});