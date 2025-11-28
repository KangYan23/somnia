import { walletClient, account, publicClient } from "../../src/lib/somnia";
import { parseEther } from "viem";

// Contract Addresses
const ROUTER_ADDRESS = "0xEbf039eB6623E811b2C8BEcaf67d63Fc69724Fb0";
const STT_ADDRESS = "0x8297F273c07CB0B42E22F46834FBc62411ca725b";
const USDC_ADDRESS = "0x8e13b7D5EB18F1c5e271B73005e90E7Dd3316127";

// ERC20 ABI (minimal for approve/allowance)
const ERC20_ABI = [
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
        outputs: [{ name: "", type: "bool" }]
    },
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }]
    }
] as const;

// Router ABI (minimal for swap)
const ROUTER_ABI = [
    {
        name: "swapExactTokensForTokens",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "amountIn", type: "uint256" },
            { name: "amountOutMin", type: "uint256" },
            { name: "path", type: "address[]" },
            { name: "to", type: "address" },
            { name: "deadline", type: "uint256" }
        ],
        outputs: [{ name: "amounts", type: "uint256[]" }]
    }
] as const;

export async function handleSwap(action: {
    amount: number;
    tokenFrom: string;
    tokenTo: string;
}) {
    const { amount, tokenFrom, tokenTo } = action;

    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (!tokenFrom || !tokenTo) throw new Error("Missing token symbols");

    // Map symbols to addresses
    const getTokenAddress = (symbol: string) => {
        if (symbol.toUpperCase() === "STT") return STT_ADDRESS;
        if (symbol.toUpperCase() === "USDC") return USDC_ADDRESS;
        throw new Error(`Unsupported token: ${symbol}`);
    };

    const tokenIn = getTokenAddress(tokenFrom);
    const tokenOut = getTokenAddress(tokenTo);
    const amountInWei = parseEther(String(amount));

    console.log(`🔄 Preparing swap: ${amount} ${tokenFrom} -> ${tokenTo}`);

    // 0. Check Balance
    const balance = await publicClient.readContract({
        address: tokenIn as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address]
    } as any) as unknown as bigint;

    console.log(`💰 Balance: ${balance.toString()} (Required: ${amountInWei.toString()})`);

    if (balance < amountInWei) {
        throw new Error(`Insufficient balance. You have ${balance.toString()} but need ${amountInWei.toString()}`);
    }

    // 1. Check Allowance & Approve if needed
    // Cast options to any to avoid strict type checks, and result to bigint
    const allowance = await publicClient.readContract({
        address: tokenIn as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account.address, ROUTER_ADDRESS]
    } as any) as unknown as bigint;

    if (allowance < amountInWei) {
        console.log(`🔓 Approving Router to spend ${tokenFrom}...`);
        const approveHash = await walletClient.writeContract({
            address: tokenIn as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [ROUTER_ADDRESS, amountInWei],
            account,
            chain: null
        });

        console.log(`⏳ Waiting for approval: ${approveHash}`);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log("✅ Approved!");
    }

    // 2. Execute Swap
    console.log("💱 Executing swap...");
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 mins

    const swapHash = await walletClient.writeContract({
        address: ROUTER_ADDRESS,
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [
            amountInWei,
            0n, // amountOutMin (0 for now, slippage protection omitted for demo)
            [tokenIn as `0x${string}`, tokenOut as `0x${string}`],
            account.address,
            deadline
        ],
        account,
        chain: null
    });

    console.log(`⏳ Swap sent: ${swapHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });

    if (receipt.status === "success") {
        const explorerLink = `https://shannon-explorer.somnia.network/tx/${swapHash}`;
        return `✅ Swap Successful!\n\nSwapped ${amount} ${tokenFrom} to ${tokenTo}.\n\n🔗 View on Explorer:\n${explorerLink}`;
    } else {
        throw new Error(`Swap failed. Tx: ${swapHash}`);
    }
}
