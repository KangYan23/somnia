// src/pages/index.tsx
import { useState } from 'react';
import { ethers } from 'ethers';
import WavyBackground from '../components/WavyBackground';
import HeroSection from '../components/HeroSection';

// Phone utility functions (client-side versions)
function normalizePhone(raw: string) {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/(?!^\+)[^\d]/g, '');
  return digits;
}

async function hashPhone(normalizedPhone: string) {
  // SHA-256 -> 0x-prefixed hex (client-side version using Web Crypto API)
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedPhone);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hashHex;
}

export default function Home() {
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [queryPhone, setQueryPhone] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  
  // Query Datastream state
  const [datastreamQuery, setDatastreamQuery] = useState({
    schemaName: 'userRegistration',
    publisher: '',
    dataId: ''
  });
  const [datastreamResult, setDatastreamResult] = useState<any>(null);
  
  // Phone-based query state
  const [phoneQuery, setPhoneQuery] = useState('');
  const [phoneQueryResult, setPhoneQueryResult] = useState<any>(null);
  const [publisherAddress, setPublisherAddress] = useState<string>('');

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
    // basic client side normalization: request E.164
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, walletAddress: address, metainfo: '' })
    });
    const j = await res.json();
    if (j.ok) setStatus('Registered! tx: ' + j.tx);
    else setStatus('Error: ' + (j.error || 'unknown'));
  }

  async function queryRegistration() {
    if (!queryPhone) return alert('Enter phone number to query');
    setQueryResult({ loading: true });
    const res = await fetch(`/api/query-by-events?phone=${encodeURIComponent(queryPhone)}`);
    const j = await res.json();
    setQueryResult(j);
  }

  async function queryDatastream() {
    if (!datastreamQuery.publisher || !datastreamQuery.dataId) {
      return alert('Publisher and Data ID are required');
    }
    setDatastreamResult({ loading: true });
    
    try {
      const res = await fetch('/api/query-datastream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datastreamQuery)
      });
      const j = await res.json();
      setDatastreamResult(j);
    } catch (error) {
      setDatastreamResult({ 
        error: 'Failed to query datastream: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }

  // Helper function to auto-fill datastream query with phone number
  async function queryDatastreamByPhone() {
    if (!queryPhone) return alert('Enter phone number first');
    if (!address) return alert('Connect wallet to use as publisher address');
    
    // We need to hash the phone number to get the dataId
    // This assumes you have the phone utility functions available on the frontend
    // For now, we'll just show how to format the query manually
    setDatastreamQuery({
      schemaName: 'userRegistration',
      publisher: address,
      dataId: '' // User will need to provide the phone hash manually
    });
    alert(`Set publisher to your address. You'll need to provide the phone hash as dataId. Phone: ${queryPhone}`);
  }

  // New function: Query by phone number directly
  async function queryByPhoneNumber() {
    console.log('🔍 Button clicked, starting phone query...');
    
    if (!phoneQuery) {
      alert('Enter phone number to query');
      return;
    }
    
    console.log('📱 Input validation passed. Phone:', phoneQuery);
    setPhoneQueryResult({ loading: true });
    
    try {
      // Get the publisher address from environment
      console.log('🔄 Fetching publisher address...');
      const publisherRes = await fetch('/api/get-publisher');
      const publisherData = await publisherRes.json();
      
      if (publisherData.error) {
        throw new Error('Failed to get publisher address: ' + publisherData.error);
      }
      
      const envPublisher = publisherData.publisherAddress;
      console.log('✅ Environment publisher:', envPublisher, 'Source:', publisherData.source);
      
      // Normalize and hash the phone number
      console.log('🔄 Normalizing phone...');
      const normalized = normalizePhone(phoneQuery);
      console.log('✅ Normalized:', normalized);
      
      console.log('🔄 Hashing phone...');
      const phoneHash = await hashPhone(normalized);
      console.log('✅ Phone hash:', phoneHash);
      
      console.log('🚀 Querying datastream...');
      
      // Query the datastream with the computed phone hash
      const res = await fetch('/api/query-datastream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaName: 'userRegistration',
          publisher: envPublisher, // Use environment publisher address
          dataId: phoneHash
        })
      });
      
      const result = await res.json();
      console.log('📥 API response:', result);
      
      // If found, extract wallet address from the processed results
      if (result.found && result.results && result.results[0]) {
        console.log('🔍 Analyzing result structure:', result.results);
        
        const userData = result.results[0]; // First result (now normalized)
        console.log('🔍 userData structure:', userData, 'Type:', typeof userData);
        
        let walletAddress, registeredAt, metainfo;
        
        // The API now returns normalized objects with direct property access
        if (userData && typeof userData === 'object') {
          console.log('📦 Processing normalized userData');
          walletAddress = userData.walletAddress;
          registeredAt = userData.registeredAt;
          metainfo = userData.metainfo;
          
          console.log('🔍 Extracted normalized values:', {
            phoneHash: userData.phoneHash,
            walletAddress,
            registeredAt,
            metainfo
          });
        } else {
          console.warn('⚠️ Unexpected userData structure, using raw data:', userData);
          // Fallback to string if it's a simple value
          if (typeof userData === 'string') {
            walletAddress = userData;
          }
        }
        
        console.log('✅ Extracted data:', { walletAddress, registeredAt, metainfo });
        
        // Safe date parsing
        let registeredAtISO = null;
        if (registeredAt) {
          try {
            const timestamp = typeof registeredAt === 'string' ? parseInt(registeredAt) : registeredAt;
            if (!isNaN(timestamp) && timestamp > 0) {
              registeredAtISO = new Date(timestamp).toISOString();
            }
          } catch (dateError) {
            console.warn('⚠️ Failed to parse date:', registeredAt, dateError);
          }
        }
        
        setPhoneQueryResult({
          found: true,
          phone: normalized,
          phoneHash,
          walletAddress,
          registeredAt: registeredAtISO,
          metainfo,
          publisher: envPublisher,
          rawResult: result
        });
      } else {
        console.log('❌ No data found');
        setPhoneQueryResult({
          found: false,
          phone: normalized,
          phoneHash,
          publisher: envPublisher,
          message: result.message || 'No registration found for this phone number',
          rawResult: result
        });
      }
      
    } catch (error) {
      console.error('❌ Error during phone query:', error);
      setPhoneQueryResult({ 
        error: 'Failed to query by phone: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }

  return (
    <>
      <WavyBackground />
      <div className="page-content">
        <div className="container">
          <HeroSection
            onConnectWallet={connectWallet}
            onSubmit={submit}
            address={address}
            phone={phone}
            setPhone={setPhone}
            status={status}
          />

        <hr />

        <div className="card">
          <div className="card-header">
            <h2 className="card-title mb-0">🔍 Query Registration</h2>
            <p className="text-secondary">Enter a phone number to check if it's registered and see the wallet address</p>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <div className="flex gap-2">
              <input 
                value={queryPhone} 
                onChange={e => setQueryPhone(e.target.value)} 
                placeholder="+60123456789"
                className="flex-1"
              />
              <button onClick={queryRegistration} className="btn-secondary">
                🔍 Query
              </button>
            </div>
          </div>

          {queryResult && !queryResult.loading && (
            <div className="mt-4">
              {queryResult.error && (
                <div className="alert alert-error">Error: {queryResult.error}</div>
              )}
              {!queryResult.error && !queryResult.found && (
                <div className="alert alert-warning">No registration found for {queryResult.phone}</div>
              )}
              {queryResult.found && queryResult.registrations && (
                <div className="alert alert-success">
                  <h3 className="mb-4">Found {queryResult.count} registration(s) for {queryResult.phone}</h3>
                  {queryResult.registrations.map((reg: any, idx: number) => (
                    <div key={idx} className="card mt-4">
                      <div className="mb-2"><strong>Wallet Address:</strong> <code>{reg.walletAddress}</code></div>
                      <div className="mb-2"><strong>Registered At:</strong> {reg.registeredAtISO}</div>
                      {reg.metainfo && <div className="mb-2"><strong>Metainfo:</strong> {reg.metainfo}</div>}
                      <details className="mt-4">
                        <summary className="text-sm text-muted">Technical Details</summary>
                        <div className="text-xs text-muted mt-2">
                          <div>Phone Hash: {reg.phoneHash}</div>
                          <div>Record ID: {reg.id}</div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title mb-0">⚡ Quick Phone Lookup</h2>
            <p className="text-secondary">Simply enter a phone number to find the associated wallet address (no wallet connection needed)</p>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <div className="flex gap-2">
              <input 
                value={phoneQuery} 
                onChange={e => setPhoneQuery(e.target.value)} 
                placeholder="+60123456789"
                className="flex-1"
              />
              <button onClick={queryByPhoneNumber} className="btn-primary">
                🔍 Find Wallet
              </button>
            </div>
          </div>

          {phoneQueryResult && !phoneQueryResult.loading && (
            <div className="mt-4">
              {phoneQueryResult.error && (
                <div className="alert alert-error">Error: {phoneQueryResult.error}</div>
              )}
              {!phoneQueryResult.error && !phoneQueryResult.found && (
                <div className="alert alert-warning">
                  <div>❌ No wallet found for {phoneQueryResult.phone}</div>
                  <div className="text-sm text-muted mt-2">
                    Phone Hash: <code>{phoneQueryResult.phoneHash}</code>
                  </div>
                </div>
              )}
              {phoneQueryResult.found && (
                <div className="alert alert-success">
                  <div className="mb-3">
                    <strong>✅ Phone:</strong> {phoneQueryResult.phone}
                  </div>
                  <div className="mb-3">
                    <strong>💰 Wallet Address:</strong>
                    <br />
                    <code className="text-primary text-sm">{phoneQueryResult.walletAddress}</code>
                  </div>
                  {phoneQueryResult.registeredAt && (
                    <div className="mb-3">
                      <strong>📅 Registered:</strong> {phoneQueryResult.registeredAt}
                    </div>
                  )}
                  {phoneQueryResult.metainfo && (
                    <div className="mb-3">
                      <strong>ℹ️ Info:</strong> {phoneQueryResult.metainfo}
                    </div>
                  )}
                  <details className="mt-4">
                    <summary className="text-sm text-muted">Technical Details</summary>
                    <div className="text-xs text-muted mt-2">
                      <div>Phone Hash: <code>{phoneQueryResult.phoneHash}</code></div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title mb-0">🛠️ Query Datastream</h2>
            <p className="text-secondary">Advanced: Query data directly from the datastream using schema name, publisher address, and data ID</p>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="form-group">
              <label className="form-label">Schema Name</label>
              <input 
                value={datastreamQuery.schemaName}
                onChange={e => setDatastreamQuery({...datastreamQuery, schemaName: e.target.value})}
                placeholder="userRegistration"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Publisher Address</label>
              <input 
                value={datastreamQuery.publisher}
                onChange={e => setDatastreamQuery({...datastreamQuery, publisher: e.target.value})}
                placeholder="0x123...abc"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Data ID (Phone Hash)</label>
              <input 
                value={datastreamQuery.dataId}
                onChange={e => setDatastreamQuery({...datastreamQuery, dataId: e.target.value})}
                placeholder="0x456...def"
              />
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <button onClick={queryDatastream} className="btn-primary">
              🔍 Query Datastream
            </button>
            <button onClick={queryDatastreamByPhone} className="btn-secondary">
              📱 Auto-fill from Phone
            </button>
          </div>

          {datastreamResult && !datastreamResult.loading && (
            <div className="mt-4">
              {datastreamResult.error && (
                <div className="alert alert-error">Error: {datastreamResult.error}</div>
              )}
              {!datastreamResult.error && !datastreamResult.found && (
                <div className="alert alert-warning">No data found for the given parameters</div>
              )}
              {datastreamResult.found && (
                <div className="alert alert-info">
                  <h3 className="mb-4">Datastream Results</h3>
                  <div className="mb-2">
                    <strong>Schema:</strong> {datastreamResult.schemaName} ({datastreamResult.schemaId})
                  </div>
                  <div className="mb-2">
                    <strong>Publisher:</strong> <code>{datastreamResult.publisher}</code>
                  </div>
                  <div className="mb-4">
                    <strong>Data ID:</strong> <code>{datastreamResult.dataId}</code>
                  </div>
                  
                  <div className="card">
                    <strong>Raw Results:</strong>
                    <pre className="mt-2">{JSON.stringify(datastreamResult.results, null, 2)}</pre>
                  </div>
                  
                  <div className="text-sm text-muted mt-4">
                    <div>Result Type: {datastreamResult.metadata.resultType}</div>
                    <div>Is Array: {datastreamResult.metadata.isArray ? 'Yes' : 'No'}</div>
                    <div>Count: {datastreamResult.metadata.count}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </>
);
}