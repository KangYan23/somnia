// services/balance/balance.ts
import { publicClient, account } from "../../src/lib/somnia";
import { formatEther, formatUnits, createPublicClient, http } from "viem";
import { sepolia, mainnet } from "viem/chains";

// ERC-20 ABI for balanceOf and decimals
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

// Token registry: map token symbols to contract addresses
// Can be extended via environment variables or config
const TOKEN_REGISTRY: Record<string, `0x${string}`> = {
  // Add your ERC-20 token addresses here
  // Example: "USDT": "0x...",
  // Example: "USDC": "0x...",
};

// Load token addresses from environment variables (format: TOKEN_ADDRESS_USDT=0x...)
function loadTokenAddressesFromEnv() {
  const env = process.env;
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("TOKEN_ADDRESS_") && value) {
      const tokenSymbol = key.replace("TOKEN_ADDRESS_", "").toUpperCase();
      if (value.startsWith("0x") && value.length === 42) {
        TOKEN_REGISTRY[tokenSymbol] = value as `0x${string}`;
        console.log(`📝 Loaded token ${tokenSymbol}: ${value}`);
      }
    }
  }
}

// Initialize token registry on module load
loadTokenAddressesFromEnv();

// Chain registry: map chain names to viem chain objects and RPC URLs
// Using more reliable public RPC endpoints with fallbacks
const CHAIN_REGISTRY: Record<string, { chain: any; rpcUrl?: string }> = {
  SEPOLIA: { 
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/DyJMYWQ4BnJoguxZ-lG-8"
  },
  ETHEREUM: { 
    chain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com"
  },
  MAINNET: { 
    chain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com"
  },
  ETH: { 
    chain: mainnet,
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com"
  },
};

// Parse token and chain from input (e.g., "sepolia eth", "eth sepolia", "sepolia", "all")
function parseTokenAndChain(input: string | null): { token: string; chain?: string; checkAll?: boolean } {
  if (!input) return { token: "STT" };
  
  const parts = input.toUpperCase().split(/\s+/);
  const chainNames = Object.keys(CHAIN_REGISTRY);
  
  // Check for "all" keyword
  if (parts.includes("ALL")) {
    return { token: "", chain: undefined, checkAll: true };
  }
  
  // Check if any part is a chain name
  // IMPORTANT: Only set chain once (first match) to avoid overwriting
  // e.g., "sepolia eth" should be chain=SEPOLIA, token=ETH (not chain=ETH)
  let chain: string | undefined;
  let tokenParts: string[] = [];
  
  for (const part of parts) {
    // Only set chain if not already set (prioritize first chain match)
    if (!chain && chainNames.includes(part)) {
      chain = part;
    } else if (!chainNames.includes(part)) {
      // Only add to tokenParts if it's not a chain name
      tokenParts.push(part);
    } else {
      // If chain is already set and this part is also a chain name, treat it as token
      // e.g., "sepolia eth" -> chain=SEPOLIA (first), token=ETH (even though ETH is also a chain)
      tokenParts.push(part);
    }
  }
  
  const token = tokenParts.join(" ") || "";
  
  // Special handling for multi-chain scenarios
  // If chain is specified and token is empty or ETH, default to ETH for that chain
  if (chain) {
    if (token === "" || token === "ETH") {
      return { token: "ETH", chain };
    }
    // If chain is specified and token is something else, use that token on that chain
    return { token, chain };
  }
  
  // No chain specified - default to Somnia chain
  // If token is empty, default to STT
  if (token === "") {
    return { token: "STT" };
  }
  
  // If token is ETH but no chain, check if it's a chain name (ETH = Ethereum mainnet)
  if (token === "ETH" && chainNames.includes("ETH")) {
    return { token: "ETH", chain: "ETH" };
  }
  
  return { token };
}

// Get public client for a specific chain
function getPublicClientForChain(chainName: string) {
  const chainConfig = CHAIN_REGISTRY[chainName.toUpperCase()];
  if (!chainConfig) {
    throw new Error(`Chain ${chainName} not supported. Supported chains: ${Object.keys(CHAIN_REGISTRY).join(", ")}`);
  }
  
  // Add timeout and retry configuration for better reliability
  return createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl, {
      timeout: 10000, // 10 second timeout
      retryCount: 2,  // Retry up to 2 times
      retryDelay: 1000 // Wait 1 second between retries
    })
  });
}

