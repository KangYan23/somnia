# Somnia - AI-Powered Blockchain Wallet Assistant

A comprehensive WhatsApp-based AI assistant that enables seamless blockchain token transfers using phone numbers instead of complex wallet addresses. Built on the Somnia blockchain, this platform combines natural language processing, real-time price monitoring, and an intuitive web dashboard to make cryptocurrency transactions accessible to everyone.

## Overview

Somnia is a full-stack blockchain application that bridges the gap between traditional messaging and decentralized finance. Users can interact with the Somnia blockchain through WhatsApp using natural language, making cryptocurrency transactions as simple as sending a text message. The platform includes:

- **WhatsApp AI Bot**: Natural language processing for blockchain commands
- **Phone-to-Wallet Mapping**: Secure registration linking phone numbers to wallet addresses
- **Token Transfers**: Send STT/SOMI tokens using phone numbers
- **Price Alerts**: Real-time cryptocurrency price monitoring with WhatsApp notifications
- **Transaction Analytics**: Comprehensive web dashboard with charts and insights
- **Balance Checking**: Multi-token and multi-chain balance queries
- **Token Swapping**: Exchange tokens directly through WhatsApp

## Problems

### 1. **Complexity of Blockchain Interactions**
Traditional blockchain wallets require users to:
- Copy and paste long hexadecimal wallet addresses (prone to errors)
- Understand technical concepts like gas fees, nonces, and transaction hashes
- Navigate complex wallet interfaces
- Risk losing funds due to address typos or mistakes

### 2. **Lack of User-Friendly Interfaces**
Most DeFi applications are built for technical users, creating barriers for mainstream adoption:
- Intimidating interfaces with technical jargon
- No natural language interaction

### 3. **Fragmented User Experience**
Users need to switch between multiple platforms:
- Separate apps for messaging and blockchain transactions
- Different interfaces for different blockchain functions
- No unified experience for managing crypto assets

### 4. **Limited Price Monitoring**
Traders and investors struggle with:
- Manual price checking across multiple platforms
- No automated alerts for price movements
- Difficulty setting custom price thresholds
- Lack of real-time notifications

### 5. **Insufficient Transaction Insights**
Users lack visibility into their blockchain activity:
- No easy way to view transaction history
- Limited analytics and reporting
- Difficult to track spending patterns
- No visual representation of financial flows

## Inspiration

Somnia was inspired by the vision of making blockchain technology as accessible as everyday messaging. The project draws inspiration from:

- **WhatsApp's Simplicity**: Leveraging the world's most popular messaging platform to remove barriers to entry
- **AI Assistants**: Following the success of conversational AI interfaces like ChatGPT, making complex tasks accessible through natural language
- **Phone Number as Identity**: Using phone numbers as a universal identifier, similar to how services like Venmo and Cash App simplified payments
- **Real-Time Notifications**: Taking cues from financial apps that provide instant alerts for important events
- **Data Visualization**: Inspired by modern fintech dashboards that make financial data understandable and actionable

The goal is to create a "Venmo for blockchain" - a service so simple that anyone can use it, regardless of their technical knowledge.

## The Solution

Somnia addresses these challenges through a multi-layered architecture:

### 1. **Natural Language Interface**
- **AI-Powered Bot**: Uses OpenAI's GPT-4o-mini to understand user intent from natural language
- **Conversational Commands**: Users can say "send 0.5 STT to 0177163313" instead of dealing with wallet addresses
- **Context-Aware Responses**: The bot understands context and can handle follow-up questions

### 2. **Phone Number Registration System**
- **Secure Mapping**: Phone numbers are hashed (SHA-256) before being stored on-chain
- **Privacy-First**: Phone numbers are never stored in plain text
- **On-Chain Storage**: Registration data is stored on the Somnia blockchain using data streams

### 3. **Simplified Token Transfers**
- **Phone-Based Transfers**: Send tokens using recipient phone numbers
- **Automatic Address Resolution**: System automatically resolves phone numbers to wallet addresses
- **Event-Driven Notifications**: Real-time WhatsApp notifications for transfer confirmations
- **Transaction History**: All transfers are recorded and queryable

