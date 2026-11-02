import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import api from '../api';
import { UI_CAPABILITY_MANIFEST } from '../agent/manifest';
import { useAuth } from './AuthContext';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [registeredActions, setRegisteredActions] = useState({});
  const actionsRef = useRef({});
  const [activeStepBanner, setActiveStepBanner] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);

  const [uiContext, setUiContextState] = useState({
    current_route: location.pathname,
    active_campground_id: null,
    active_campground_title: null,
    active_campground_data: null,
    open_modal: null,
    draft_fields: {},
  });

  // FIFO Queue for chained multi-step actions across routes
  const actionQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);
  const activeDriverRef = useRef(null);

  useEffect(() => {
    setUiContextState((prev) => ({
      ...prev,
      current_route: location.pathname,
      is_authenticated: !!user,
      current_user: user?.username || null,
    }));
  }, [location.pathname, user]);

  const updateUiContext = useCallback((keyOrUpdater, maybeValue) => {
    setUiContextState((prev) => {
      if (typeof keyOrUpdater === 'function') return keyOrUpdater(prev);
      if (typeof keyOrUpdater === 'string') {
        if (maybeValue === undefined) {
          const copy = { ...prev };
          delete copy[keyOrUpdater];
          return copy;
        }
        return { ...prev, [keyOrUpdater]: maybeValue };
      }
      if (typeof keyOrUpdater === 'object' && keyOrUpdater !== null) {
        return { ...prev, ...keyOrUpdater };
      }
      return prev;
    });
  }, []);

  const setUiContext = updateUiContext;

  // Auto-sync UI_CAPABILITY_MANIFEST to Backend Vector Store if manifest changed
  useEffect(() => {
    const syncManifest = async () => {
      try {
        const manifestStr = JSON.stringify(UI_CAPABILITY_MANIFEST);
        const cachedHash = localStorage.getItem('yelpcamp_ui_manifest_hash');
        let hash = 0;
        for (let i = 0; i < manifestStr.length; i++) {
          hash = (hash << 5) - hash + manifestStr.charCodeAt(i);
          hash |= 0;
        }
        const currentHash = String(hash);

        if (cachedHash !== currentHash) {
          await api.post('/api/v1/agent/sync-ui', { items: UI_CAPABILITY_MANIFEST });
          localStorage.setItem('yelpcamp_ui_manifest_hash', currentHash);
          console.info('[Agent Manifest] Auto-synced UI capabilities to Vector DB.');
        }
      } catch (err) {
        console.debug('UI Manifest auto-sync notice:', err?.message);
      }
    };
    syncManifest();
  }, []);

  // Resolve dynamic routes like /campgrounds/:id using args or uiContext
  const resolveRoute = useCallback((routePattern, args = {}) => {
    if (!routePattern) return null;
    if (!routePattern.includes(':id')) return routePattern;
    const campId = args?.campground_id || args?.id || uiContext.active_campground_id;
    return campId ? routePattern.replace(':id', String(campId)) : '/campgrounds';
  }, [uiContext.active_campground_id]);

  // Wait for an action to be mounted in actionsRef (up to 3.5s after route change)
  const waitForActionMount = (actionId, timeoutMs = 3500) =>
    new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (actionsRef.current[actionId]) return resolve(actionsRef.current[actionId]);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, 100);
      };
      check();
    });

  // Wait for a DOM selector to appear before spotlighting
  const waitForElement = (selector, timeoutMs = 3000) =>
    new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(check, 100);
      };
      check();
    });

  // Spotlight a single element or run a multi-step guided tour
  const highlightElement = useCallback(async (uiHighlight) => {
    if (!uiHighlight || !uiHighlight.dom_selector) return;

    const targetRoute = resolveRoute(uiHighlight.route, uiHighlight.args);
    if (targetRoute && window.location.pathname !== targetRoute) {
      navigate(targetRoute);
    }

    const el = await waitForElement(uiHighlight.dom_selector);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (activeDriverRef.current) {
      try { activeDriverRef.current.destroy(); } catch {}
    }

    const drv = driver({
      animate: true,
      popoverClass: 'aurora-driver-popover',
      showProgress: true,
      showButtons: ['next', 'close'],
      stagePadding: 8,
      stageRadius: 12,
      onDestroyStarted: () => {
        drv.destroy();
        activeDriverRef.current = null;
      },
    });
    activeDriverRef.current = drv;
    drv.highlight({
      element: uiHighlight.dom_selector,
      popover: {
        title: uiHighlight.feature_name || 'Aurora Guide',
        description: uiHighlight.description || 'Interact with this control here.',
        side: 'bottom',
        align: 'center',
      },
    });
  }, [navigate, resolveRoute]);

  // Sequential Chained Action Queue Processor
  const processActionQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (actionQueueRef.current.length > 0) {
      const step = actionQueueRef.current[0];
      const { id: actionId, args = {}, guidance } = step;

      if (guidance) {
        setActiveStepBanner(guidance);
      }

      const manifestEntry = UI_CAPABILITY_MANIFEST.find((m) => m.id === actionId);
      let actionObj = actionsRef.current[actionId];

      // 1. If action isn't mounted on current page, navigate to its target route first
      if (!actionObj) {
        const targetRoute = resolveRoute(step.route || manifestEntry?.route, args);
        if (targetRoute && window.location.pathname !== targetRoute) {
          navigate(targetRoute);
          actionObj = await waitForActionMount(actionId, 3500);
        }
      }

      if (!actionObj) {
        console.warn(`[Agent Queue] Action ${actionId} could not be mounted.`);
        actionQueueRef.current.shift();
        continue;
      }

      // 2. Check HITL Gate for MUTATE actions
      const riskLevel = actionObj.risk_level || manifestEntry?.risk_level || 'SAFE';
      const isMutatingOrRequiresConfirmation = Boolean(
        actionObj.requiresConfirmation ||
        actionObj.requires_confirmation ||
        riskLevel === 'MUTATE' ||
        manifestEntry?.requiresConfirmation ||
        manifestEntry?.requires_confirmation ||
        manifestEntry?.risk_level === 'MUTATE'
      );

      if (isMutatingOrRequiresConfirmation) {
        await new Promise((resolve) => {
          setPendingApproval({
            id: actionId,
            title: actionObj.feature_name || manifestEntry?.feature_name || actionId.replace(/_/g, ' '),
            description: guidance || actionObj.description || 'Confirm this action to proceed.',
            args,
            onConfirm: async () => {
              try {
                await actionObj.handler(args);
              } catch (err) {
                console.error(`[Agent Queue] Step ${actionId} failed on confirm:`, err);
              } finally {
                setPendingApproval(null);
                resolve();
              }
            },
            onCancel: () => {
              setPendingApproval(null);
              actionQueueRef.current = []; // Abort remaining chain if user rejects
              resolve();
            },
          });
        });
      } else {
        // 3. Execute SAFE / DRAFT action and await completion before running next chained step
        try {
          await actionObj.handler(args);
        } catch (err) {
          console.error(`[Agent Queue] Step ${actionId} failed:`, err);
        }
      }

      // Optional spotlight for this step
      if (step.dom_selector) {
        await highlightElement({
          dom_selector: step.dom_selector,
          feature_name: step.feature_name || actionObj.feature_name,
          description: guidance || actionObj.description,
        });
      }

      actionQueueRef.current.shift();
      // Brief pause between chained actions so user can visually follow the UI transition
      if (actionQueueRef.current.length > 0) {
        await new Promise((r) => setTimeout(r, 650));
      }
    }

    setTimeout(() => setActiveStepBanner(null), 4000);
    isProcessingQueueRef.current = false;
  }, [navigate, resolveRoute, highlightElement]);

  // Enqueue single action or an array of chained actions
  const executeAgentAction = useCallback((actionOrPlan, maybeArgs = {}) => {
    if (!actionOrPlan) return;

    const steps = Array.isArray(actionOrPlan)
      ? actionOrPlan
      : [{ id: actionOrPlan, args: maybeArgs }];

    actionQueueRef.current.push(...steps);
    processActionQueue();
  }, [processActionQueue]);

  const registerAction = useCallback((actionOrId, maybeMeta) => {
    const action = typeof actionOrId === 'object' && actionOrId !== null
      ? { ...actionOrId }
      : { id: actionOrId, ...(maybeMeta || {}) };

    if (!action?.id || typeof action.handler !== 'function') return () => {};

    actionsRef.current[action.id] = action;
    setRegisteredActions((prev) => ({ ...prev, [action.id]: action }));

    return () => {
      delete actionsRef.current[action.id];
      setRegisteredActions((prev) => {
        const copy = { ...prev };
        delete copy[action.id];
        return copy;
      });
    };
  }, []);

  const unregisterAction = useCallback((id) => {
    if (!id) return;
    delete actionsRef.current[id];
    setRegisteredActions((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  // Register standard global navigation actions
  useEffect(() => {
    const unregHome = registerAction({
      id: 'navigate_home',
      description: 'Navigate to Meadows homepage',
      risk_level: 'SAFE',
      handler: () => navigate('/')
    });
    const unregExplore = registerAction({
      id: 'navigate_explore',
      description: 'Navigate to Explore all campgrounds catalog',
      risk_level: 'SAFE',
      handler: () => navigate('/campgrounds')
    });
    const unregNew = registerAction({
      id: 'navigate_new_campground',
      description: 'Navigate to host a new campground submission form',
      risk_level: 'SAFE',
      handler: () => navigate('/campgrounds/new')
    });
    const unregDash = registerAction({
      id: 'navigate_dashboard',
      description: 'Navigate to user account profile and campground wishlist dashboard',
      risk_level: 'SAFE',
      handler: () => navigate('/dashboard')
    });
    const unregLogin = registerAction({
      id: 'user_login',
      feature_name: 'Sign In to Meadows',
      description: 'Navigate to the secure sign-in login portal with email or Google',
      risk_level: 'SAFE',
      handler: () => navigate('/login')
    });
    const unregLoginAlias = registerAction({
      id: 'navigate_login',
      feature_name: 'Sign In to Meadows',
      description: 'Navigate to the sign-in login portal',
      risk_level: 'SAFE',
      handler: () => navigate('/login')
    });
    const unregRegister = registerAction({
      id: 'user_register',
      feature_name: 'Join Meadows / Create Account',
      description: 'Navigate to the registration page to create a new scout profile',
      risk_level: 'SAFE',
      handler: () => navigate('/register')
    });
    const unregRegisterAlias = registerAction({
      id: 'navigate_register',
      feature_name: 'Join Meadows / Create Account',
      description: 'Navigate to the registration page',
      risk_level: 'SAFE',
      handler: () => navigate('/register')
    });

    return () => {
      unregHome();
      unregExplore();
      unregNew();
      unregDash();
      unregLogin();
      unregLoginAlias();
      unregRegister();
      unregRegisterAlias();
    };
  }, [navigate, registerAction]);

  // Register user_logout action (gated behind HITL MUTATE confirmation)
  useEffect(() => {
    if (user) {
      const unregLogout = registerAction({
        id: 'user_logout',
        feature_name: 'Log out of Meadows',
        description: 'Terminate your active user session and log out of Meadows on this device. (Requires user confirmation)',
        risk_level: 'MUTATE',
        handler: async () => {
          await logout();
          navigate('/');
        }
      });
      return () => unregLogout();
    }
  }, [user, logout, navigate, registerAction]);

  const getCurrentSnapshot = useCallback(() => {
    const mountedList = Object.values(actionsRef.current).map((a) => ({
      id: a.id,
      description: a.description,
      risk_level: a.risk_level || 'SAFE',
      parameters: a.parameters || {},
      is_mounted: true,
    }));

    const mountedIds = new Set(mountedList.map((m) => m.id));
    const globalList = UI_CAPABILITY_MANIFEST.filter((m) => !mountedIds.has(m.id)).map((m) => ({
      id: m.id,
      description: `${m.description} (Auto-navigates to ${m.route})`,
      risk_level: m.risk_level || 'SAFE',
      parameters: m.parameters || {},
      is_mounted: false,
      target_route: m.route,
    }));

    return {
      uiContext,
      availableActions: [...mountedList, ...globalList],
    };
  }, [uiContext]);

  return (
    <AgentContext.Provider
      value={{
        uiContext,
        setUiContext,
        updateUiContext,
        registeredActions,
        pendingApproval,
        activeStepBanner,
        registerAction,
        unregisterAction,
        highlightElement,
        executeAgentAction,
        executeAction: executeAgentAction,
        getCurrentSnapshot,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};

export default AgentContext;
