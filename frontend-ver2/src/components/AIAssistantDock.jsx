import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/* ─────────────────────────────────────────────────────────────────────────────
   SVG ICONS (Clean, modern, crisp — zero emojis per UI/UX Pro Max)
   ───────────────────────────────────────────────────────────────────────────── */
function SparklesIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BotIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SendIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function CompassIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function ArrowUpRightIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TEXT WITH CLICKABLE CITATIONS PARSER
   Converts [Campground: Name](campground:ID) into interactive navigation pills
   ───────────────────────────────────────────────────────────────────────────── */
function FormattedMessage({ content, onNavigateCampground }) {
  // Regex to match [Campground: Title](campground:123) or [Title](campground:123)
  const citationRegex = /\[([^\]]+)\]\(campground:(\d+)\)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = citationRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }
    const label = match[1].replace(/^Campground:\s*/i, '');
    const campId = match[2];

    parts.push(
      <button
        key={`citation-${match.index}`}
        type="button"
        onClick={() => onNavigateCampground(campId)}
        className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-md text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-400/30 hover:bg-sky-500/25 hover:border-sky-400 transition-colors cursor-pointer group"
        title={`View ${label}`}
      >
        <span>{label}</span>
        <ArrowUpRightIcon className="w-3 h-3 opacity-70 group-hover:opacity-100 transition-opacity" />
      </button>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return (
    <div className="whitespace-pre-wrap leading-relaxed text-sm text-fg/90">
      {parts.length > 0 ? parts : content}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT: AIAssistantDock
   ───────────────────────────────────────────────────────────────────────────── */
export default function AIAssistantDock() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'chat'

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'model',
      content: "Greetings! I'm your YelpCamp Aurora Guide. Ask me to find secluded campsites, compare pricing, plan itineraries, or search by scenic features like alpine lakes or starry skies.",
      campsite_cards: []
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  // Global listener for opening dock via custom events
  useEffect(() => {
    const handleOpen = (e) => {
      setIsOpen(true);
      if (e.detail?.mode) {
        setActiveTab(e.detail.mode);
      }
      if (e.detail?.query) {
        setSearchQuery(e.detail.query);
        executeSearch(e.detail.query);
      }
    };

    window.addEventListener('open-ai-dock', handleOpen);
    return () => window.removeEventListener('open-ai-dock', handleOpen);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading, activeTab]);

  // Execute Vector Semantic Search
  const executeSearch = async (queryText) => {
    const q = queryText !== undefined ? queryText : searchQuery;
    if (!q.trim()) return;

    setSearchLoading(true);
    setHasSearched(true);
    try {
      const res = await api.post('/api/rag/search', {
        query: q.trim(),
        limit: 8,
        min_score: 0.2
      });
      setSearchResults(res.data.results || []);
    } catch (err) {
      console.error('Vector semantic search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Execute Chat message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMessage = { role: 'user', content: text, campsite_cards: [] };
    const updatedHistory = [...chatMessages, userMessage];
    setChatMessages(updatedHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const apiHistory = updatedHistory.slice(-8).map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        content: m.content
      }));

      const res = await api.post('/api/rag/chat', {
        message: text,
        conversation_history: apiHistory.slice(0, -1)
      });

      const modelMessage = {
        role: 'model',
        content: res.data.reply,
        campsite_cards: res.data.campsite_cards || []
      };
      setChatMessages((prev) => [...prev, modelMessage]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: "I'm having trouble connecting to the wilderness knowledge base right now. Please try again shortly.",
          campsite_cards: []
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleNavigate = (campId) => {
    navigate(`/campgrounds/${campId}`);
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  const sampleSearchQueries = [
    "Pine woods with alpine lake under $30",
    "High desert cliffside for stargazing",
    "Pet friendly forest retreat with creek",
    "Sunset ocean view with campfire rings"
  ];

  return (
    <aside aria-label="AI Exploration Companion" className="fixed bottom-6 right-6 z-[9990] select-none font-sans">
      {/* ── COLLAPSED FLOATING LAUNCHER PILL ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-full bg-background/90 hover:bg-background border border-sky-400/30 hover:border-sky-400/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(3,7,18,0.7),0_0_20px_rgba(56,189,248,0.2)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          aria-label="Open YelpCamp AI Companion"
        >
          {/* Animated pulsing aurora ring */}
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-emerald-500/20 via-sky-500/30 to-orange-500/20 blur-sm opacity-60 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 border border-sky-400/30">
            <SparklesIcon className="w-4 h-4 animate-pulse" />
          </div>

          <div className="relative flex flex-col text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-fg flex items-center gap-1.5">
              <span>AI Companion</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] text-muted-fg font-medium">Vector Search & Chatbot</span>
          </div>
        </button>
      )}

      {/* ── EXPANDED FLOATING DOCK WINDOW ── */}
      {isOpen && (
        <div 
          className="relative flex flex-col w-[94vw] sm:w-[440px] h-[580px] max-h-[85vh] rounded-2xl bg-background/95 border border-sky-400/25 backdrop-blur-2xl shadow-[0_20px_60px_rgba(3,7,18,0.9),0_0_30px_rgba(56,189,248,0.15)] overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
          role="dialog"
          aria-modal="false"
          aria-label="YelpCamp AI Assistant"
        >
          {/* 1. HEADER & TABS */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/40 bg-surface/40">
            <div className="flex items-center gap-1 bg-surface-2/60 p-1 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm'
                    : 'text-muted-fg hover:text-fg'
                }`}
              >
                <SearchIcon className="w-3.5 h-3.5" />
                <span>Vector Search</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm'
                    : 'text-muted-fg hover:text-fg'
                }`}
              >
                <BotIcon className="w-3.5 h-3.5" />
                <span>Aurora Guide</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-fg hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
              aria-label="Close AI Companion"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* 2. TAB CONTENT: VECTOR SEMANTIC SEARCH */}
          {activeTab === 'search' && (
            <div className="flex flex-col flex-1 overflow-hidden p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeSearch();
                }}
                className="relative mb-3"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Describe your ideal campsite scenery, price, mood..."
                  className="w-full pl-9 pr-20 py-2.5 rounded-xl bg-surface-2/70 border border-border/60 text-sm text-fg placeholder:text-muted-fg focus:border-sky-400/80 focus:ring-1 focus:ring-sky-400/80 outline-none transition-all"
                  aria-label="Semantic campsite search"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg pointer-events-none">
                  <SearchIcon className="w-4 h-4" />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {searchLoading ? 'Searching...' : 'Explore'}
                </button>
              </form>

              {/* Quick sample prompt chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-2">
                {sampleSearchQueries.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSearchQuery(chip);
                      executeSearch(chip);
                    }}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-surface-2/60 hover:bg-sky-500/15 text-muted-fg hover:text-sky-300 border border-border/40 hover:border-sky-400/30 transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Results list */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {searchLoading && (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="flex gap-3 p-3 rounded-xl bg-surface-2/40 animate-pulse border border-border/30">
                        <div className="w-16 h-16 rounded-lg bg-surface-3 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-surface-3 rounded w-3/4" />
                          <div className="h-3 bg-surface-3 rounded w-1/2" />
                          <div className="h-3 bg-surface-3 rounded w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!searchLoading && hasSearched && searchResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-fg">
                    <CompassIcon className="w-8 h-8 mb-2 opacity-40 text-sky-400" />
                    <p className="text-sm font-semibold text-fg">No direct vector matches found</p>
                    <p className="text-xs max-w-xs mt-1">Try broader terms like "mountain forest", "under 40", or "quiet lake views".</p>
                  </div>
                )}

                {!searchLoading && !hasSearched && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-fg">
                    <SparklesIcon className="w-8 h-8 mb-2 text-sky-400/60" />
                    <p className="text-sm font-semibold text-fg">Natural Language Campsite Search</p>
                    <p className="text-xs max-w-xs mt-1">
                      Our vector engine searches across full terrain descriptions, guest reviews, and scenic photographs.
                    </p>
                  </div>
                )}

                {!searchLoading && searchResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className="group flex gap-3 p-2.5 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/40 hover:border-sky-400/40 transition-all cursor-pointer"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 rounded-lg object-cover shrink-0 bg-surface-3 group-hover:scale-[1.02] transition-transform"
                      loading="lazy"
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4 className="text-sm font-bold text-fg truncate group-hover:text-sky-300 transition-colors">
                          {item.name}
                        </h4>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {item.match_percentage}% Match
                        </span>
                      </div>
                      <p className="text-xs text-muted-fg line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <span className="text-xs font-semibold text-sky-400">
                          ${item.price} <span className="text-[10px] text-muted-fg font-normal">/ night</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-fg group-hover:text-fg transition-colors">
                          <span>View</span>
                          <ArrowUpRightIcon className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. TAB CONTENT: AURORA GUIDE CHATBOT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Chat Message Scrollable Container */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-sky-500 text-white rounded-br-sm'
                          : 'bg-surface-2 border border-border/50 text-fg rounded-bl-sm shadow-sm'
                      }`}
                    >
                      <FormattedMessage
                        content={msg.content}
                        onNavigateCampground={handleNavigate}
                      />
                    </div>

                    {/* Campsite Action Cards embedded in chat stream */}
                    {msg.campsite_cards && msg.campsite_cards.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mt-2 w-full max-w-[92%]">
                        {msg.campsite_cards.map((c) => (
                          <div
                            key={`card-${c.id}`}
                            onClick={() => handleNavigate(c.id)}
                            className="flex items-center gap-3 p-2 rounded-xl bg-surface/80 hover:bg-surface-2 border border-sky-400/20 hover:border-sky-400/50 transition-all cursor-pointer group"
                          >
                            <img
                              src={c.image}
                              alt={c.name}
                              className="w-12 h-12 rounded-lg object-cover shrink-0 bg-surface-3"
                              loading="lazy"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold text-fg truncate group-hover:text-sky-300 transition-colors">
                                  {c.name}
                                </h5>
                                <span className="text-[10px] font-semibold text-emerald-400 shrink-0">
                                  {c.match_percentage}% match
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-sky-400">
                                ${c.price}/night
                              </span>
                            </div>
                            <span className="p-1 rounded-md bg-surface-3 text-muted-fg group-hover:text-fg group-hover:bg-sky-500/20 transition-all">
                              <ArrowUpRightIcon className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-2 border border-border/40 text-muted-fg w-fit">
                    <BotIcon className="w-4 h-4 animate-spin text-sky-400" />
                    <span className="text-xs">Aurora Guide is retrieving campsites...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border/40 bg-surface/40">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about campsites, budget, stargazing..."
                    className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-surface-2/80 border border-border/60 text-sm text-fg placeholder:text-muted-fg focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
                    aria-label="Chat input"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="absolute right-1.5 p-2 rounded-lg bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40 transition-colors cursor-pointer"
                    aria-label="Send message"
                  >
                    <SendIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
