import React, { useEffect } from 'react';
import { useAgent } from '../../context/AgentContext';

/**
 * Drop-in wrapper that makes ANY button, modal, or section controllable
 * and spotlightable by the Aurora AI Co-Pilot.
 *
 * Usage:
 * <AgentActionBoundary
 *   id="open_share_modal"
 *   selectorId="btn-share-property"
 *   description="Opens the campsite share modal with QR and WhatsApp links"
 *   riskLevel="SAFE"
 *   onTrigger={() => setIsShareOpen(true)}
 * >
 *   <button onClick={() => setIsShareOpen(true)}>Share</button>
 * </AgentActionBoundary>
 */
export function AgentActionBoundary({
  id,
  selectorId,
  description,
  parameters = {},
  riskLevel = 'SAFE',
  onTrigger,
  children,
  className = '',
}) {
  const { registerAction } = useAgent();

  useEffect(() => {
    if (!id || !onTrigger) return;
    const unregister = registerAction({
      id,
      description,
      parameters,
      risk_level: riskLevel,
      handler: onTrigger,
    });
    return () => unregister();
  }, [id, description, parameters, riskLevel, onTrigger, registerAction]);

  return (
    <div id={selectorId} data-agent-action={id} className={className}>
      {children}
    </div>
  );
}

export default AgentActionBoundary;
