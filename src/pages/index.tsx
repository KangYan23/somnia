// src/pages/index.tsx
import { useState } from "react";
import { ethers } from "ethers";

export default function Home() {
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");
  const [queryPhone, setQueryPhone] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);

  async function connectWallet() {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      return alert("Install MetaMask or WalletConnect");
    }
    // ethers v6: use BrowserProvider for injected wallets
    const provider = new ethers.BrowserProvider(
      (window as any).ethereum as any
    );
    // request accounts (some providers automatically prompt on getSigner methods)
    try {
      await (window as any).ethereum.request?.({
        method: "eth_requestAccounts",
      });
    } catch {}
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    setAddress(addr);
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

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "2rem auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>WhatsApp Wallet — Register</h1>
      <p>
        Connect your wallet and enter phone number in E.164 (e.g. +60123456789)
      </p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={connectWallet}>Connect Wallet</button>
        <div style={{ marginTop: 8 }}>Connected: {address || "none"}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+60123456789"
        />
      </div>

      <div>
        <button onClick={submit}>Register</button>
      </div>

      <div style={{ marginTop: 12 }}>{status}</div>

      <hr style={{ margin: "2rem 0" }} />

      <h2>Query Registration</h2>
      <p>
        Enter a phone number to check if it's registered and see the wallet
        address:
      </p>

      <div style={{ marginBottom: 12 }}>
        <input
          value={queryPhone}
          onChange={(e) => setQueryPhone(e.target.value)}
          placeholder="+60123456789"
          style={{ marginRight: 8 }}
        />
        <button onClick={queryRegistration}>Query</button>
      </div>

      {queryResult && !queryResult.loading && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#f5f5f5",
            borderRadius: 4,
          }}
        >
          {queryResult.error && (
            <div style={{ color: "red" }}>Error: {queryResult.error}</div>
          )}
          {!queryResult.error && !queryResult.found && (
            <div>No registration found for {queryResult.phone}</div>
          )}
          {queryResult.found && queryResult.registrations && (
            <div>
              <h3>
                Found {queryResult.count} registration(s) for{" "}
                {queryResult.phone}
              </h3>
              {queryResult.registrations.map((reg: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    marginTop: 12,
                    padding: 8,
                    background: "white",
                    borderRadius: 4,
                  }}
                >
                  <div>
                    <strong>Wallet Address:</strong>{" "}
                    {String(reg.walletAddress || "N/A")}
                  </div>
                  <div>
                    <strong>Registered At:</strong>{" "}
                    {String(reg.registeredAtISO || "N/A")}
                  </div>
                  {reg.metainfo && (
                    <div>
                      <strong>Metainfo:</strong> {String(reg.metainfo)}
                    </div>
                  )}
                  <div
                    style={{ fontSize: "0.85em", color: "#666", marginTop: 4 }}
                  >
                    <div>Phone Hash: {String(reg.phoneHash || "N/A")}</div>
                    <div>Publisher: {String(reg.publisher || "N/A")}</div>
                    <div>Source: {String(reg.source || "N/A")}</div>
                    <div
                      style={{ fontSize: "0.8em", color: "#999", marginTop: 4 }}
                    >
                      Raw data: {JSON.stringify(reg, null, 2).substring(0, 100)}
                      ...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
