import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';
import {
  getCollections,
  deleteCollection,
  duplicateCollection,
  createCollection,
  updateCollection,
  type CollectionSummary,
} from '@/lib/api';

export type CollectionItem = CollectionSummary;

interface CollectionsState {
  collections: CollectionItem[];
  loaded: boolean;
  loading: boolean;

  fetch: () => Promise<void>;
  addOptimistic: (item: CollectionItem) => void;
  removeById: (id: string) => void;
  replaceById: (id: string, item: CollectionItem) => void;
  updateById: (id: string, partial: Partial<CollectionItem>) => void;
}

const useStore = create<CollectionsState>((set, get) => ({
  collections: [],
  loaded: false,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await getCollections();
      set({
        collections: (res?.collections ?? []) as CollectionItem[],
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  addOptimistic: (item) =>
    set((s) => ({ collections: [item, ...s.collections] })),

  removeById: (id) =>
    set((s) => ({ collections: s.collections.filter((c) => c.id !== id) })),

  replaceById: (id, item) =>
    set((s) => ({ collections: s.collections.map((c) => (c.id === id ? item : c)) })),

  updateById: (id, partial) =>
    set((s) => ({
      collections: s.collections.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    })),
}));

export function useCollectionsStore() {
  const { collections, loaded, loading, fetch, addOptimistic, removeById, replaceById, updateById } = useStore();
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!loaded && !loading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetch();
    }
  }, [loaded, loading, fetch]);

  const refresh = useCallback(async () => {
    await fetch();
  }, [fetch]);

  const optimisticDelete = useCallback(
    (collection: CollectionItem) => {
      const prev = useStore.getState().collections;
      removeById(collection.id);
      deleteCollection(collection.id).catch(() => {
        useStore.setState({
          collections: [...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
        });
      });
    },
    [removeById]
  );

  const optimisticDuplicate = useCallback(
    (collection: CollectionItem) => {
      const tempId = `temp-${Date.now()}`;
      const optimistic: CollectionItem = {
        ...collection,
        id: tempId,
        name: `${collection.name} (copie)`,
        createdAt: new Date().toISOString(),
        sharedWithGroups: [],
      };
      addOptimistic(optimistic);

      duplicateCollection(collection.id)
        .then((res) => {
          if (res?.collection) replaceById(tempId, res.collection as CollectionItem);
        })
        .catch(() => removeById(tempId));
    },
    [addOptimistic, replaceById, removeById]
  );

  const optimisticCreate = useCallback(
    async (data: { name: string; description?: string; isPrivate?: boolean; placeIds?: string[] }) => {
      const res = await createCollection(data);
      if (res?.collection) addOptimistic(res.collection as CollectionItem);
      return res;
    },
    [addOptimistic]
  );

  const optimisticUpdate = useCallback(
    (id: string, data: { name?: string; description?: string; isPrivate?: boolean }) => {
      updateById(id, { name: data.name, description: data.description, isPrivate: data.isPrivate });
      updateCollection(id, data).catch(() => fetch());
    },
    [updateById, fetch]
  );

  return {
    collections,
    loading: !loaded && loading,
    refreshing: loaded && loading,
    refresh,
    optimisticDelete,
    optimisticDuplicate,
    optimisticCreate,
    optimisticUpdate,
  };
}
