// src/pages/index.tsx
import { useState } from 'react';
import { useAccount } from 'wagmi';
import WavyBackground from '../components/WavyBackground';
import HeroSection from '../components/HeroSection';
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
  const { address } = useAccount();
  const [phone, setPhone] = useState('');
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

  // Price threshold state
  const [priceThresholdPhone, setPriceThresholdPhone] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('STT');
  const [minPrice, setMinPrice] = useState<number>(100);
  const [maxPrice, setMaxPrice] = useState<number>(200);
  const [priceThresholdStatus, setPriceThresholdStatus] = useState('');

  // Active price thresholds management
  const [activeThresholds, setActiveThresholds] = useState<any[]>([]);
  const [showActiveThresholds, setShowActiveThresholds] = useState(false);

  async function connectWallet() {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      return alert("Install MetaMask or WalletConnect");
    }
    // ethers v6: use BrowserProvider for injected wallets
    const provider = new ethers.BrowserProvider((window as any).ethereum as any);
    // request accounts (some providers automatically prompt on getSigner methods)
    try { await (window as any).ethereum.request?.({ method: 'eth_requestAccounts' }); } catch { }
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    // The address from useAccount() hook will be automatically updated
  }

  async function submit() {
    if (!address) return alert("Connect wallet first");
    // basic client side normalization: request E.164
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, walletAddress: address, metainfo: "" }),
    });
    const j = await res.json();
    if (j.ok) setStatus("Registered! tx: " + j.tx);
    else setStatus("Error: " + (j.error || "unknown"));
  }

  async function queryRegistration() {
    if (!queryPhone) return alert("Enter phone number to query");
    setQueryResult({ loading: true });
    const res = await fetch(
      `/api/query-by-events?phone=${encodeURIComponent(queryPhone)}`
    );
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
  async function registerPriceThreshold() {
    if (!priceThresholdPhone) {
      alert('Enter phone number for price threshold');
      return;
    }

    if (minPrice >= maxPrice) {
      alert('Min price must be less than max price');
      return;
    }

    setPriceThresholdStatus('Setting price threshold...');

    try {
      const res = await fetch('/api/register-price-threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: priceThresholdPhone,
          tokenSymbol,
          minPrice,
          maxPrice
        })
      });

      const result = await res.json();

      if (result.ok) {
        setPriceThresholdStatus(`✅ Price threshold set! TX: ${result.tx}`);
        // Refresh active thresholds after setting new one
        loadActiveThresholds();
      } else {
        setPriceThresholdStatus(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setPriceThresholdStatus(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Load active price thresholds for the current wallet
  async function loadActiveThresholds() {
    try {
      // Get publisher address
      const publisherRes = await fetch('/api/get-publisher');
      const publisherData = await publisherRes.json();

      if (publisherData.error) {
        console.error('Failed to get publisher address:', publisherData.error);
        return;
      }

      // Query all price thresholds
      const res = await fetch('/api/query-datastream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaName: 'priceThreshold',
          publisher: publisherData.publisherAddress,
          dataId: '' // Get all records
        })
      });

      const result = await res.json();

      if (result.found && result.results) {
        // Sort by updatedAt to show most recent first
        const sorted = result.results.sort((a: any, b: any) => {
          const aTime = Number(a.updatedAt || 0);
          const bTime = Number(b.updatedAt || 0);
          return bTime - aTime;
        });

        // Convert wei to USD and format
        const formatted = sorted.map((item: any) => ({
          ...item,
          minPriceUSD: (Number(item.minPrice || 0) / 1e18).toFixed(6),
          maxPriceUSD: (Number(item.maxPrice || 0) / 1e18).toFixed(6),
          updatedAtISO: new Date(Number(item.updatedAt || 0)).toISOString()
        }));

        setActiveThresholds(formatted);
      } else {
        setActiveThresholds([]);
      }
    } catch (error) {
      console.error('Error loading active thresholds:', error);
      setActiveThresholds([]);
    }
  }

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

      // Also query for price thresholds
      console.log('🔄 Querying price thresholds...');
      let priceThreshold = null;
      try {
        const priceRes = await fetch('/api/query-price-threshold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneQuery,
            publisher: envPublisher
          })
        });
        const priceResult = await priceRes.json();
        if (priceResult.found) {
          priceThreshold = priceResult;
          console.log('✅ Found price threshold:', priceThreshold);
        } else {
          console.log('❌ No price threshold found');
        }
      } catch (priceError) {
        console.warn('⚠️ Price threshold query failed:', priceError);
      }

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
          priceThreshold,
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
            onSubmit={submit}
            phone={phone}
            setPhone={setPhone}
            status={status}
          />
        </div>
      </div>
    </>
  );
}