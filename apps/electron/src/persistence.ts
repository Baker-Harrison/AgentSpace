import ElectronStoreModule from 'electron-store';
import { createEmptyState, persistedStateSchema, type PersistedState } from '@agentspaces/shared';

type StoreShape = {
  state: PersistedState;
};

const ElectronStore = (ElectronStoreModule as { default?: typeof ElectronStoreModule }).default ?? ElectronStoreModule;

export class PersistenceService {
  private readonly store = new ElectronStore<StoreShape>({
    name: 'agentspaces',
    defaults: {
      state: createEmptyState()
    }
  });

  load(): PersistedState {
    const raw = this.store.get('state');
    const parsed = persistedStateSchema.safeParse(raw);
    return parsed.success ? parsed.data : createEmptyState();
  }

  save(state: PersistedState): void {
    this.store.set('state', state);
  }
}
