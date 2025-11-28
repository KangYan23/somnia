import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface HeroSectionProps {
  onSubmit: () => void;
  phone: string;
  setPhone: (phone: string) => void;
  status: string;
}

export default function HeroSection({
  onSubmit,
  phone,
  setPhone,
  status,
}: HeroSectionProps) {
  const { address, isConnected } = useAccount();
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Show status messages in alert dialog
  useEffect(() => {
    if (status) {
      if (status.includes('Error')) {
        setAlertTitle('Error');
        setAlertMessage(status);
      } else if (status.includes('Registered!')) {
        setAlertTitle('Registration successfully!');
        // Extract transaction hash from status message
        const txMatch = status.match(/tx:\s*([a-zA-Z0-9x]+)/);
        const txHash = txMatch ? txMatch[1] : '';
        setAlertMessage(`Phone hash: ${txHash}` || status);
      } else {
        setAlertTitle('Status');
        setAlertMessage(status);
      }
      setAlertOpen(true);
    }
  }, [status]);

  const handleRegisterClick = () => {
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
    onSubmit();
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
        <div className="wallet-card">
          <div className="wallet-card-title">Start by connecting your wallet and registering your number.</div>

          {/* RainbowKit Connect Button */}
          <div className="flex justify-center w-full mb-4">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === 'authenticated');

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      'style': {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            type="button"
                            className="bg-black text-white font-bold py-2 px-4 rounded-xl hover:scale-105 transition-transform duration-200"
                            style={{ backgroundColor: '#000000' }}
                          >
                            Connect Wallet
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            type="button"
                            className="bg-red-500 text-white font-bold py-2 px-4 rounded-xl hover:scale-105 transition-transform duration-200"
                          >
                            Wrong network
                          </button>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button
                            onClick={openChainModal}
                            style={{ display: 'flex', alignItems: 'center' }}
                            type="button"
                            className="bg-black text-white font-bold py-2 px-4 rounded-xl hover:scale-105 transition-transform duration-200"
                          >
                            {chain.hasIcon && (
                              <div
                                style={{
                                  background: chain.iconBackground,
                                  width: 12,
                                  height: 12,
                                  borderRadius: 999,
                                  overflow: 'hidden',
                                  marginRight: 4,
                                }}
                              >
                                {chain.iconUrl && (
                                  <img
                                    alt={chain.name ?? 'Chain icon'}
                                    src={chain.iconUrl}
                                    style={{ width: 12, height: 12 }}
                                  />
                                )}
                              </div>
                            )}
                            {chain.name}
                          </button>

                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="bg-black text-white font-bold py-2 px-4 rounded-xl hover:scale-105 transition-transform duration-200"
                            style={{ backgroundColor: '#000000' }}
                          >
                            {account.displayName}
                            {account.displayBalance
                              ? ` (${account.displayBalance})`
                              : ''}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </div>


          {/* Phone number input */}
          <div className="wave-group">
            <input
              required
              type="tel"
              className="wallet-input"
              value={phone}
              onChange={(e: { target: { value: string; }; }) => setPhone(e.target.value)}
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

          {/* Register button */}
          <button
            onClick={handleRegisterClick}
            className="wallet-btn wallet-btn-full wallet-btn-secondary"
          >
            Register Phone &amp; Wallet
          </button>

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
