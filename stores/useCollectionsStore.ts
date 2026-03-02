import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { getCollections, deleteCollection, duplicateCollection, createCollection, updateCollection } from '@/lib/api';

export interface CollectionItem {
  id: string;
  name: string;
  description?: string | null;
  placesCount: number;
  isPrivate: boolean;
  coverImage?: string | null;
  sharedWithGroups: string[];
  createdAt: string;
}

interface StoreState {
  collections: CollectionItem[];
  loaded: boolean;
  loading: boolean;
}

type Listener = () => void;

let state: StoreState = { collections: [], loaded: false, loading: false };
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(partial: Partial<StoreState>) {
  state = { ...state, ...partial };
  emit();
}

function getSnapshot(): StoreState {
  return state;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function fetchCollections() {
  setState({ loading: true });
  try {
    const res = await getCollections();
    setState({
      collections: (res?.collections ?? []) as CollectionItem[],
      loaded: true,
      loading: false,
    });
  } catch {
    setState({ loading: false });
  }
}

// ---- public actions ----

function addOptimistic(item: CollectionItem) {
  setState({ collections: [item, ...state.collections] });
}

function removeById(id: string) {
  setState({ collections: state.collections.filter((c) => c.id !== id) });
}

function replaceById(id: string, item: CollectionItem) {
  setState({
    collections: state.collections.map((c) => (c.id === id ? item : c)),
  });
}

function updateById(id: string, partial: Partial<CollectionItem>) {
  setState({
    collections: state.collections.map((c) =>
      c.id === id ? { ...c, ...partial } : c
    ),
  });
}

// ---- hook ----

export function useCollectionsStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!snap.loaded && !snap.loading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchCollections();
    }
  }, [snap.loaded, snap.loading]);

  const refresh = useCallback(async () => {
    await fetchCollections();
  }, []);

  const optimisticDelete = useCallback((collection: CollectionItem) => {
    removeById(collection.id);
    deleteCollection(collection.id).catch(() => {
      setState({
        collections: [...state.collections, collection].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      });
    });
  }, []);

  const optimisticDuplicate = useCallback((collection: CollectionItem) => {
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
        if (res?.collection) {
          replaceById(tempId, res.collection as CollectionItem);
        }
      })
      .catch(() => {
        removeById(tempId);
      });
  }, []);

  const optimisticCreate = useCallback(
    async (data: { name: string; description?: string; isPrivate?: boolean; placeIds?: string[] }) => {
      const res = await createCollection(data);
      if (res?.collection) {
        addOptimistic(res.collection as CollectionItem);
      }
      return res;
    },
    []
  );

  const optimisticUpdate = useCallback(
    (id: string, data: { name?: string; description?: string; isPrivate?: boolean }) => {
      updateById(id, {
        name: data.name,
        description: data.description,
        isPrivate: data.isPrivate,
      });
      updateCollection(id, data).catch(() => {
        fetchCollections();
      });
    },
    []
  );

  return {
    collections: snap.collections,
    loading: !snap.loaded && snap.loading,
    refreshing: snap.loaded && snap.loading,
    refresh,
    optimisticDelete,
    optimisticDuplicate,
    optimisticCreate,
    optimisticUpdate,
  };
}
