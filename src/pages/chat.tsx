// src/pages/chat.tsx
import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  eventsEmitted?: boolean;
  transferData?: any;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: "👋 Hello! I'm your SOMI transfer bot powered by AI.\n\n📡 EVENT STREAMS TESTING: I emit BOTH events to test the flow.\n\nJust tell me what you want to send and I'll emit both events:\n\nExamples:\n• 'send 0.05 SOMI to 01110851129'\n• 'transfer 10 to +60123456789'\n• 'send 5 SOMI to 0123456789'\n\n🔄 Test Flow:\n1. You send message\n2. I emit TransferIntentCreated event\n3. I simulate token transfer (fake)\n4. I emit TransferConfirmed event\n5. ✅ Both events tested!\n\nI understand phone numbers in any format. Make sure you've registered your phone number first!",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!senderPhone) {
      setShowPhoneModal(true);
    }
  }, [senderPhone]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!senderPhone.trim()) {
      setShowPhoneModal(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputMessage,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          senderPhone
        })
      });

      const data = await response.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.botReply || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        eventsEmitted: data.eventsEmitted,
        transferData: data.transferData
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: "❌ Sorry, I couldn't process your message. Please try again.",
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSetPhone = () => {
    if (senderPhone.trim()) {
      setShowPhoneModal(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      <Head>
        <title>SOMI Transfer Bot</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        {/* Visual Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="relative max-w-5xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center text-4xl shadow-lg">
                  🤖
                </div>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    SOMI Bot
                    <span className="text-lg bg-white/30 px-3 py-1 rounded-full">AI</span>
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                    <span className="text-sm text-indigo-100">Event Streams Active</span>
                  </div>
                </div>
              </div>
              {senderPhone && (
                <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md rounded-xl px-5 py-3 border border-white/30">
                  <div className="text-2xl">📱</div>
                  <div>
                    <div className="text-xs text-indigo-100">Connected</div>
                    <div className="font-semibold">{senderPhone}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSenderPhone('');
                      setShowPhoneModal(true);
                    }}
                    className="text-xs bg-white/30 hover:bg-white/40 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    🔄
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phone Modal */}
        {showPhoneModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
                  📱
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Connect Phone</h2>
                <p className="text-gray-500">Any format works</p>
              </div>
              
              <div className="space-y-5">
                <div>
                  <input
                    type="text"
                    placeholder="01110851129 or +60123456789"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && senderPhone.trim()) {
                        handleSetPhone();
                      }
                    }}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none text-lg text-center font-semibold"
                    autoFocus
                    autoComplete="tel"
                  />
                </div>
                
                <button
                  onClick={handleSetPhone}
                  disabled={!senderPhone.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-2xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  ✨ Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex items-start gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      : 'bg-gradient-to-br from-purple-500 to-pink-500'
                  }`}
                >
                  {msg.sender === 'user' ? '👤' : '🤖'}
                </div>

                {/* Message */}
                <div className={`flex-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col max-w-[80%]`}>
                  <div
                    className={`rounded-3xl px-6 py-4 shadow-xl ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-md'
                        : msg.eventsEmitted
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-tl-md border-4 border-green-300'
                        : 'bg-white text-gray-800 rounded-tl-md border-2 border-gray-100'
                    }`}
                  >
                    {/* Event Success Visual */}
                    {msg.eventsEmitted && (
                      <div className="mb-4 pb-4 border-b-2 border-white/30">
                        <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                          <div className="text-2xl animate-bounce">✨</div>
                          <div className="flex-1">
                            <div className="font-bold text-sm">EVENTS EMITTED</div>
                            <div className="text-xs opacity-90">TransferIntent + TransferConfirmed</div>
                          </div>
                          <div className="text-2xl">✅</div>
                        </div>
                      </div>
                    )}

                    {/* Message Text */}
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.text}
                    </div>

                    {/* Transfer Visual Card */}
                    {msg.transferData && (
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/30 rounded-xl p-3 text-center">
                              <div className="text-2xl mb-1">📤</div>
                              <div className="text-xs opacity-80 mb-1">From</div>
                              <div className="font-bold text-sm">{msg.transferData.fromPhone}</div>
                            </div>
                            <div className="bg-white/30 rounded-xl p-3 text-center">
                              <div className="text-2xl mb-1">📥</div>
                              <div className="text-xs opacity-80 mb-1">To</div>
                              <div className="font-bold text-sm">{msg.transferData.toPhone}</div>
                            </div>
                          </div>
                          <div className="bg-white/30 rounded-xl p-4 text-center">
                            <div className="text-3xl mb-2">💰</div>
                            <div className="text-xs opacity-80 mb-1">Amount</div>
                            <div className="text-2xl font-bold">{msg.transferData.amount}</div>
                            <div className="text-sm font-semibold mt-1">SOMI</div>
                          </div>
                          {msg.transferData.txHash && (
                            <div className="bg-white/20 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">🔗</span>
                                <span className="text-xs font-semibold">Simulated TX</span>
                              </div>
                              <div className="font-mono text-xs break-all bg-black/20 p-2 rounded">
                                {msg.transferData.txHash}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Time */}
                    <div className={`text-xs mt-3 ${msg.sender === 'user' ? 'text-blue-100' : msg.eventsEmitted ? 'text-white/80' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Visual */}
            {isLoading && (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg">
                  🤖
                </div>
                <div className="bg-white rounded-3xl rounded-tl-md px-6 py-4 shadow-xl border-2 border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <span className="text-sm text-gray-600 font-medium">Processing...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Visual Input */}
        <div className="bg-white/90 backdrop-blur-xl border-t-2 border-gray-200 shadow-2xl">
          <div className="max-w-3xl mx-auto px-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                {!senderPhone && (
                  <button
                    onClick={() => setShowPhoneModal(true)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl hover:scale-110 transition-transform"
                  >
                    📱
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={senderPhone ? "💬 Type message..." : "📱 Set phone first..."}
                  disabled={isLoading || !senderPhone}
                  className={`w-full px-5 py-4 ${!senderPhone ? 'pl-14' : ''} bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none text-gray-800 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed text-lg`}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim() || !senderPhone}
                className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 flex items-center justify-center text-2xl"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  '📤'
                )}
              </button>
            </div>
            
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">✨</span>
                <span>AI-Powered</span>
              </div>
              <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg">⚡</span>
                <span>Press Enter</span>
              </div>
              <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg">💎</span>
                <span>SOMI Token</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce {
          animation: bounce 1s infinite;
        }
      `}</style>
    </>
  );
}
