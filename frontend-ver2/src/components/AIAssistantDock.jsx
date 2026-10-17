import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAgent } from '../context/AgentContext';
import { useAgentChat } from '../hooks/useAgentChat';
import { handleImageError } from '../utils/imageFallback';

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

function ArrowUpRightIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

function TargetIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ZapIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TEXT WITH CLICKABLE CITATIONS PARSER
   Converts [Campground: Name](campground:ID) into interactive navigation pills
   ───────────────────────────────────────────────────────────────────────────── */
function FormattedMessage({ content, onNavigateCampground }) {
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
   MAIN COMPONENT: AIAssistantDock (Aurora Co-Pilot)
   ───────────────────────────────────────────────────────────────────────────── */
export default function AIAssistantDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uiContext, registeredActions, highlightElement, pendingApproval } = useAgent();
  const { messages, isLoading, sendMessage } = useAgentChat();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'search'
  const [chatInput, setChatInput] = useState('');

  // Semantic Search Mode State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const chatScrollRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, activeTab]);

  // Global listener for opening dock via window events
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

  const handleSendChat = (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setChatInput('');
  };

  const handleNavigate = (campId) => {
    navigate(`/campgrounds/${campId}`);
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  // Generate context-aware quick suggestion chips
  const getContextChips = () => {
    if (location.pathname.startsWith('/campgrounds/') && !location.pathname.includes('/new') && !location.pathname.includes('/edit')) {
      return [
        "How do I share this campsite?",
        "What are the campground rules here?",
        "Recommend similar peaceful campsites"
      ];
    }
    if (location.pathname === '/campgrounds' || location.pathname === '/index') {
      return [
        "Find serene alpine campsites under $40",
        "Show me campsites with hot showers and fire rings",
        "Pet friendly spots near hiking trails"
      ];
    }
    if (location.pathname === '/campgrounds/new') {
      return [
        "What amenities should I include?",
        "Help me write an enticing description",
        "How do I upload multiple photos?"
      ];
    }
    return [
      "Find secluded lakeside tent sites",
      "Stargazing camps with dark skies",
      "How do I host a new campground?"
    ];
  };

  // Human-readable active view label
  const getContextLabel = () => {
    if (location.pathname === '/' || location.pathname === '') return 'Home Trail';
    if (location.pathname === '/campgrounds' || location.pathname === '/index') return 'Exploring Catalog';
    if (location.pathname === '/dashboard') return 'User Dashboard';
    if (location.pathname === '/campgrounds/new') return 'Hosting Form';
    if (uiContext.active_campground_title) return `Viewing: ${uiContext.active_campground_title}`;
    if (location.pathname.startsWith('/campgrounds/')) return 'Viewing Campsite';
    return 'YelpCamp';
  };

  return (
    <aside aria-label="Aurora AI Co-Pilot" className="fixed bottom-6 right-6 z-[9990] select-none font-sans">
      {/* ── COLLAPSED FLOATING LAUNCHER PILL ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-full bg-background/90 hover:bg-background border border-sky-400/30 hover:border-sky-400/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(3,7,18,0.7),0_0_20px_rgba(56,189,248,0.2)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
          aria-label="Open YelpCamp AI Co-Pilot"
        >
          {/* Animated pulsing aurora ring */}
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-emerald-500/20 via-sky-500/30 to-orange-500/20 blur-sm opacity-60 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 border border-sky-400/30">
            <SparklesIcon className="w-4 h-4 animate-pulse" />
          </div>

          <div className="relative flex flex-col text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-fg flex items-center gap-1.5">
              <span>Aurora Co-Pilot</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </span>
            <span className="text-[10px] text-fg-subtle font-medium">Dynamic Agent & Actions</span>
          </div>
        </button>
      )}

      {/* ── EXPANDED FLOATING DOCK WINDOW ── */}
      {isOpen && (
        <div 
          className="relative flex flex-col w-[94vw] sm:w-[460px] h-[600px] max-h-[85vh] rounded-2xl bg-background/95 border border-sky-400/30 backdrop-blur-2xl shadow-[0_20px_60px_rgba(3,7,18,0.9),0_0_30px_rgba(56,189,248,0.2)] overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
          role="dialog"
          aria-modal="false"
          aria-label="Aurora AI Co-Pilot"
        >
          {/* 1. HEADER & TABS */}
          <div className="flex flex-col border-b border-border/40 bg-surface/40 px-4 pt-3.5 pb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1 bg-surface-2/60 p-1 rounded-xl border border-border/40">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm'
                      : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  <BotIcon className="w-3.5 h-3.5" />
                  <span>Aurora Co-Pilot</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'search'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm'
                      : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  <SearchIcon className="w-3.5 h-3.5" />
                  <span>Vector Search</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
                aria-label="Close AI Companion"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Live Context & Active Capabilities Bar */}
            <div className="flex items-center justify-between text-[11px] text-fg-subtle py-1 px-1">
              <span className="flex items-center gap-1.5 truncate max-w-[240px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="truncate">{getContextLabel()}</span>
              </span>
              <span className="text-[10px] text-sky-400/80 font-mono">
                {Object.keys(registeredActions).length} Actions Ready
              </span>
            </div>
          </div>

          {/* 2. TAB CONTENT: DYNAMIC COPILOT CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Message Feed */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-sky-500 text-white rounded-br-sm shadow-md'
                          : 'bg-surface-2 border border-border/50 text-fg rounded-bl-sm shadow-sm'
                      }`}
                    >
                      <FormattedMessage
                        content={msg.content}
                        onNavigateCampground={handleNavigate}
                      />
                    </div>

                    {/* Action Execution Indicator Pill */}
                    {msg.trigger_action_id && (
                      <div className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <ZapIcon className="w-3 h-3 text-amber-400" />
                        <span>Action Triggered: {msg.trigger_action_id.replace(/_/g, ' ')}</span>
                      </div>
                    )}

                    {/* Spotlight Indicator Pill */}
                    {msg.ui_highlight?.dom_selector && (
                      <button
                        type="button"
                        onClick={() => highlightElement(msg.ui_highlight)}
                        className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-400/30 hover:bg-sky-500/25 transition-colors cursor-pointer"
                        title="Click to re-spotlight on your screen"
                      >
                        <TargetIcon className="w-3 h-3 text-sky-400" />
                        <span>Spotlight: {msg.ui_highlight.feature_name || msg.ui_highlight.dom_selector}</span>
                      </button>
                    )}

                    {/* Campsite Cards Embedded in Chat Feed */}
                    {msg.campsite_results && msg.campsite_results.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mt-2 w-full max-w-[94%]">
                        {msg.campsite_results.map((c) => (
                          <div
                            key={`copilot-card-${c.id}`}
                            onClick={() => handleNavigate(c.id)}
                            className="flex items-center gap-3 p-2 rounded-xl bg-surface/80 hover:bg-surface-2 border border-sky-400/20 hover:border-sky-400/50 transition-all cursor-pointer group"
                          >
                            <img
                              src={c.image}
                              alt={c.name}
                              onError={(e) => handleImageError(e, 'campground', c.id)}
                              className="w-14 h-14 rounded-lg object-cover shrink-0 bg-surface-3"
                              loading="lazy"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold text-fg truncate group-hover:text-sky-300 transition-colors">
                                  {c.name}
                                </h5>
                                <span className="text-[10px] font-bold text-emerald-400 shrink-0">
                                  {c.match_percentage}% match
                                </span>
                              </div>
                              <p className="text-[11px] text-fg-subtle truncate mt-0.5">
                                {c.location || 'Wilderness site'}
                              </p>
                              <span className="text-xs font-semibold text-sky-400">
                                ${c.price}/night
                              </span>
                            </div>
                            <span className="p-1 rounded-md bg-surface-3 text-fg-subtle group-hover:text-fg group-hover:bg-sky-500/20 transition-all">
                              <ArrowUpRightIcon className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-2 border border-border/40 text-fg-subtle w-fit animate-pulse">
                    <BotIcon className="w-4 h-4 animate-spin text-sky-400" />
                    <span className="text-xs">Aurora is consulting trail coordinates & UI state...</span>
                  </div>
                )}
              </div>

              {/* Contextual Quick Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-t border-border/30 bg-surface/20 scrollbar-none">
                {getContextChips().map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessage(chip)}
                    disabled={isLoading}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-surface-2 hover:bg-sky-500/15 text-fg-subtle hover:text-sky-300 border border-border/40 hover:border-sky-400/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* ── HUMAN-IN-THE-LOOP (HITL) GOVERNANCE CONFIRMATION CARD ── */}
              {pendingApproval && (
                <div
                  role="alertdialog"
                  aria-labelledby="hitl-title"
                  className="mx-3 mb-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/40 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span id="hitl-title" className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <ZapIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Confirm Agent Action</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
                      HITL Gate
                    </span>
                  </div>

                  <p className="text-xs text-fg/90 font-medium mb-1">{pendingApproval.title}</p>
                  <p className="text-[11px] text-fg-subtle mb-2.5">{pendingApproval.description}</p>

                  {pendingApproval.args && Object.keys(pendingApproval.args).length > 0 && (
                    <pre className="text-[10px] font-mono bg-background/80 p-2 rounded-lg border border-border/50 text-sky-300 overflow-x-auto mb-2.5 max-h-24">
                      {JSON.stringify(pendingApproval.args, null, 2)}
                    </pre>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={pendingApproval.onCancel}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-fg-subtle hover:text-fg transition-colors cursor-pointer"
                    >
                      Reject Action
                    </button>
                    <button
                      type="button"
                      onClick={pendingApproval.onConfirm}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
                    >
                      Approve & Execute
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-border/40 bg-surface/40">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about campsites, budget, or in-app tools..."
                    className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-surface-2/80 border border-border/60 text-sm text-fg placeholder:text-fg-subtle focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none transition-all"
                    aria-label="Ask Aurora Co-Pilot"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !chatInput.trim()}
                    className="absolute right-1.5 p-2 rounded-lg bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40 transition-colors cursor-pointer"
                    aria-label="Send message"
                  >
                    <SendIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. TAB CONTENT: VECTOR SEMANTIC SEARCH */}
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
                  placeholder="Describe ideal campsite scenery, price, mood..."
                  className="w-full pl-9 pr-20 py-2.5 rounded-xl bg-surface-2/70 border border-border/60 text-sm text-fg placeholder:text-fg-subtle focus:border-sky-400/80 focus:ring-1 focus:ring-sky-400/80 outline-none transition-all"
                  aria-label="Semantic campsite search"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none">
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
                  <div className="flex flex-col items-center justify-center py-12 text-center text-fg-subtle">
                    <SparklesIcon className="w-8 h-8 mb-2 opacity-40 text-sky-400" />
                    <p className="text-sm font-semibold text-fg">No direct vector matches found</p>
                    <p className="text-xs max-w-xs mt-1">Try terms like "mountain forest", "under 40", or "quiet lake views".</p>
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
                      onError={(e) => handleImageError(e, 'campground', item.id)}
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
                      <p className="text-xs text-fg-subtle line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <span className="text-xs font-semibold text-sky-400">
                          ${item.price} <span className="text-[10px] text-fg-subtle font-normal">/ night</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-fg-subtle group-hover:text-fg transition-colors">
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
        </div>
      )}
    </aside>
  );
}
