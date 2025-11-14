import React from 'react';
import styled from 'styled-components';

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
        Meet{' '}
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
        </span> — Your Smart WhatsApp Wallet Agent
      </h1>

      {/* ---------------- HERO SUBTITLE WITH GRADIENT "IntelliBot" ---------------- */}
      <p className="text-center text-secondary mb-10 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
        Seamlessly link your Web3 wallet with your mobile identity. <br />
        Fast, secure, and built for real-world automation.
      </p>
      <div className="text-center mb-8">
      </div>
      {/* ---------------- REGISTRATION CARD ---------------- */}
      <StyledCardWrapper>
        <div className="card-container">
          <div className="neumorphic-card">
            
            {/* Connect Wallet */}
            <div className="form-section">
              <button onClick={onConnectWallet} className="neuro-btn">
                {address ? "✅ Wallet Connected" : "🔗 Connect Wallet"}
              </button>

              <div className="connection-status">
                <strong>Connected:</strong>
                {address ? (
                  <code className="address-code">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </code>
                ) : (
                  <span className="no-connection">none</span>
                )}
              </div>
            </div>

            {/* Phone Number Input */}
            <div className="form-section">
              <label className="neuro-label">Phone Number</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+60123456789"
                className="neuro-input"
              />
              <div className="input-help">
                Enter your phone number in international format (E.164)
              </div>
            </div>

            {/* Register Button */}
            <button 
              onClick={onSubmit} 
              className="neuro-btn primary"
            >
              📝 Register Phone & Wallet
            </button>

            {/* Status Message */}
            {status && (
              <div className={`status-alert ${status.includes("Error") ? "error" : "success"}`}>
                {status}
              </div>
            )}
          </div>
        </div>
      </StyledCardWrapper>
    </div>
  );
}

const StyledCardWrapper = styled.div`
  .card-container {
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 500px;
    margin: 0 auto;
  }

  .neumorphic-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 24px;
    padding: 40px 35px;
    border-radius: 20px;
    background: #1a1a1a;
    box-shadow: 
      inset 3px 3px 15px rgba(0,0,0,0.8),
      inset -2px -2px 8px rgba(255, 255, 255, 0.1),
      8px 8px 20px rgba(0,0,0,0.9),
      2px 2px 15px rgba(255, 255, 255, 0.05);
    width: 100%;
  }

  .form-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .neuro-label {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .neuro-input {
    width: 100%;
    min-height: 50px;
    color: #ffffff;
    outline: none;
    transition: all 0.35s ease;
    padding: 0 15px;
    background: #212121;
    border-radius: 12px;
    border: 2px solid #212121;
    box-shadow: 
      6px 6px 12px rgba(0,0,0,0.8),
      2px 2px 8px rgba(255, 255, 255, 0.1);
    font-size: 16px;
  }

  .neuro-input::placeholder {
    color: #888;
    transition: opacity 0.3s ease;
  }

  .neuro-input:focus {
    transform: scale(1.02);
    box-shadow: 
      6px 6px 12px rgba(0,0,0,0.8),
      2px 2px 8px rgba(255, 255, 255, 0.1),
      inset 3px 3px 8px rgba(0,0,0,0.6),
      inset -1px -1px 4px rgba(255, 255, 255, 0.05);
  }

  .neuro-input:focus::placeholder {
    opacity: 0;
  }

  .neuro-btn {
    width: 100%;
    padding: 15px 30px;
    cursor: pointer;
    background: #212121;
    border-radius: 12px;
    border: 2px solid #212121;
    box-shadow: 
      6px 6px 12px rgba(0,0,0,0.8),
      2px 2px 8px rgba(255, 255, 255, 0.1);
    color: #ffffff;
    font-size: 16px;
    font-weight: bold;
    transition: all 0.35s ease;
    text-align: center;
  }

  .neuro-btn:hover {
    transform: scale(1.02);
    box-shadow: 
      6px 6px 12px rgba(0,0,0,0.8),
      2px 2px 8px rgba(255, 255, 255, 0.1),
      inset 3px 3px 8px rgba(0,0,0,0.6),
      inset -1px -1px 4px rgba(255, 255, 255, 0.05);
  }

  .neuro-btn:active {
    transform: scale(0.98);
    box-shadow: 
      inset 4px 4px 10px rgba(0,0,0,0.8),
      inset -2px -2px 6px rgba(255, 255, 255, 0.1);
  }

  .neuro-btn.primary {
    background: linear-gradient(135deg, oklch(95% 0.052 163.051), oklch(87.1% 0.15 154.449));
    color: #000000;
    font-weight: 700;
  }

  .connection-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    color: #cccccc;
    margin-top: 8px;
  }

  .address-code {
    background: rgba(0, 255, 127, 0.1);
    color: #00ff7f;
    padding: 4px 8px;
    border-radius: 6px;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 13px;
  }

  .no-connection {
    color: #888;
    font-style: italic;
  }

  .input-help {
    font-size: 13px;
    color: #888;
    margin-top: 6px;
  }

  .status-alert {
    width: 100%;
    padding: 15px;
    border-radius: 12px;
    font-size: 14px;
    text-align: center;
    box-shadow: 
      inset 2px 2px 6px rgba(0,0,0,0.6),
      inset -1px -1px 3px rgba(255, 255, 255, 0.1);
  }

  .status-alert.success {
    background: rgba(0, 255, 127, 0.1);
    color: #00ff7f;
    border: 1px solid rgba(0, 255, 127, 0.2);
  }

  .status-alert.error {
    background: rgba(255, 99, 99, 0.1);
    color: #ff6363;
    border: 1px solid rgba(255, 99, 99, 0.2);
  }
`;
