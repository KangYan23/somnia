import React from 'react';

interface HeroSectionProps {
  onConnectWallet: () => void;
  onSubmit: () => void;
  address: string;
  phone: string;
  setPhone: (phone: string) => void;
  status: string;
}

export default function HeroSection({
  onConnectWallet,
  onSubmit,
  address,
  phone,
  setPhone,
  status,
}: HeroSectionProps) {
  return (
    <div
      className="mb-8"
      style={{ marginTop: '3rem' }} // spacing before hero
    >
      {/* ---------------- HERO TITLE ---------------- */}
      <h1 className="text-center mb-6 text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-snug flex flex-wrap justify-center items-center gap-2">
        <span>Meet</span>
        <span
          className="text-4xl md:text-5xl lg:text-6xl font-bold"
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
        <span>— Your Smart WhatsApp Wallet Agent</span>
      </h1>

      {/* ---------------- HERO SUBTITLE ---------------- */}
      <p className="text-center text-secondary mb-10 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
        Seamlessly link your Web3 wallet with your mobile identity. <br />
        Fast, secure, and built for real-world automation.
      </p>

      {/* ---------------- 3D WALLET CARD (plain classes) ---------------- */}
      <div className="wallet-card-wrapper">
        <div className="wallet-card">
          <div className="wallet-card-title">Start by connecting your wallet and registering your number.</div>

          {/* Connect Wallet */}
          <button
            onClick={onConnectWallet}
            className={`wallet-btn wallet-btn-full ${address ? 'wallet-btn-connected' : ''}`}
          >
            {address ? 'Wallet Connected!' : 'Connect Wallet'}
          </button>

          <div className="wallet-connected-line">
            <span className="label">Connected:</span>
            {address ? (
              <code className="addr">
                {address}
              </code>
            ) : (
              <span className="addr none">None</span>
            )}
          </div>

          {/* Phone number input */}
          <input
            placeholder="+60123456789"
            className="wallet-input"
            type="tel"
            value={phone}
            onChange={(e: { target: { value: string; }; }) => setPhone(e.target.value)}
          />
          <span className="wallet-help">
            Enter your phone number in international format (E.164)
          </span>

          {/* Register button */}
          <button
            onClick={onSubmit}
            className="wallet-btn wallet-btn-full wallet-btn-secondary"
          >
            Register Phone &amp; Wallet
          </button>

          {/* Status message */}
          {status && (
            <div
              className={
                'wallet-status ' +
                (status.includes('Error') ? 'wallet-status-error' : 'wallet-status-ok')
              }
            >
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
