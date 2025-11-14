// src/pages/index.tsx
import React, { useState } from 'react';
import { ethers } from 'ethers';

export default function Home() {
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [queryPhone, setQueryPhone] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  
  // Registration threshold inputs
  const [regMinLoss, setRegMinLoss] = useState<number>(5);
  const [regMaxProfit, setRegMaxProfit] = useState<number>(10);
  
  // Price threshold states
  const [thresholdPhone, setThresholdPhone] = useState('');
  const [minLoss, setMinLoss] = useState<number>(5);
  const [maxProfit, setMaxProfit] = useState<number>(10);
  const [thresholdStatus, setThresholdStatus] = useState('');
  const [thresholds, setThresholds] = useState<any[]>([]);

  async function connectWallet() {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      return alert('Install MetaMask or WalletConnect');
    }
  // ethers v6: use BrowserProvider for injected wallets
  const provider = new ethers.BrowserProvider((window as any).ethereum as any);
  // request accounts (some providers automatically prompt on getSigner methods)
  try { await (window as any).ethereum.request?.({ method: 'eth_requestAccounts' }); } catch {}
  const signer = await provider.getSigner();
  const addr = await signer.getAddress();
    setAddress(addr);
  }

  async function submit() {
    if (!address) return alert('Connect wallet first');
    if (regMinLoss < 0 || regMinLoss > 100) return alert('Min loss must be between 0-100%');
    if (regMaxProfit < 0 || regMaxProfit > 100) return alert('Max profit must be between 0-100%');
    
    setStatus('Registering...');
    // basic client side normalization: request E.164
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ 
        phone, 
        walletAddress: address, 
        metainfo: '',
        minLossPercentage: regMinLoss,
        maxProfitPercentage: regMaxProfit,
        tokenSymbol: 'STT'
      })
    });
    const j = await res.json();
    if (j.ok) setStatus('Registered! tx: ' + j.tx);
    else setStatus('Error: ' + (j.error || 'unknown'));
  }

  async function queryRegistration() {
    if (!queryPhone) return alert('Enter phone number to query');
    setQueryResult({ loading: true });
    const res = await fetch(`/api/query-with-thresholds?phone=${encodeURIComponent(queryPhone)}`);
    const j = await res.json();
    setQueryResult(j);
  }

  async function setPriceThreshold() {
    if (!thresholdPhone.trim()) return alert('Please enter a phone number');
    if (minLoss < 0 || minLoss > 100) return alert('Min loss must be between 0-100%');
    if (maxProfit < 0 || maxProfit > 100) return alert('Max profit must be between 0-100%');
    
    setThresholdStatus('Setting threshold...');
    
    try {
      const res = await fetch('/api/price-thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: thresholdPhone,
          minLossPercentage: minLoss,
          maxProfitPercentage: maxProfit,
          walletAddress: address
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setThresholdStatus('Threshold set successfully!');
        loadThresholds(); // Refresh the list
      } else {
        setThresholdStatus('Failed: ' + data.error);
      }
    } catch (error: any) {
      setThresholdStatus('Error: ' + error.message);
    }
  }

  async function loadThresholds() {
    try {
      const res = await fetch('/api/price-thresholds');
      const data = await res.json();
      
      if (data.success) {
        setThresholds(data.thresholds || []);
      }
    } catch (error) {
      console.error('Failed to load thresholds:', error);
    }
  }

  async function removeThreshold(phoneNumber: string) {
    try {
      const res = await fetch(`/api/price-thresholds?phone=${encodeURIComponent(phoneNumber)}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.success) {
        setThresholdStatus('Threshold removed');
        loadThresholds(); // Refresh the list
      } else {
        setThresholdStatus('Failed to remove: ' + data.error);
      }
    } catch (error: any) {
      setThresholdStatus('Error: ' + error.message);
    }
  }

  // Load thresholds on component mount
  React.useEffect(() => {
    loadThresholds();
  }, []);

  return (
    <div style={{ maxWidth: 680, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>WhatsApp Wallet — Register</h1>
      <p>Connect your wallet and enter phone number in E.164 (e.g. +60123456789)</p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={connectWallet}>Connect Wallet</button>
        <div style={{ marginTop: 8 }}>Connected: {address || 'none'}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+60123456789" />
      </div>
      
      <div style={{ marginBottom: 12 }}>
        <label>Min Loss Percentage (%): </label>
        <input 
          type="number" 
          value={regMinLoss} 
          onChange={e => setRegMinLoss(Number(e.target.value))} 
          min="0" 
          max="100" 
          style={{ width: 80, marginLeft: 8 }}
        />
      </div>
      
      <div style={{ marginBottom: 12 }}>
        <label>Max Profit Percentage (%): </label>
        <input 
          type="number" 
          value={regMaxProfit} 
          onChange={e => setRegMaxProfit(Number(e.target.value))} 
          min="0" 
          max="100" 
          style={{ width: 80, marginLeft: 8 }}
        />
      </div>

      <div>
        <button onClick={submit}>Register</button>
      </div>

      <div style={{ marginTop: 12 }}>{status}</div>

      <hr style={{ margin: '2rem 0' }} />

      <h2>Query Registration</h2>
      <p>Enter a phone number to check if it's registered and see the wallet address:</p>

      <div style={{ marginBottom: 12 }}>
        <input 
          value={queryPhone} 
          onChange={e => setQueryPhone(e.target.value)} 
          placeholder="+60123456789"
          style={{ marginRight: 8 }}
        />
        <button onClick={queryRegistration}>Query</button>
      </div>

      {queryResult && !queryResult.loading && (
        <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          {queryResult.error && (
            <div style={{ color: 'red' }}>Error: {queryResult.error}</div>
          )}
          {!queryResult.error && !queryResult.found && (
            <div>No registration found for {queryResult.phone}</div>
          )}
          {queryResult.found && queryResult.registrations && (
            <div>
              <h3>🏦 Found {queryResult.registrationCount} registration(s) for {queryResult.phone}</h3>
              {queryResult.registrations.map((reg: any, idx: number) => (
                <div key={idx} style={{ marginTop: 12, padding: 12, background: 'white', borderRadius: 4, border: '1px solid #ddd' }}>
                  <div><strong>Wallet Address:</strong> {reg.walletAddress}</div>
                  <div><strong>Registered At:</strong> {reg.registeredAt}</div>
                  
                  {/* Show price thresholds if available */}
                  {reg.hasThresholds && (
                    <div style={{ marginTop: 8, padding: 8, background: '#e8f5e8', borderRadius: 4, border: '1px solid #4CAF50' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#2E7D32' }}>📊 Price Thresholds</h4>
                      <div><strong>Min Loss:</strong> {reg.minLossPercentage}%</div>
                      <div><strong>Max Profit:</strong> {reg.maxProfitPercentage}%</div>
                      <div><strong>Token:</strong> {reg.tokenSymbol}</div>
                    </div>
                  )}
                  
                  {reg.metainfo && <div><strong>Metainfo:</strong> {reg.metainfo}</div>}
                  <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>
                    <div>Phone Hash: {reg.phoneHash}</div>
                    <div>Record ID: {reg.recordId}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Price Threshold Management Section */}
      <div style={{ marginTop: 32, padding: 16, background: '#f0f8ff', borderRadius: 8 }}>
        <h2>📊 Price Threshold Management</h2>
        <p>Set minimum loss and maximum profit percentages for trading alerts.</p>
        
        {/* Set Threshold Form */}
        <div style={{ marginTop: 16 }}>
          <h3>Set New Threshold</h3>
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Phone number (e.g., +60123456789)"
              value={thresholdPhone}
              onChange={(e) => setThresholdPhone(e.target.value)}
              style={{ width: 250, padding: 8, marginRight: 8 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'inline-block', width: 150 }}>Min Loss %:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={minLoss}
              onChange={(e) => setMinLoss(Number(e.target.value))}
              style={{ width: 80, padding: 4, marginRight: 16 }}
            />
            <label style={{ display: 'inline-block', width: 150 }}>Max Profit %:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={maxProfit}
              onChange={(e) => setMaxProfit(Number(e.target.value))}
              style={{ width: 80, padding: 4 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <button onClick={setPriceThreshold} style={{ padding: '8px 16px', marginRight: 8 }}>
              Set Threshold
            </button>
            <button onClick={loadThresholds} style={{ padding: '8px 16px' }}>
              Refresh List
            </button>
          </div>
          {thresholdStatus && (
            <div style={{ marginTop: 8, color: thresholdStatus.includes('Error') || thresholdStatus.includes('Failed') ? 'red' : 'green' }}>
              {thresholdStatus}
            </div>
          )}
        </div>

        {/* Current Thresholds List */}
        <div style={{ marginTop: 24 }}>
          <h3>Current Thresholds ({thresholds.length})</h3>
          {thresholds.length === 0 ? (
            <div style={{ color: '#666', fontStyle: 'italic' }}>No price thresholds set</div>
          ) : (
            <div>
              {thresholds.map((threshold, idx) => (
                <div key={idx} style={{ marginTop: 12, padding: 12, background: 'white', borderRadius: 4, border: '1px solid #ddd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div><strong>📱 Phone:</strong> {threshold.phoneNumber}</div>
                      <div><strong>📉 Min Loss:</strong> {threshold.minLossPercentage}%</div>
                      <div><strong>📈 Max Profit:</strong> {threshold.maxProfitPercentage}%</div>
                      <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>
                        Set: {new Date(threshold.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <button 
                      onClick={() => removeThreshold(threshold.phoneNumber)}
                      style={{ 
                        padding: '4px 8px', 
                        background: '#ff4444', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
