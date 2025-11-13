// src/pages/index.tsx
import { useState } from 'react';
import { ethers } from 'ethers';

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
      
      // If found, extract wallet address from the decoded results
      if (result.found && result.results && result.results[0]) {
        console.log('🔍 Analyzing result structure:', result.results);
        
        const userData = result.results[0][0]; // First result, first item array
        console.log('🔍 userData structure:', userData, 'Type:', typeof userData, 'IsArray:', Array.isArray(userData));
        
        let walletAddress, registeredAt, metainfo;
        
        // Handle different data structures
        if (Array.isArray(userData)) {
          // If userData is an array of schema items
          console.log('📋 Processing array userData with length:', userData.length);
          walletAddress = userData.find((item: any) => item.name === 'walletAddress')?.value?.value;
          registeredAt = userData.find((item: any) => item.name === 'registeredAt')?.value?.value;
          metainfo = userData.find((item: any) => item.name === 'metainfo')?.value?.value;
          
          // Log each item for debugging
          userData.forEach((item: any, index: number) => {
            console.log(`  Item ${index}:`, item);
          });
        } else if (userData && typeof userData === 'object') {
          // If userData is an object with direct properties
          console.log('📦 Processing object userData');
          walletAddress = userData.walletAddress || userData.value?.value;
          registeredAt = userData.registeredAt || userData.value?.value;
          metainfo = userData.metainfo || userData.value?.value;
        } else {
          console.warn('⚠️ Unexpected userData structure, using raw data:', userData);
          // Try to use userData directly if it's a simple value
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
              <h3>Found {queryResult.count} registration(s) for {queryResult.phone}</h3>
              {queryResult.registrations.map((reg: any, idx: number) => (
                <div key={idx} style={{ marginTop: 12, padding: 8, background: 'white', borderRadius: 4 }}>
                  <div><strong>Wallet Address:</strong> {reg.walletAddress}</div>
                  <div><strong>Registered At:</strong> {reg.registeredAtISO}</div>
                  {reg.metainfo && <div><strong>Metainfo:</strong> {reg.metainfo}</div>}
                  <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>
                    <div>Phone Hash: {reg.phoneHash}</div>
                    <div>Record ID: {reg.id}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <hr style={{ margin: '2rem 0' }} />

      <h2>🔍 Quick Phone Lookup</h2>
      <p>Simply enter a phone number to find the associated wallet address (no wallet connection needed):</p>

      <div style={{ marginBottom: 12 }}>
        <input 
          value={phoneQuery} 
          onChange={e => setPhoneQuery(e.target.value)} 
          placeholder="+60123456789"
          style={{ marginRight: 8, width: 200 }}
        />
        <button onClick={queryByPhoneNumber}>Find Wallet Address</button>
      </div>

      {phoneQueryResult && !phoneQueryResult.loading && (
        <div style={{ marginTop: 12, padding: 12, background: '#e8f5e8', borderRadius: 4 }}>
          {phoneQueryResult.error && (
            <div style={{ color: 'red' }}>Error: {phoneQueryResult.error}</div>
          )}
          {!phoneQueryResult.error && !phoneQueryResult.found && (
            <div>
              <div style={{ color: '#666' }}>❌ No wallet found for {phoneQueryResult.phone}</div>
              <div style={{ fontSize: '0.85em', color: '#888', marginTop: 4 }}>
                Phone Hash: {phoneQueryResult.phoneHash}
              </div>
            </div>
          )}
          {phoneQueryResult.found && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <strong>✅ Phone:</strong> {phoneQueryResult.phone}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>💰 Wallet Address:</strong> 
                <code style={{ background: 'white', padding: '2px 6px', margin: '0 4px', borderRadius: 2 }}>
                  {phoneQueryResult.walletAddress}
                </code>
              </div>
              {phoneQueryResult.registeredAt && (
                <div style={{ marginBottom: 8 }}>
                  <strong>📅 Registered:</strong> {phoneQueryResult.registeredAt}
                </div>
              )}
              {phoneQueryResult.metainfo && (
                <div style={{ marginBottom: 8 }}>
                  <strong>ℹ️ Info:</strong> {phoneQueryResult.metainfo}
                </div>
              )}
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.85em', color: '#666' }}>
                  Technical Details
                </summary>
                <div style={{ fontSize: '0.8em', color: '#666', marginTop: 4 }}>
                  <div>Phone Hash: {phoneQueryResult.phoneHash}</div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      <hr style={{ margin: '2rem 0' }} />

      <h2>Query Datastream</h2>
      <p>Advanced: Query data directly from the datastream using schema name, publisher address, and data ID:</p>

      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Schema Name:</label>
          <input 
            value={datastreamQuery.schemaName}
            onChange={e => setDatastreamQuery({...datastreamQuery, schemaName: e.target.value})}
            placeholder="userRegistration"
            style={{ marginLeft: 8, width: 200 }}
          />
        </div>
        
        <div style={{ marginBottom: 8 }}>
          <label>Publisher Address:</label>
          <input 
            value={datastreamQuery.publisher}
            onChange={e => setDatastreamQuery({...datastreamQuery, publisher: e.target.value})}
            placeholder="0x123...abc"
            style={{ marginLeft: 8, width: 300 }}
          />
        </div>
        
        <div style={{ marginBottom: 8 }}>
          <label>Data ID (Phone Hash):</label>
          <input 
            value={datastreamQuery.dataId}
            onChange={e => setDatastreamQuery({...datastreamQuery, dataId: e.target.value})}
            placeholder="0x456...def"
            style={{ marginLeft: 8, width: 300 }}
          />
        </div>
        
        <button onClick={queryDatastream} style={{ marginRight: 8 }}>Query Datastream</button>
        <button onClick={queryDatastreamByPhone}>Auto-fill from Phone</button>
      </div>

      {datastreamResult && !datastreamResult.loading && (
        <div style={{ marginTop: 12, padding: 12, background: '#f0f8ff', borderRadius: 4 }}>
          {datastreamResult.error && (
            <div style={{ color: 'red' }}>Error: {datastreamResult.error}</div>
          )}
          {!datastreamResult.error && !datastreamResult.found && (
            <div>No data found for the given parameters</div>
          )}
          {datastreamResult.found && (
            <div>
              <h3>Datastream Results</h3>
              <div style={{ marginBottom: 8 }}>
                <strong>Schema:</strong> {datastreamResult.schemaName} ({datastreamResult.schemaId})
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Publisher:</strong> {datastreamResult.publisher}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Data ID:</strong> {datastreamResult.dataId}
              </div>
              <div style={{ marginTop: 12, padding: 8, background: 'white', borderRadius: 4 }}>
                <strong>Raw Results:</strong>
                <pre style={{ fontSize: '0.85em', overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(datastreamResult.results, null, 2)}
                </pre>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.85em', color: '#666' }}>
                <div>Result Type: {datastreamResult.metadata.resultType}</div>
                <div>Is Array: {datastreamResult.metadata.isArray ? 'Yes' : 'No'}</div>
                <div>Count: {datastreamResult.metadata.count}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
