import { useEffect, useRef } from 'react';
import { useAgent } from '../context/AgentContext';

/**
 * useAgentAction
 * Allows any active component to register interactive capabilities with the AI Copilot.
 * Automatically cleans up on unmount.
 *
 * @param {string} id - Unique action identifier (e.g., 'open_share_modal', 'toggle_story_creator')
 * @param {string} description - Natural language description so Gemini knows when to trigger it
 * @param {Function} handler - Callback invoked when the AI triggers this action
 * @param {Object} [parameters={}] - Optional parameter schema for dynamic args
 * @param {Array} [deps=[]] - Dependency array to refresh handler if state changes
 */
export function useAgentAction(idOrConfig, maybeDescription, maybeHandler, maybeParameters = {}, maybeDeps = []) {
  const { registerAction, unregisterAction } = useAgent();

  let id;
  let description = '';
  let handler = null;
  let parameters = {};
  let deps = [];
  let requiresConfirmation = false;
  let risk_level = 'SAFE';
  let feature_name = '';

  if (typeof idOrConfig === 'object' && idOrConfig !== null) {
    id = idOrConfig.id;
    description = idOrConfig.description || '';
    handler = idOrConfig.handler;
    parameters = idOrConfig.parameters || {};
    deps = idOrConfig.deps || [];
    requiresConfirmation = Boolean(idOrConfig.requiresConfirmation ?? idOrConfig.requires_confirmation);
    risk_level = idOrConfig.risk_level || (requiresConfirmation ? 'MUTATE' : 'SAFE');
    feature_name = idOrConfig.feature_name || idOrConfig.title || '';
  } else {
    id = idOrConfig;
    description = maybeDescription || '';
    handler = maybeHandler;
    parameters = maybeParameters || {};
    deps = maybeDeps || [];
  }

  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!id || typeof handlerRef.current !== 'function') return;

    registerAction(id, {
      description,
      parameters,
      requiresConfirmation,
      risk_level,
      feature_name,
      handler: (args) => {
        if (handlerRef.current) {
          return handlerRef.current(args);
        }
      }
    });

    return () => {
      unregisterAction(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, description, requiresConfirmation, risk_level, feature_name, registerAction, unregisterAction, ...deps]);
}

export default useAgentAction;
