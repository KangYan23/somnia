# Somnia - Web3 Made Simple

> **Send crypto like a text message. No seed phrases. No hex addresses. Just phone numbers.**

Somnia is a revolutionary Web3 platform that makes blockchain transactions as simple as sending a WhatsApp message. Built on the Somnia blockchain, it eliminates the complexity barriers that prevent mainstream adoption of cryptocurrency.

---

## 📋 Overview

Somnia transforms the Web3 experience by replacing complex cryptographic addresses with familiar phone numbers. Users can send, receive, and manage cryptocurrency through WhatsApp, making blockchain technology accessible to everyone—not just crypto experts.

**Key Innovation**: Instead of copying and pasting long hex addresses like `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`, users simply send tokens to phone numbers like `+60177163313`.

---

## 🚨 Problem Statement

### 1. Overwhelming Onboarding: Web3 users are blocked by seed phrases and private keys

Traditional Web3 onboarding requires users to:
- Safely store 12-24 word seed phrases
- Understand private key management
- Navigate complex wallet interfaces
- Risk permanent loss of funds if keys are lost

### 2. High-Risk Transactions: Hex addresses are unreadable (e.g., `0x71C...f44e`)

Sending cryptocurrency traditionally requires:
- Copying long, error-prone hex addresses
- Verifying addresses character-by-character
- No human-readable identifiers
- High risk of sending to wrong addresses

### 3. Zero Safety Net: No automated protection against hacks or price drops

Current Web3 lacks:
- Automated price alerts
- Transaction monitoring
- Proactive security notifications
- Risk management tools

---

## 💡 Inspiration

Somnia was inspired by the simplicity of traditional financial services:

- **Venmo/PayPal**: Send money using phone numbers or usernames
- **WhatsApp**: Universal messaging platform with 2+ billion users
- **Banking Apps**: Familiar interfaces that people already trust

**Vision**: Make Web3 as easy as sending a text message, while maintaining the security and decentralization of blockchain technology.

---

## ✨ The Solution

Somnia solves all three core problems:

### 🔐 Simplified Onboarding
- **Phone Number Registration**: Link your phone number to your wallet address once
- **No Seed Phrases**: Users manage funds through WhatsApp without handling private keys
- **Familiar Interface**: WhatsApp interface that billions already know how to use simpler the wallet interactions

### 📱 Human-Readable Transactions
- **Phone-to-Phone Transfers**: Send tokens using phone numbers instead of hex addresses
- **Natural Language Processing**: AI-powered bot understands commands like "send 0.5 STT to 0177163313"
- **Transaction History**: View all transactions in a readable format with phone numbers and track all activity with visual charts and analytics

### 🛡️ Automated Protection
- **Price Alerts**: Get notified when token prices move outside your set thresholds
- - **Optional Swap**: User able to swap their tokens as needed.
- **Transaction Notifications**: Real-time WhatsApp notifications for all transfers

---

## 🎯 Key Features

### 💰 **Phone-to-Phone Transfers**
- Send STT/SOMI tokens using phone numbers
- Natural language commands: "send 0.5 STT to 0177163313"
- Automatic recipient lookup from phone number
- Real-time WhatsApp notifications for sender and receiver

### 📊 **Multi-Chain Balance Checking**
- Check balances across multiple chains
- Support for native tokens (STT, SOMI, ETH)
- ERC-20 token support (USDC, USDT, etc.)
- "Check all balances" for comprehensive overview

### 📈 **Price Alerts**
- Set min/max price thresholds for any token
- Percentage-based or absolute price alerts
- Real-time monitoring via blockchain events
- Instant WhatsApp notifications when thresholds are reached

### 📜 **Transaction History**
- View all transactions in readable format
- Phone number-based transaction lookup
- Visual charts showing income and expenses
- Web interface for detailed analytics
- Transaction links to blockchain explorer

### 🔄 **Token Swapping**
- Swap tokens directly via WhatsApp
- Support for STT ↔ USDC swaps
- Interactive confirmation buttons
- Automatic gas fee management

### 🤖 **AI-Powered Bot**
- Natural language understanding
- Context-aware responses
- Multi-action support in single message
- Friendly, conversational interface

### 🔔 **Real-Time Notifications**
- Transfer confirmations via WhatsApp
- Price alert notifications
- Transaction status updates
- Event-driven architecture

### 🛡️ **Security Features**
- Wallet connection via MetaMask/RainbowKit
- On-chain data storage for registrations
- Transaction verification before execution
- Nonce management for reliable transactions

---

## 🌐 High Level Architecture Diagram

```
<img width="1067" height="593" alt="image" src="https://github.com/user-attachments/assets/ef6f9093-e67b-400b-bbc9-aba6147a3b72" />
```

---

## 🔄 User Flow

### 1. **Registration** (One-Time Setup)
```
User → Web App → Connect Wallet → Link Phone Number → Done
```
- User visits web app and connects their existing wallet
- Links their phone number to their wallet address
- Registration stored on Somnia blockchain data streams

### 2. **Sending Tokens** (Via WhatsApp)
```
User → WhatsApp: "send 0.5 STT to 0177163313"
     → Bot processes request
     → Transaction executed on blockchain
     → Both parties receive WhatsApp confirmation
```

### 3. **Checking Balance**
```
User → WhatsApp: "check balance"
     → Bot queries blockchain
     → Returns formatted balance
```

### 4. **Price Alerts**
```
User → WhatsApp: "alert me when STT drops 10%"
     → Bot sets price threshold
     → Monitors price continuously
     → Sends alert when threshold reached
```

### 4. **Swap function**
```
User → WhatsApp: "swap 2 USDC TO STT"
     → Bot check the wallet balance
     → Bot swap token accordingly
     → Returns transaction hash
```

### 5. **Transaction History**
```
User → WhatsApp: "show recent transactions"
     → Bot queries transaction history
     → Returns formatted list with links
     → User can view detailed history on web
```

---

## 🛠️ Tech Stack

### **Frontend**
- **Next.js 16** - React framework with server-side rendering
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **RainbowKit** - Wallet connection UI
- **Viem** - Ethereum library for blockchain interactions

### **Backend**
- **Express.js** - WhatsApp bot server
- **Node.js** - Runtime environment
- **WhatsApp Business API** - Messaging platform
- **OpenAI GPT-4** - Natural language processing

### **Blockchain**
- **Somnia Chain** - Custom blockchain with data streams
- **Somnia SDK** - Blockchain interaction library
- **Viem** - Low-level blockchain utilities
- **WebSocket** - Real-time event subscriptions

### **Infrastructure**
- **Ngrok** - Webhook tunneling for development
- **Environment Variables** - Configuration management
- **Data Streams** - On-chain data storage

### **Key Libraries**
- `@somnia-chain/streams` - Somnia blockchain SDK
- `viem` - Ethereum TypeScript library
- `axios` - HTTP client
- `dotenv` - Environment configuration

---

Developed by IntelliPaper

---

**Built with ❤️ on the Somnia blockchain**

