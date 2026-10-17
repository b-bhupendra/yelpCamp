import { useEffect } from 'react';
import { useAgent } from '../context/AgentContext';

/**
 * Automatically exposes a React form's live draft state to the AI Co-Pilot
 * AND registers an AI auto-fill action + optional HITL submit action.
 */
export function useAgentFormSync({
  formId,
  formDescription,
  values,
  setValues,
  schemaProperties,
  onSubmit,
}) {
  const { registerAction, updateUiContext } = useAgent();

  // 1. Stream live draft values to uiContext so AI knows what user already typed
  useEffect(() => {
    updateUiContext(`draft_form_${formId}`, values);
    return () => updateUiContext(`draft_form_${formId}`, undefined);
  }, [formId, values, updateUiContext]);

  // 2. Register DRAFT auto-fill capability
  useEffect(() => {
    const unregisterFill = registerAction({
      id: `fill_${formId}`,
      description: `${formDescription} (Populates draft fields without submitting)`,
      risk_level: 'DRAFT',
      parameters: {
        type: 'object',
        properties: schemaProperties,
      },
      handler: (aiFields) => {
        if (!aiFields) return;
        setValues((prev) => {
          if (typeof prev === 'object' && prev !== null) {
            return { ...prev, ...aiFields };
          }
          return aiFields;
        });
      },
    });

    let unregisterSubmit = () => {};
    if (onSubmit) {
      unregisterSubmit = registerAction({
        id: `submit_${formId}`,
        description: `Submits the completed ${formId} to the server.`,
        risk_level: 'MUTATE', // Forces HITL confirmation card!
        parameters: {},
        handler: () => {
          if (typeof onSubmit === 'function') {
            onSubmit();
          }
        },
      });
    }

    return () => {
      unregisterFill();
      unregisterSubmit();
    };
  }, [formId, formDescription, schemaProperties, setValues, onSubmit, registerAction]);
}

export default useAgentFormSync;
