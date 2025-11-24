import { handleTransfer } from "../services/transfer/transfer";
import { handleCheckBalance } from "../services/balance/balance";
import { handleTransactionHistory } from "../services/transaction-history/handler";
import { handleSwap } from "../services/swap/swap";

export async function routeAction(action: any, senderPhone?: string) {
  if (!action) return null; // No structured action → AI-only message

  switch (action.action) {
    case "swap":
      // Return interactive message structure for index.ts to handle
      return {
        type: "interactive",
        body: `You want to swap ${action.amount} ${action.tokenFrom} to ${action.tokenTo}.\n\nDo you want to proceed?`,
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `confirm_swap:${action.amount}:${action.tokenFrom}:${action.tokenTo}`,
                title: "Yes"
              }
            },
            {
              type: "reply",
              reply: {
                id: "cancel_swap",
                title: "No"
              }
            }
          ]
        }
      };

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

    case "transaction_history":
      // Ensure sender_phone is set if provided
      if (senderPhone && !action.sender_phone) {
        action.sender_phone = senderPhone;
      }
      console.log("📋 Executing transaction history with action:", {
        action: action.action,
        sender_phone: action.sender_phone || "not provided",
        limit: action.limit || 10
      });
      return await handleTransactionHistory(action);

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
