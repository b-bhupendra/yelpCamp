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
export function useAgentAction(id, description, handler, parameters = {}, deps = []) {
  const { registerAction, unregisterAction } = useAgent();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!id) return;

    registerAction(id, {
      description,
      parameters,
      handler: (args) => {
        if (handlerRef.current) {
          handlerRef.current(args);
        }
      }
    });

    return () => {
      unregisterAction(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, description, registerAction, unregisterAction, ...deps]);
}

export default useAgentAction;
