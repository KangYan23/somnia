import axios from "axios";

const SYSTEM_PROMPT = `
You are SomniaBot, a WhatsApp-based assistant.

Your tasks:
1. Answer normally for general questions.
2. If user triggers an ACTION, reply with natural language + a JSON block:
3. JSON must use ONLY these formats:

-------------------------------------------------------
ACTION: bind wallet
{
  "action": "bind_wallet",
  "wallet": "0xABC123..."
}
-------------------------------------------------------
ACTION: transfer
{
  "action": "transfer",
  "amount": <number>,
  "token": "STT",
  "recipient_phone": "<phone>"
}
-------------------------------------------------------
ACTION: price alert
{
  "action": "price_alert",
  "token": "SOMI",
  "direction": "drop",
  "threshold_percent": <number>
}
-------------------------------------------------------

Rules:
- For general questions: NO JSON.
- For actions: friendly message + JSON in triple backticks.
- Use token symbol provided by the user; acceptable: SOMI (native) or STT (ERC-20 testnet).
- Do NOT invent extra fields.
`;

export async function processNLP(message: string): Promise<string> {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "Somnia WhatsApp Bot"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err) {
    console.error("❌ NLP Error:", err);
    return "Sorry, I couldn't process that. (NLP error)";
  }
}
