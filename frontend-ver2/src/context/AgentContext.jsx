import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import api from '../api';
import { UI_CAPABILITY_MANIFEST } from '../agent/manifest';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [registeredActions, setRegisteredActions] = useState({});
  const actionsRef = useRef({});
  const [uiContext, setUiContextState] = useState({
    current_route: location.pathname,
    active_campground_id: null,
    active_campground_title: null,
    open_modal: null,
    draft_fields: {}
  });

  // Queue for actions that require navigating to another route before executing
  const pendingRouteActionRef = useRef(null);

  // Human-in-the-Loop (HITL) state for high-stakes mutating actions
  const [pendingApproval, setPendingApproval] = useState(null);

  // 1. Keep current_route updated in uiContext
  useEffect(() => {
    setUiContextState((prev) => ({ ...prev, current_route: location.pathname }));
  }, [location.pathname]);

  const updateUiContext = useCallback((keyOrUpdater, maybeValue) => {
    setUiContextState((prev) => {
      if (typeof keyOrUpdater === 'function') {
        return keyOrUpdater(prev);
      }
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

  // 2. Auto-sync UI_CAPABILITY_MANIFEST to Backend Vector Store if manifest changed
  useEffect(() => {
    const syncManifest = async () => {
      try {
        const manifestStr = JSON.stringify(UI_CAPABILITY_MANIFEST);
        const cachedHash = localStorage.getItem('yelpcamp_ui_manifest_hash');
        // Fast string hash
        let hash = 0;
        for (let i = 0; i < manifestStr.length; i++) {
          hash = (hash << 5) - hash + manifestStr.charCodeAt(i);
          hash |= 0;
        }
        const currentHash = String(hash);

        if (cachedHash !== currentHash) {
          await api.post('/api/agent/sync-ui', { items: UI_CAPABILITY_MANIFEST });
          localStorage.setItem('yelpcamp_ui_manifest_hash', currentHash);
          console.info('[Agent Manifest] Auto-synced UI capabilities to Vector DB.');
        }
      } catch (err) {
        // Non-blocking notice in dev/offline mode
        console.debug('UI Manifest auto-sync notice:', err?.message);
      }
    };
    syncManifest();
  }, []);

  // 3. Register component-level action (and drain deferred cross-page queue if waiting!)
  const registerAction = useCallback((actionOrId, maybeMeta) => {
    let action;
    if (typeof actionOrId === 'object' && actionOrId !== null) {
      action = { ...actionOrId };
    } else {
      action = { id: actionOrId, ...(maybeMeta || {}) };
    }

    if (!action?.id || typeof action.handler !== 'function') return () => {};

    actionsRef.current[action.id] = action;
    setRegisteredActions((prev) => ({ ...prev, [action.id]: action }));

    // Check if the AI navigated to this page specifically to run this action
    if (pendingRouteActionRef.current && pendingRouteActionRef.current.id === action.id) {
      const { args } = pendingRouteActionRef.current;
      pendingRouteActionRef.current = null;
      setTimeout(() => {
        try {
          action.handler(args || {});
        } catch (err) {
          console.error(`[Agent Action] Error executing deferred action ${action.id}:`, err);
        }
      }, 200);
    }

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
    if (id) {
      delete actionsRef.current[id];
      setRegisteredActions((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  }, []);

  // Register standard global navigation actions
  useEffect(() => {
    const unregHome = registerAction({
      id: 'navigate_home',
      description: 'Navigate to YelpCamp homepage',
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

    return () => {
      unregHome();
      unregExplore();
      unregNew();
      unregDash();
    };
  }, [navigate, registerAction]);

  // 4. Driver.js Spotlight with Automatic Cross-Route Navigation
  const activeDriverRef = useRef(null);

  const highlightElement = useCallback((uiHighlight) => {
    if (!uiHighlight || !uiHighlight.dom_selector) return;

    const targetRoute = uiHighlight.route;
    const isDynamicPattern = targetRoute && targetRoute.includes(':');

    if (targetRoute && !isDynamicPattern && location.pathname !== targetRoute) {
      navigate(targetRoute);
    }

    // Poll for DOM element to exist after route transition
    let attempts = 0;
    const trySpotlight = () => {
      const el = document.querySelector(uiHighlight.dom_selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (activeDriverRef.current) {
          try {
            activeDriverRef.current.destroy();
          } catch {}
        }
        const drv = driver({
          animate: true,
          showProgress: false,
          showButtons: ['close'],
          stagePadding: 8,
          stageRadius: 12,
          onDestroyStarted: () => {
            drv.destroy();
            activeDriverRef.current = null;
          }
        });
        activeDriverRef.current = drv;
        drv.highlight({
          element: uiHighlight.dom_selector,
          popover: {
            title: uiHighlight.feature_name || 'Feature Spotlight',
            description: uiHighlight.description || 'Interact with this control here.',
            side: 'bottom',
            align: 'center',
          },
        });
      } else if (attempts < 12) {
        attempts += 1;
        setTimeout(trySpotlight, 150);
      }
    };

    setTimeout(trySpotlight, 200);
  }, [location.pathname, navigate]);

  // 5. Execute or Queue Action (Supports Mounted, Unmounted Cross-Page, and HITL Gate)
  const executeAgentAction = useCallback((actionId, actionArgs = {}) => {
    if (!actionId) return;

    const mountedAction = actionsRef.current[actionId] || registeredActions[actionId];
    const manifestEntry = UI_CAPABILITY_MANIFEST.find((m) => m.id === actionId);
    const riskLevel = mountedAction?.risk_level || manifestEntry?.risk_level || 'SAFE';

    const runNowOrNavigate = () => {
      if (mountedAction && typeof mountedAction.handler === 'function') {
        try {
          mountedAction.handler(actionArgs || {});
        } catch (err) {
          console.error(`[Agent Action] Error executing ${actionId}:`, err);
        }
        return;
      }
      // If component is not mounted yet, check if manifest knows its route!
      if (manifestEntry && manifestEntry.route && !manifestEntry.route.includes(':')) {
        pendingRouteActionRef.current = { id: actionId, args: actionArgs };
        navigate(manifestEntry.route);
      } else {
        console.warn(`[Agent Action] Action not registered and route unknown: ${actionId}`);
      }
    };

    // Gate Tier-2 ("MUTATE") actions behind Human-in-the-Loop confirmation
    if (riskLevel === 'MUTATE') {
      setPendingApproval({
        id: actionId,
        title: mountedAction?.feature_name || manifestEntry?.feature_name || actionId.replace(/_/g, ' '),
        description: mountedAction?.description || manifestEntry?.description || 'This action will modify or publish data.',
        args: actionArgs,
        onConfirm: () => {
          runNowOrNavigate();
          setPendingApproval(null);
        },
        onCancel: () => setPendingApproval(null),
      });
    } else {
      runNowOrNavigate();
    }
  }, [registeredActions, navigate]);

  // Alias for backwards compatibility
  const executeAction = executeAgentAction;

  // 6. Snapshot combines Mounted Component Actions + Global Unmounted Route Capabilities
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
        registeredActions: actionsRef.current,
        pendingApproval,
        registerAction,
        unregisterAction,
        highlightElement,
        executeAgentAction,
        executeAction,
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
