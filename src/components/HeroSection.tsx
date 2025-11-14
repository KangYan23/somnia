import React from 'react';
import 'tailwindcss/tailwind.css';

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
  status 
}: HeroSectionProps) {
  return (
    <div
      className="mb-8"
      style={{ marginTop: "6rem" }} // spacing before hero
    >
      {/* ---------------- HERO TITLE ---------------- */}
      <h1 className="text-center mb-6 text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-snug whitespace-nowrap">
        Meet IntelliBot — Your Smart WhatsApp Wallet Agent
      </h1>

      {/* ---------------- HERO SUBTITLE WITH GRADIENT "IntelliBot" ---------------- */}
      <p className="text-center text-secondary mb-10 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
        Seamlessly link your Web3 wallet with your mobile identity. <br />
        Fast, secure, and built for real-world automation.
      </p>
      <div className="text-center mb-8">
        <span 
          className="text-4xl md:text-5xl lg:text-6xl font-bold"
          style={{
            background: 'linear-gradient(135deg, oklch(95% 0.052 163.051), oklch(87.1% 0.15 154.449))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          IntelliBot
        </span>
      </div>
      {/* ---------------- REGISTRATION CARD ---------------- */}
      <div className="card max-w-xl mx-auto">
        
        {/* Connect Wallet */}
        <div className="form-group">
          <button onClick={onConnectWallet} className="btn-primary w-full">
            {address ? "✅ Wallet Connected" : "🔗 Connect Wallet"}
          </button>

          <div className="mt-2 text-sm flex justify-between">
            <strong>Connected:</strong>
            {address ? (
              <code className="text-primary">
                {address.slice(0, 6)}...{address.slice(-4)}
              </code>
            ) : (
              <span className="text-muted">none</span>
            )}
          </div>
        </div>

        {/* Phone Number Input */}
        <div className="form-group mt-4">
          <label className="form-label font-medium">Phone Number</label>

          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+60123456789"
            className="w-full"
          />

          <div className="form-help">
            Enter your phone number in international format (E.164)
          </div>
        </div>

        {/* Register Button */}
        <button 
          onClick={onSubmit} 
          className="btn-primary btn-lg w-full mt-4"
        >
          📝 Register Phone & Wallet
        </button>

        {/* Status Message */}
        {status && (
          <div
            className={`alert ${
              status.includes("Error") ? "alert-error" : "alert-success"
            } mt-4`}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
