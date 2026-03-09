import { useEffect } from 'react';
import { useAgentSpacesStore } from '../store/useAgentSpacesStore';

export function useElectronBridge(): void {
  const initialize = useAgentSpacesStore((state) => state.initialize);
  const setBootError = useAgentSpacesStore((state) => state.setBootError);
  const setWorkspaceState = useAgentSpacesStore((state) => state.setWorkspaceState);
  const upsertBlock = useAgentSpacesStore((state) => state.upsertBlock);

  useEffect(() => {
    if (!window.agentSpaces) {
      setBootError('Electron preload bridge is unavailable. Restart the app after rebuilding the preload script.');
      return;
    }

    void window.agentSpaces
      .bootstrap()
      .then(initialize)
      .catch((error: unknown) => {
        setBootError(error instanceof Error ? error.message : 'Failed to bootstrap AgentSpaces.');
      });

    const unsubscribers = [
      window.agentSpaces.onWorkspaceState((event) => setWorkspaceState(event.workspaces, event.panes)),
      window.agentSpaces.onCommandBlockStart((event) => upsertBlock(event.block)),
      window.agentSpaces.onCommandBlockEnd((event) => upsertBlock(event.block))
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [initialize, setBootError, setWorkspaceState, upsertBlock]);
}