### 4. **Intelligent Price Monitoring**
- **Real-Time Price Tracking**: Monitors token prices from CoinGecko API
- **Custom Thresholds**: Users can set minimum and maximum price alerts
- **Automated Alerts**: WhatsApp notifications when prices breach thresholds
- **Multi-Token Support**: Monitor multiple tokens simultaneously

### 5. **Comprehensive Analytics Dashboard**
- **Visual Transaction History**: Interactive charts showing income and expenses
- **Real-Time Updates**: Dashboard polls for new transactions every 10 seconds
- **Advanced Filtering**: Filter by date ranges, transaction types, and tokens
- **Key Metrics**: Net flow, transaction velocity, volume, and more
- **Export Capabilities**: Data table with search and filter options

### 6. **Multi-Service Architecture**
- **Modular Design**: Separate services for different functions (bot, price watcher, listener)
- **Event-Driven**: Uses blockchain events for real-time updates
- **Scalable**: Each service can be scaled independently
- **Fault Tolerant**: Services continue operating even if one component fails

## User Flow

### Registration Flow
1. User opens the web application
2. Connects their wallet (MetaMask/WalletConnect)
3. Enters their phone number
4. Submits registration (transaction sent to blockchain)
5. Phone number is hashed and stored on-chain with wallet address
6. Registration confirmed via transaction receipt

### Transfer Flow (via WhatsApp)
1. User sends WhatsApp message: "send 0.5 STT to 0177163313"
2. Bot processes message using NLP to extract:
   - Action: transfer
   - Amount: 0.5
   - Token: STT
   - Recipient: 0177163313
3. Bot queries blockchain for recipient's wallet address using phone hash
4. If found, bot initiates transfer transaction
5. Transfer confirmed on blockchain
6. Event subscriber detects TransferConfirmed event
7. Bot sends notification to recipient via WhatsApp

### Price Alert Flow
1. User sets price threshold via web app or WhatsApp
2. Price threshold stored on blockchain (min/max prices)
3. Price watcher service monitors token prices every 15 seconds
4. When price breaches threshold, watcher emits PriceAlert event
5. Price listener service subscribes to PriceAlert events
6. Listener looks up user's phone number from phone hash
7. WhatsApp notification sent to user with price details

### Transaction History Flow
1. User navigates to transaction history page
2. System queries blockchain for all transactions
3. Transactions are processed and categorized (sent/received)
4. Dashboard displays:
   - Summary cards (net flow, total transactions, volume)
   - Interactive charts (income/expense trends)
   - Transaction table with filtering
5. Real-time polling updates dashboard every 10 seconds

### Balance Check Flow (via WhatsApp)
1. User sends: "check balance" or "what's my STT balance?"
2. Bot extracts action and token (if specified)
3. Bot queries blockchain for user's wallet balance
4. Bot formats and sends balance information via WhatsApp
5. Supports checking all balances across chains if requested

## Tech Stack

### Frontend
- **Framework**: Next.js 16.0.2 (React 19.2.0)
- **Language**: TypeScript 5.9.3
- **Styling**: Tailwind CSS 4.x
- **UI Components**: 
  - Radix UI (Dialog, Dropdown, Select, etc.)
  - shadcn/ui components
  - Custom components
- **Blockchain Integration**:
  - Wagmi 2.12.5 (React hooks for Ethereum)
  - Viem 2.37.13 (TypeScript Ethereum library)
  - RainbowKit 2.1.2 (Wallet connection UI)
- **Charts & Visualization**:
  - Recharts 2.15.4
  - Framer Motion 12.23.24 (animations)
- **Data Management**:
  - TanStack React Query 5.90.9
  - TanStack React Table 8.21.3
- **Icons**: Lucide React 0.554.0

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5.1.0
- **Language**: TypeScript
- **Blockchain SDK**: @somnia-chain/streams 0.9.5
- **HTTP Client**: Axios 1.13.2
- **Environment**: dotenv 17.2.3

