import { handleTransfer } from "../services/transfer/transfer";
import { handleCheckBalance } from "../services/balance/balance";

export async function routeAction(action: any, senderPhone?: string) {
  if (!action) return null; // No structured action → AI-only message

  switch (action.action) {
    case "bind_wallet":
      return `🔗 Wallet received: ${action.wallet}\n(Feature not implemented yet)`;

    case "transfer":
      // Ensure sender_phone is set if provided
      if (senderPhone && !action.sender_phone) {
        action.sender_phone = senderPhone;
      }
      console.log("🚀 Executing transfer with action:", {
        action: action.action,
        amount: action.amount,
        token: action.token,
        recipient_phone: action.recipient_phone,
        sender_phone: action.sender_phone || "not provided"
      });
      return await handleTransfer(action);

    case "check_balance":
      // Ensure sender_phone is set if provided
      if (senderPhone && !action.sender_phone) {
        action.sender_phone = senderPhone;
      }
      console.log("💰 Executing check balance with action:", {
        action: action.action,
        sender_phone: action.sender_phone || "not provided",
        token: action.token || "STT (default)"
      });
      return await handleCheckBalance(action);

    case "price_alert":
      return (
        `⏰ Price alert set:\n` +
        `Token: ${action.token}\n` +
        `Threshold: ${action.threshold_percent}% drop\n` +
        `(Alert service not implemented yet)`
      );

    default:
      return "⚠️ Unknown action received.";
  }
}
