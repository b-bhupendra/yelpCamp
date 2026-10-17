import { useState, useCallback } from 'react';
import api from '../api';
import { useAgent } from '../context/AgentContext';

const INITIAL_GREETING = {
  id: 'init-msg',
  role: 'model',
  content: "Greetings adventurer! I am Aurora, your YelpCamp Co-Pilot. Ask me to find secluded campsites, compare amenities, or guide you directly to any feature on this screen.",
  campsite_results: [],
  story_results: [],
  trigger_action_id: null,
  ui_highlight: null,
  timestamp: new Date().toISOString()
};

export function useAgentChat() {
  const {
    uiContext,
    registeredActions,
    executeAgentAction,
    executeAction,
    highlightElement,
    getCurrentSnapshot,
  } = useAgent();
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (userText) => {
    const text = userText?.trim();
    if (!text || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Build unified capabilities snapshot (Mounted actions + unmounted manifest actions)
    let activeActionsList = [];
    let currentUi = uiContext;

    if (typeof getCurrentSnapshot === 'function') {
      const snap = getCurrentSnapshot();
      activeActionsList = snap.availableActions || [];
      currentUi = snap.uiContext || uiContext;
    } else {
      activeActionsList = Object.values(registeredActions || {}).map((act) => ({
        id: act.id,
        description: act.description,
        parameters: act.parameters || {},
        risk_level: act.risk_level || 'SAFE'
      }));
    }

    const historyPayload = messages.slice(-6).map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      content: m.content
    }));

    try {
      const res = await api.post('/api/agent/interact', {
        user_message: text,
        ui_context: currentUi,
        available_actions: activeActionsList,
        chat_history: historyPayload
      });

      const data = res.data;

      const modelMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: data.reply || "I've reviewed your request.",
        campsite_results: data.campsite_results || [],
        story_results: data.story_results || [],
        trigger_action_id: data.trigger_action_id,
        action_args: data.action_args,
        ui_highlight: data.ui_highlight,
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, modelMessage]);

      // 1. Dispatch in-app action if directed
      if (data.trigger_action_id) {
        console.info(`[Agent] Executing triggered action: ${data.trigger_action_id}`);
        const runAction = executeAgentAction || executeAction;
        if (typeof runAction === 'function') {
          runAction(data.trigger_action_id, data.action_args);
        }
      }

      // 2. Trigger Driver.js spotlight if directed
      if (data.ui_highlight?.dom_selector) {
        console.info(`[Agent] Spotlighting UI selector: ${data.ui_highlight.dom_selector}`);
        highlightElement(data.ui_highlight);
      }
    } catch (err) {
      console.error('[Agent Chat Error]', err);
      const isRateLimited = err?.response?.status === 429;
      const retryAfter = err?.response?.data?.retry_after;
      const rateLimitMsg = retryAfter
        ? `You're sending queries a bit too quickly. Please take a breath and try again in ${retryAfter} seconds.`
        : "You're asking questions faster than the trail guide can respond! Please pause for a few seconds and try again.";

      setError(isRateLimited ? 'Rate limit reached' : 'Unable to communicate with the trail guide right now.');

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: isRateLimited ? rateLimitMsg : "I'm having trouble connecting to the wilderness knowledge base. Please try your question again in a moment.",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, registeredActions, uiContext, executeAction, highlightElement]);

  const clearMessages = useCallback(() => {
    setMessages([INITIAL_GREETING]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages
  };
}

export default useAgentChat;
