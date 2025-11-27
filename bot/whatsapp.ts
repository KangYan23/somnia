import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID!;

export async function sendWhatsAppMessage(to: string, msg: string) {
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

    console.log(`✅ WhatsApp message sent to ${to}`);
  } catch (e: any) {
    console.error("❌ Sending message failed:", e.response?.data || e);
  }
}

export async function sendWhatsAppInteractiveMessage(to: string, bodyText: string, action: any) {
  try {
    const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: bodyText
        },
        action: action
      }
    };

    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });

    console.log(`✅ WhatsApp interactive message sent to ${to}`);
  } catch (e: any) {
    console.error("❌ Sending interactive message failed:", e.response?.data || e);
  }
}
