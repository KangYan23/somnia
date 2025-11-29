import { useState } from 'react';
import { useAccount } from 'wagmi';
import WavyBackground from '../components/WavyBackground';
import HeroSection from '../components/HeroSection';
import { ethers } from 'ethers';
import { toast } from 'sonner';

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

  // Onboarding Flow State
  const [flowStep, setFlowStep] = useState<'INPUT' | 'CREATING_WALLET' | 'WALLET_CREATED' | 'LINKING_WALLET' | 'WALLET_LINKED'>('INPUT');
  const [linkingProgress, setLinkingProgress] = useState(0);

  // Custodial Wallet Demo State
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedWallet, setGeneratedWallet] = useState<string | null>(null);

  // Funding State
  const [fundAmount, setFundAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);
  const [fundingTxHash, setFundingTxHash] = useState<string | null>(null);

  // Query Datastream state
  const [datastreamQuery, setDatastreamQuery] = useState({
    schemaName: 'userRegistration',
    publisher: '',
    dataId: ''
  });
  const [datastreamResult, setDatastreamResult] = useState<any>(null);

  // Phone-based query state
  const [queryPhone, setQueryPhone] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
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

  async function handleCreateWallet() {
    if (!address) return toast.error("Connect wallet first");

    setFlowStep('CREATING_WALLET');
    setGenerationProgress(0);

    // Simulate a 3-second process
    const totalDuration = 3000;
    const intervalTime = 100;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 100);
      setGenerationProgress(progress);

      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(() => {
          setGeneratedWallet("0x1924a503da1ea2bcaa4fa62e28d54a2667c685d6");
          setFlowStep('WALLET_CREATED');
          toast.success("Custodial Wallet Created Successfully!");
        }, 500);
      }
    }, intervalTime);
  }

  async function handleLinkWallet() {
    setFlowStep('LINKING_WALLET');
    setLinkingProgress(0);

    // Simulate a 2-second process
    const totalDuration = 2000;
    const intervalTime = 100;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 100);
      setLinkingProgress(progress);

      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(() => {
          setFlowStep('WALLET_LINKED');
          toast.success("Wallet linked to phone number!");
        }, 500);
      }
    }, intervalTime);
  }

  async function addFunds() {
    if (!address) return toast.error("Connect wallet first");
    if (!generatedWallet) return toast.error("No custodial wallet generated");
    if (!fundAmount) return toast.error("Enter amount to fund");

    setIsFunding(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum as any);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: generatedWallet,
        value: ethers.parseEther(fundAmount)
      });

      setFundingTxHash(tx.hash);

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold">Successfully added funds!</span>
          <a
            href={`https://shannon-explorer.somnia.network/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline hover:text-green-600"
          >
            View on Explorer
          </a>
        </div>,
        { duration: 5000 }
      );
    } catch (error) {
      console.error("Funding error:", error);
      toast.error("Failed to send funds: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsFunding(false);
    }
  }

  function handleReset() {
    setFlowStep('INPUT');
    setGenerationProgress(0);
    setLinkingProgress(0);
    setGeneratedWallet(null);
    setPhone('');
    setStatus('');
    setFundAmount('');
    setFundingTxHash(null);
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
      <div className="page-content" style={{ overflow: 'hidden', height: '100vh' }}>
        <div className="container">
          <HeroSection
            phone={phone}
            setPhone={setPhone}
            status={status}

            // Flow Props
            flowStep={flowStep}
            onCreateWallet={handleCreateWallet}
            onLinkWallet={handleLinkWallet}
            linkingProgress={linkingProgress}

            // Generation Props
            generationProgress={generationProgress}
            generatedWallet={generatedWallet}

            // Funding Props
            fundAmount={fundAmount}
            setFundAmount={setFundAmount}
            onAddFunds={addFunds}
            isFunding={isFunding}
            fundingTxHash={fundingTxHash}

            onReset={handleReset}
          />
        </div>
      </div>
    </>
  );
}