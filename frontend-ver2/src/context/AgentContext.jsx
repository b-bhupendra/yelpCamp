import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const AgentContext = createContext(null);

export function AgentProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Dynamic UI Context State (Snapshot for Copilot)
  const [uiContext, setUiContextState] = useState({
    current_route: location.pathname,
    active_campground_id: null,
    active_campground_title: null,
    open_modal: null,
    draft_fields: {}
  });

  // Keep route synced automatically with router changes
  useEffect(() => {
    setUiContextState((prev) => ({
      ...prev,
      current_route: location.pathname
    }));
  }, [location.pathname]);

  const setUiContext = useCallback((updater) => {
    setUiContextState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
  }, []);

  // 2. Action Registry (Actions declared by active mounted components)
  const actionsRef = useRef({});
  const [, setActionTick] = useState(0); // Trigger re-render when actions change

  const registerAction = useCallback((id, actionMeta) => {
    if (!id || !actionMeta?.handler) return;
    actionsRef.current[id] = {
      id,
      description: actionMeta.description || '',
      parameters: actionMeta.parameters || {},
      handler: actionMeta.handler
    };
    setActionTick((t) => t + 1);
  }, []);

  const unregisterAction = useCallback((id) => {
    if (id && actionsRef.current[id]) {
      delete actionsRef.current[id];
      setActionTick((t) => t + 1);
    }
  }, []);

  // Register standard global navigation actions
  useEffect(() => {
    registerAction('navigate_home', {
      description: 'Navigate to YelpCamp homepage',
      handler: () => navigate('/')
    });
    registerAction('navigate_explore', {
      description: 'Navigate to Explore all campgrounds catalog',
      handler: () => navigate('/campgrounds')
    });
    registerAction('navigate_new_campground', {
      description: 'Navigate to host a new campground submission form',
      handler: () => navigate('/campgrounds/new')
    });
    registerAction('navigate_dashboard', {
      description: 'Navigate to user account profile and campground wishlist dashboard',
      handler: () => navigate('/dashboard')
    });

    return () => {
      unregisterAction('navigate_home');
      unregisterAction('navigate_explore');
      unregisterAction('navigate_new_campground');
      unregisterAction('navigate_dashboard');
    };
  }, [navigate, registerAction, unregisterAction]);

  // 3. Driver.js UI Spotlight & Popover Highlighting
  const activeDriverRef = useRef(null);

  const highlightElement = useCallback((highlightSpec) => {
    if (!highlightSpec || !highlightSpec.dom_selector) return;

    const performHighlight = () => {
      const selector = highlightSpec.dom_selector;
      const targetEl = document.querySelector(selector);

      if (!targetEl) {
        console.warn(`[Agent Spotlight] Element not found for selector: ${selector}`);
        return;
      }

      if (activeDriverRef.current) {
        activeDriverRef.current.destroy();
      }

      const driverObj = driver({
        animate: true,
        showProgress: false,
        stagePadding: 8,
        popoverClass: 'aurora-driver-popover',
        onDestroyStarted: () => {
          driverObj.destroy();
          activeDriverRef.current = null;
        }
      });

      activeDriverRef.current = driverObj;

      driverObj.highlight({
        element: selector,
        popover: {
          title: highlightSpec.feature_name || 'Spotlight Target',
          description: highlightSpec.description || 'Here is the requested tool or control.',
          position: 'bottom',
        }
      });
    };

    // If target requires routing to another page first, navigate then highlight
    if (highlightSpec.route && highlightSpec.route !== location.pathname) {
      navigate(highlightSpec.route);
      setTimeout(performHighlight, 450);
    } else {
      performHighlight();
    }
  }, [location.pathname, navigate]);

  // 4. Action Execution Engine
  const executeAction = useCallback((actionId, actionArgs = {}) => {
    const action = actionsRef.current[actionId];
    if (action && typeof action.handler === 'function') {
      try {
        action.handler(actionArgs);
        return true;
      } catch (err) {
        console.error(`[Agent Action] Error executing action ${actionId}:`, err);
        return false;
      }
    }
    console.warn(`[Agent Action] Action not registered: ${actionId}`);
    return false;
  }, []);

  const value = {
    uiContext,
    setUiContext,
    registeredActions: actionsRef.current,
    registerAction,
    unregisterAction,
    executeAction,
    highlightElement
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}

export default AgentContext;