// Check all balances across all chains and tokens
async function checkAllBalances(walletAddress: `0x${string}`): Promise<string> {
  const balances: string[] = [];
  balances.push(`💰 *All Balances*\n`);
  balances.push(`🔗 Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\n\n`);

  // 1. Check Somnia native tokens (STT/SOMI)
  try {
    const somniaBalance = await publicClient.getBalance({ address: walletAddress });
    const somniaFormatted = formatEther(somniaBalance);
    if (somniaFormatted !== "0") {
      balances.push(`🌐 *Somnia*\n   STT: *${somniaFormatted}*\n`);
    }
  } catch (e: any) {
    // Skip errors - only show successful balances
  }

  // 2. Check Sepolia ETH
  try {
    const sepoliaClient = getPublicClientForChain("SEPOLIA");
    const sepoliaBalance = await sepoliaClient.getBalance({ address: walletAddress });
    const sepoliaFormatted = formatEther(sepoliaBalance);
    if (sepoliaFormatted !== "0") {
      balances.push(`🌐 *Sepolia Testnet*\n   ETH: *${sepoliaFormatted}*\n`);
    }
  } catch (e: any) {
    // Skip errors - only show successful balances
  }

  // 3. Check Ethereum Mainnet ETH
  try {
    const mainnetClient = getPublicClientForChain("ETHEREUM");
    const mainnetBalance = await mainnetClient.getBalance({ address: walletAddress });
    const mainnetFormatted = formatEther(mainnetBalance);
    if (mainnetFormatted !== "0") {
      balances.push(`🌐 *Ethereum Mainnet*\n   ETH: *${mainnetFormatted}*\n`);
    }
  } catch (e: any) {
    // Skip errors - only show successful balances
  }

  // 4. Check all registered ERC-20 tokens on Somnia
  const registeredTokens = Object.keys(TOKEN_REGISTRY);
  if (registeredTokens.length > 0) {
    let hasTokenSection = false;
    for (const tokenSymbol of registeredTokens) {
      try {
        const tokenAddress = TOKEN_REGISTRY[tokenSymbol];
        let decimals = 18;
        try {
          decimals = await (publicClient.readContract as any)({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
            args: [],
          }) as number;
        } catch (e) {
          // Use default 18
        }
        
        const balance = await (publicClient.readContract as any)({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletAddress],
        }) as bigint;
        
        const balanceFormatted = formatUnits(balance, decimals);
        if (balanceFormatted !== "0") {
          if (!hasTokenSection) {
            balances.push(`\n📄 *ERC-20 Tokens (Somnia)*\n`);
            hasTokenSection = true;
          }
          balances.push(`   ${tokenSymbol}: *${balanceFormatted}*\n`);
        }
      } catch (e: any) {
        // Skip errors - only show successful balances
      }
    }
  }

  // If no balances found, show a message
  if (balances.length === 2) { // Only header lines
    balances.push(`💡 No balances found (all are zero).`);
  }

  return balances.join("");
}