### AI & NLP
- **Provider**: OpenAI GPT-4o-mini
- **Integration**: Axios for API calls
- **Processing**: Custom prompt engineering for action extraction

### Blockchain
- **Network**: Somnia Testnet
- **RPC**: Custom RPC endpoints (HTTP and WebSocket)
- **Data Storage**: Somnia Data Streams
- **Event System**: Somnia Event Subscriptions
- **Wallet**: Viem wallet client with private key authentication

### External Services
- **WhatsApp**: Meta WhatsApp Business API
- **Price Data**: CoinGecko API
- **Tunneling**: Ngrok (for local development)

### Development Tools
- **Package Manager**: npm
- **Build Tool**: Next.js built-in
- **Linting**: ESLint 9.x
- **Type Checking**: TypeScript
- **Code Execution**: ts-node, tsx

### Infrastructure
- **Web Server**: Express.js (bot server)
- **WebSocket**: Native WebSocket support for real-time subscriptions
- **File System**: Node.js fs for data persistence
- **Environment**: Environment variables for configuration

## Key Features

### 1. **WhatsApp Integration**
- Webhook-based message handling
- Interactive button replies for confirmations
- Real-time message delivery
- Support for text and interactive messages

### 2. **Blockchain Data Streams**
- Schema-based data storage
- Publisher-subscriber model
- Query by key or schema
- Event emission and subscription

### 3. **Event-Driven Architecture**
- TransferIntentCreated events
- TransferConfirmed events
- PriceAlert events
- Real-time event subscriptions

### 4. **Security Features**
- Phone number hashing (SHA-256)
- Private key management
- Transaction signing
- Secure WebSocket connections

### 5. **Analytics & Reporting**
- Transaction categorization
- Time-series data visualization
- Custom date range filtering
- Export capabilities
- Real-time updates

## Project Structure

```
somnia/
├── bot/                    # WhatsApp bot server
│   ├── index.ts           # Main bot server
│   ├── nlp.ts             # NLP processing
│   ├── router.ts          # Action routing
│   ├── whatsapp.ts        # WhatsApp API integration
│   └── subscriber.ts     # Event subscribers
├── components/            # Shared React components
│   ├── data-table/        # Data table components
│   └── ui/                # UI components
├── services/              # Business logic services
│   ├── balance/          # Balance checking
│   ├── price-alert/      # Price monitoring
│   │   ├── watcher.ts    # Price watcher service
│   │   └── listener.ts   # Price alert listener
│   ├── swap/             # Token swapping
│   ├── transfer/         # Token transfers
│   └── transaction-history/ # Transaction queries
├── src/                   # Next.js application
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── lib/              # Utility libraries
│   ├── pages/            # Next.js pages
│   │   ├── api/          # API routes
│   │   └── transactions/ # Transaction pages
│   ├── scripts/          # Utility scripts
│   └── styles/           # Global styles
└── data/                  # Data files
    ├── price-thresholds.json
    └── user-map.json
```

## Usage Examples

### Register Phone Number
1. Open the web app
2. Connect your wallet
3. Enter your phone number (e.g., +60123456789)
4. Click "Register"
5. Confirm the transaction in your wallet

### Send Token via WhatsApp
Send a message to the bot:
```
send 0.5 STT to 0177163313
```

### Check Balance via WhatsApp
```
check balance
check my STT balance
check all balance
```

### Set Price Alert
1. Open the web app
2. Enter phone number
3. Set token symbol (STT/SOMI)
4. Set min and max prices
5. Click "Set Price Threshold"

### View Transaction History
1. Navigate to `/transactions/[wallet-address]`
2. View charts and analytics
3. Filter by date range
4. Search transactions


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


## Acknowledgments

- Somnia blockchain team for the excellent SDK and infrastructure
- OpenAI for the powerful language models
- Meta for the WhatsApp Business API
- CoinGecko for price data
- The open-source community for the amazing tools and libraries

## Support

For issues, questions, or contributions, please open an issue on the repository.

---
