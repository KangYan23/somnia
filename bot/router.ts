export async function routeAction(action: any) {
    if (!action) return null; // No structured action → AI-only message
  
    switch (action.action) {
      case "bind_wallet":
        return `🔗 Wallet received: ${action.wallet}\n(Feature not implemented yet)`;
  
      case "transfer":
        return (
          `📤 Transfer request received:\n` +
          `Amount: ${action.amount} ${action.token}\n` +
          `To: ${action.recipient_phone}\n` +
          `(Transfer service not implemented yet)`
        );
  
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
  