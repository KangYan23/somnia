import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { Check, Copy, Loader2, Link as LinkIcon, Wallet } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface HeroSectionProps {
  phone: string;
  setPhone: (phone: string) => void;
  status: string;

  // Flow Props
  flowStep: 'INPUT' | 'CREATING_WALLET' | 'WALLET_CREATED' | 'LINKING_WALLET' | 'WALLET_LINKED';
  onCreateWallet: () => void;
  onLinkWallet: () => void;
  linkingProgress: number;

  // Generation Props
  generationProgress: number;
  generatedWallet: string | null;

  // Funding Props
  fundAmount: string;
  setFundAmount: (amount: string) => void;
  onAddFunds: () => void;
  isFunding: boolean;
  fundingTxHash: string | null;

  onReset: () => void;
}

export default function HeroSection({
  phone,
  setPhone,
  status,
  flowStep,
  onCreateWallet,
  onLinkWallet,
  linkingProgress,
  generationProgress,
  generatedWallet,
  fundAmount,
  setFundAmount,
  onAddFunds,
  isFunding,
  fundingTxHash,
  onReset,
}: HeroSectionProps) {
  const { address, isConnected } = useAccount();
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateClick = () => {
    if (!isConnected || !address) {
      setAlertTitle('Wallet not connected!');
      setAlertMessage('Please connect your wallet to continue.');
      setAlertOpen(true);
      return;
    }
    if (!phone || phone.trim() === '') {
      setAlertTitle('Phone number required!');
      setAlertMessage('Please enter your phone number.');
      setAlertOpen(true);
      return;
    }
    onCreateWallet();
  };

  const copyToClipboard = () => {
    if (generatedWallet) {
      navigator.clipboard.writeText(generatedWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="mb-8"
      style={{ marginTop: '3rem' }} // spacing before hero
    >
      {/* ---------------- HERO TITLE ---------------- */}
      <h1 className="text-center mb-6 text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight leading-snug flex flex-wrap justify-center items-center gap-2">
        <span style={{ color: '#000000' }}>Meet</span>
        <span
          className="text-3xl md:text-4xl lg:text-5xl font-bold"
          style={{
            background:
              'linear-gradient(135deg, oklch(95% 0.052 163.051), oklch(87.1% 0.15 154.449))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          IntelliBot
        </span>
        <span style={{ color: '#000000' }}>— Your Smart WhatsApp Wallet Agent</span>
      </h1>

      {/* ---------------- HERO SUBTITLE ---------------- */}
      <p className="text-center text-gray-600 mb-5 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
        Seamlessly link your Web3 wallet with your mobile identity. <br />
        Fast, secure, and built for real-world automation.
      </p>

      {/* ---------------- 3D WALLET CARD (plain classes) ---------------- */}
      <div className="wallet-card-wrapper">
        <div className="wallet-card relative overflow-hidden">

          {/* STEP 1: INPUT */}
          {flowStep === 'INPUT' && (
            <>
              <div className="wallet-card-title">Start by connecting your wallet and registering your number.</div>

              {/* RainbowKit Connect Button */}
              <div className="flex justify-center w-full mb-4">
                <ConnectButton />
              </div>

              {/* Phone number input */}
              <div className="wave-group">
                <input
                  required
                  type="tel"
                  className="wallet-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <span className="bar" />
                <label className="label">
                  <span className="label-char" style={{ '--index': 0 } as React.CSSProperties}>P</span>
                  <span className="label-char" style={{ '--index': 1 } as React.CSSProperties}>h</span>
                  <span className="label-char" style={{ '--index': 2 } as React.CSSProperties}>o</span>
                  <span className="label-char" style={{ '--index': 3 } as React.CSSProperties}>n</span>
                  <span className="label-char" style={{ '--index': 4 } as React.CSSProperties}>e</span>
                  <span className="label-char" style={{ '--index': 5 } as React.CSSProperties}> </span>
                  <span className="label-char" style={{ '--index': 6 } as React.CSSProperties}>N</span>
                  <span className="label-char" style={{ '--index': 7 } as React.CSSProperties}>u</span>
                  <span className="label-char" style={{ '--index': 8 } as React.CSSProperties}>m</span>
                  <span className="label-char" style={{ '--index': 9 } as React.CSSProperties}>b</span>
                  <span className="label-char" style={{ '--index': 10 } as React.CSSProperties}>e</span>
                  <span className="label-char" style={{ '--index': 11 } as React.CSSProperties}>r</span>
                </label>
              </div>
              <span className="wallet-help">
                Enter your phone number in international format (E.164)
              </span>

              {/* Create Wallet button */}
              <button
                onClick={handleCreateClick}
                className="wallet-btn wallet-btn-full wallet-btn-secondary"
              >
                Create Custodial Wallet
              </button>
            </>
          )}

          {/* STEP 2: CREATING WALLET */}
          {flowStep === 'CREATING_WALLET' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center w-full gap-8 py-8"
            >
              <div className="relative w-24 h-24">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    className="text-gray-200 stroke-current"
                    strokeWidth="8"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                  ></circle>
                  <circle
                    className="text-green-500 progress-ring__circle stroke-current"
                    strokeWidth="8"
                    strokeLinecap="round"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * generationProgress) / 100}
                    style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-green-600">{generationProgress}%</span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Creating Custodial Wallet...</h3>
                <p className="text-sm text-gray-500">For {phone}</p>
                <p className="text-sm text-gray-500 animate-pulse">
                  {generationProgress < 30 ? "Initializing secure environment..." :
                    generationProgress < 70 ? "Generating cryptographic keys..." :
                      "Finalizing wallet setup..."}
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: WALLET CREATED (Ready to Link) */}
          {flowStep === 'WALLET_CREATED' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center w-full gap-6"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <Wallet className="w-8 h-8 text-green-600" />
              </div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Custodial Wallet Created</h3>
                <p className="text-gray-500 text-sm">Your secure wallet is ready.</p>
                <p className="text-sm font-medium text-gray-700 mt-1">For: {phone}</p>
              </div>

              <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">Wallet Address</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-gray-800 break-all">{generatedWallet}</code>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              </div>

              <button
                onClick={onLinkWallet}
                className="wallet-btn wallet-btn-full wallet-btn-secondary flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                Link Wallet to Phone
              </button>
            </motion.div>
          )}

          {/* STEP 4: LINKING WALLET */}
          {flowStep === 'LINKING_WALLET' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center w-full gap-8 py-8"
            >
              <div className="relative w-24 h-24">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    className="text-gray-200 stroke-current"
                    strokeWidth="8"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                  ></circle>
                  <circle
                    className="text-green-500 progress-ring__circle stroke-current"
                    strokeWidth="8"
                    strokeLinecap="round"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * linkingProgress) / 100}
                    style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-green-600">{linkingProgress}%</span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Linking Wallet...</h3>
                <p className="text-sm text-gray-500">Connecting {generatedWallet?.slice(0, 6)}...{generatedWallet?.slice(-4)} to {phone}</p>
              </div>
            </motion.div>
          )}

          {/* STEP 5: WALLET LINKED (Add Funds) */}
          {flowStep === 'WALLET_LINKED' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center w-full gap-6"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <Check className="w-8 h-8 text-green-600" />
              </div>

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Wallet Linked Successfully!</h3>
                <p className="text-gray-500 text-sm">Your phone number is now connected to your custodial wallet.</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{phone}</p>
              </div>

              <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">Wallet Address</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-gray-800 break-all">{generatedWallet}</code>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              </div>

              {/* Add Funds Section */}
              <div className="w-full bg-green-50 rounded-xl p-4 border border-green-100">
                <h4 className="text-sm font-semibold text-green-900 mb-3">Add Funds (Somnia Testnet)</h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    placeholder="Amount (STT)"
                    className="flex-1 px-3 py-2 bg-white border border-green-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                  />
                  <button
                    onClick={onAddFunds}
                    disabled={isFunding || !fundAmount}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isFunding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Add Funds
                  </button>
                </div>
                {fundingTxHash && (
                  <div className="text-xs text-green-700 bg-green-100 p-2 rounded-lg break-all">
                    <span className="font-semibold">TX Sent: </span>
                    <a
                      href={`https://shannon-explorer.somnia.network/tx/${fundingTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-green-900"
                    >
                      View on Explorer
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={onReset}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Start Over
                </button>
                <button
                  className="flex-1 py-3 px-4 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  View Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {/* Alert Dialog */}
          <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
                <AlertDialogDescription className="break-all">
                  {alertMessage}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setAlertOpen(false)}>
                  Okay
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
