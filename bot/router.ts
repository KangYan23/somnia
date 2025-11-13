import { handleTransfer } from "./services/transfer/transfer";

export async function routeAction(action: any) {
  if (!action) return null; // No structured action → AI-only message

  switch (action.action) {
    case "bind_wallet":
      return `🔗 Wallet received: ${action.wallet}\n(Feature not implemented yet)`;

    case "transfer":
      return await handleTransfer(action);

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