export async function handleCheckBalance(action: {
  sender_phone?: string;
  token?: string; // Optional: "STT", "SOMI", "ETH", "sepolia eth", "eth sepolia", "all", etc.
}) {
  const { token } = action;

  console.log("Executing check balance action:", action);

  // HACK: Directly use the wallet from environment private key
  // Skip phone registration lookup - just check the balance of the configured wallet
  const walletAddress = account.address;
  console.log("💰 Checking balance for wallet:", walletAddress);

  // Parse token and chain from input
  const { token: parsedToken, chain: parsedChain, checkAll } = parseTokenAndChain(token || null);
  
  // Handle "check all" request
  if (checkAll) {
    console.log("📊 Checking all balances across all chains...");
    try {
      return await checkAllBalances(walletAddress as `0x${string}`);
    } catch (error: any) {
      console.error("Failed to check all balances:", error.message);
      throw new Error(`Failed to check all balances: ${error.message}`);
    }
  }
  
  const tokenUpper = parsedToken.toUpperCase();
  
  console.log(`   Parsed token: ${tokenUpper}, chain: ${parsedChain || "Somnia (default)"}`);

  // Query balance from blockchain
  try {
    // Handle different chains
    if (parsedChain) {
      // Multi-chain support: Sepolia ETH, Ethereum ETH, etc.
      const chainClient = getPublicClientForChain(parsedChain);
      
      if (tokenUpper === "ETH" || tokenUpper === "") {
        // Native ETH on specified chain
        const balance = await chainClient.getBalance({
          address: walletAddress as `0x${string}`
        });
        
        const balanceFormatted = formatEther(balance);
        const chainName = parsedChain.charAt(0) + parsedChain.slice(1).toLowerCase();
        
        console.log(`✅ Balance retrieved: ${balanceFormatted} ETH on ${chainName}`);
        
        return (
          `💰 *Balance*\n\n` +
          `🔗 Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\n` +
          `🌐 Chain: ${chainName}\n` +
          `💵 ETH: *${balanceFormatted}*\n\n` +
          `Your current balance.`
        );
      } else {
        // ERC-20 token on specified chain
        const tokenAddress = TOKEN_REGISTRY[tokenUpper];
        if (!tokenAddress) {
          throw new Error(
            `Token ${tokenUpper} not found in registry for ${parsedChain}. ` +
            `To add a token, set TOKEN_ADDRESS_${tokenUpper}=0x... in .env`
          );
        }
        
        // Get token decimals
        let decimals = 18;
        try {
          decimals = await (chainClient.readContract as any)({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
            args: [],
          }) as number;
        } catch (e) {
          console.warn(`   Could not fetch decimals, using default 18`);
        }
        
        // Get token balance
        const balance = await (chainClient.readContract as any)({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        }) as bigint;
        
        const balanceFormatted = formatUnits(balance, decimals);
        const chainName = parsedChain.charAt(0) + parsedChain.slice(1).toLowerCase();
        
        console.log(`✅ ERC-20 balance retrieved: ${balanceFormatted} ${tokenUpper} on ${chainName}`);
        
        return (
          `💰 *Balance*\n\n` +
          `🔗 Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\n` +
          `🌐 Chain: ${chainName}\n` +
          `💵 ${tokenUpper}: *${balanceFormatted}*\n` +
          `📄 Contract: ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}\n\n` +
          `Your current balance.`
        );
      }
    }
    
    // Default: Somnia chain (STT/SOMI)
    if (!tokenUpper || tokenUpper === "STT" || tokenUpper === "SOMI") {
      // Native token balance (STT/SOMI)
      const balance = await publicClient.getBalance({
        address: walletAddress as `0x${string}`
      });
      
      const balanceFormatted = formatEther(balance);
      const tokenName = tokenUpper || "STT";
      
      console.log(`✅ Balance retrieved: ${balanceFormatted} ${tokenName}`);
      
      return (
        `💰 *Balance*\n\n` +
        `🔗 Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\n` +
        `🌐 Chain: Somnia\n` +
        `💵 ${tokenName}: *${balanceFormatted}*\n\n` +
        `Your current balance.`
      );
    } else {
      // ERC-20 token balance
      const tokenAddress = TOKEN_REGISTRY[tokenUpper];
      
      if (!tokenAddress) {
        throw new Error(
          `Token ${tokenUpper} not found in registry. ` +
          `Supported tokens: STT, SOMI${Object.keys(TOKEN_REGISTRY).length > 0 ? `, ${Object.keys(TOKEN_REGISTRY).join(", ")}` : ""}. ` +
          `To add a token, set TOKEN_ADDRESS_${tokenUpper}=0x... in .env`
        );
      }

      console.log(`🔍 Querying ERC-20 balance for ${tokenUpper} at ${tokenAddress}`);

      // Get token decimals (default to 18 if call fails)
      let decimals = 18;
      try {
        decimals = await (publicClient.readContract as any)({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
          args: [],
        }) as number;
        console.log(`   Token decimals: ${decimals}`);
      } catch (e) {
        console.warn(`   Could not fetch decimals, using default 18`);
      }

      // Get token balance
      const balance = await (publicClient.readContract as any)({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      }) as bigint;

      const balanceFormatted = formatUnits(balance, decimals);
      
      console.log(`✅ ERC-20 balance retrieved: ${balanceFormatted} ${tokenUpper}`);
      
      return (
        `💰 *Balance*\n\n` +
        `🔗 Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\n` +
        `💵 ${tokenUpper}: *${balanceFormatted}*\n` +
        `📄 Contract: ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}\n\n` +
        `Your current balance.`
      );
    }
  } catch (error: any) {
    console.error("Balance query failed:", error.message);
    throw new Error(`Failed to query balance: ${error.message}`);
  }
}

