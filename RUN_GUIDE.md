# Somnia Run Guide

Follow these steps one by one to run the entire flow of the application. You will need **5 separate terminal windows**.

## Prerequisites
- Node.js installed
- Ngrok installed and authenticated
- `.env` files configured in `root` and `bot` directories

---

## Step 1: Start the Bot
**Terminal 1**
Navigate to the `bot` folder and start the bot server.
```bash
cd bot
npm start
```

## Step 2: Start Ngrok
**Terminal 2**
Expose your local bot server (running on port 3000) to the internet.
```bash
ngrok http 3000
```
*Note: Copy the forwarding URL (e.g., `https://xxxx.ngrok-free.app`) and ensure it's updated in your configuration if needed.*

## Step 3: Start Price Watcher
**Terminal 3**
Run the service that monitors token prices.
```bash
cd bot
npm run price-watcher
```

## Step 4: Start Price Listener
**Terminal 4**
Run the service that listens for price alerts and triggers notifications.
```bash
cd bot
npm run price-listener
```

## Step 5: Start Frontend
**Terminal 5**
Run the Next.js frontend application from the root directory.
```bash
# Make sure you are in the root directory (not in bot)
npm run dev
```
