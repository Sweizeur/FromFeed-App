import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createLinkPreviewTask, getTaskStatus } from '@/lib/api';
import { useAddingPlace } from '@/contexts/AddingPlaceContext';
import { useToast } from '@/hooks/useToast';
import { useShareHandler } from '@/hooks/useShareHandler';

const PENDING_LINK_TASK_ID = '@fromfeed:pendingLinkTaskId';
const SHARED_PENDING_TASK_KEY = 'fromfeed_pending_task';
const KEYCHAIN_GROUP = 'group.com.sweizeur.fromfeedapp';
const POLL_INTERVALS = [1000, 2000, 4000, 8000, 10000];
const POLL_MAX_MS = 5 * 60 * 1000;

interface UseLinkProcessingOptions {
  onPlaceSaved: () => Promise<void>;
}

export function useLinkProcessing({ onPlaceSaved }: UseLinkProcessingOptions) {
  const { showError } = useToast();
  const {
    isAddingPlace,
    setAddingPlace,
    linkLoadStatus,
    setLinkLoadStatus,
    setSuccessMessage,
    bumpPlacesVersion,
  } = useAddingPlace();

  const [processingUrl, setProcessingUrl] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const processingUrlRef = useRef<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);
  const isRefreshingOnAppStateRef = useRef(false);

  const clearPendingTask = useCallback(() => {
    setPendingTaskId(null);
    setAddingPlace(false);
    setProcessingUrl(null);
    processingUrlRef.current = null;
    AsyncStorage.removeItem(PENDING_LINK_TASK_ID);
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, [setAddingPlace]);

  const handleSaveLink = useCallback(
    async (result: Record<string, unknown>) => {
      if (result && 'processing' in result && result.processing === true) {
        setAddingPlace(true);
        return;
      }
      if (!result?.placeId) {
        showError("Le lieu n'a pas pu être ajouté. Les informations extraites ne correspondent pas aux données Google Places.");
        setAddingPlace(false);
        setLinkLoadStatus('idle');
        return;
      }
      const llm = result.llm as Record<string, string> | undefined;
      const google = result.google as Record<string, string> | undefined;
      const place = result.place as Record<string, string> | undefined;
      const placeName = llm?.placeName || google?.name || place?.name || 'Lieu';
      const city = llm?.city || google?.formatted_address?.split(',')[0] || place?.city;
      const msg = city ? `${placeName} ajouté dans ${city} !` : `${placeName} ajouté !`;
      setSuccessMessage(msg);
      await onPlaceSaved();
      bumpPlacesVersion();
      setProcessingUrl(null);
      processingUrlRef.current = null;
    },
    [showError, onPlaceSaved, setAddingPlace, setLinkLoadStatus, setSuccessMessage, bumpPlacesVersion]
  );

  const checkTaskStatus = useCallback(
    async (taskId: string) => {
      const statusRes = await getTaskStatus(taskId);
      if (!statusRes) return false;
      if (statusRes.status === 'done' && statusRes.result) {
        setLinkLoadStatus('success');
        await handleSaveLink(statusRes.result as unknown as Record<string, unknown>);
        clearPendingTask();
        return true;
      }
      if (statusRes.status === 'failed' || statusRes.status === 'expired') {
        showError(statusRes.error || "L'analyse du lien a échoué.");
        setLinkLoadStatus('idle');
        clearPendingTask();
        return true;
      }
      return false;
    },
    [handleSaveLink, clearPendingTask, showError, setLinkLoadStatus]
  );

  const scheduleNextPoll = useCallback(
    (taskId: string, attempt: number) => {
      if (pollTimeoutRef.current) return;
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= POLL_MAX_MS) {
        showError("L'analyse prend trop de temps. Réessayez plus tard.");
        setLinkLoadStatus('idle');
        clearPendingTask();
        return;
      }
      const delay = attempt < POLL_INTERVALS.length ? POLL_INTERVALS[attempt] : 10000;
      pollTimeoutRef.current = setTimeout(async () => {
        pollTimeoutRef.current = null;
        const done = await checkTaskStatus(taskId);
        if (!done) scheduleNextPoll(taskId, attempt + 1);
      }, delay);
    },
    [checkTaskStatus, clearPendingTask, showError, setLinkLoadStatus]
  );

  const handleTaskCreated = useCallback(
    (taskId: string) => {
      setPendingTaskId(taskId);
      setAddingPlace(true);
      setLinkLoadStatus('loading');
      setProcessingUrl('En cours...');
      processingUrlRef.current = 'pending';
      AsyncStorage.setItem(PENDING_LINK_TASK_ID, taskId);
      pollStartRef.current = Date.now();
      scheduleNextPoll(taskId, 0);
    },
    [scheduleNextPoll, setAddingPlace, setLinkLoadStatus]
  );

  // Cleanup poll timeout on unmount
  useEffect(() => {
    if (!pendingTaskId) return;
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [pendingTaskId]);

  // Restore pending task from storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored = await AsyncStorage.getItem(PENDING_LINK_TASK_ID);

      if (!stored) {
        try {
          const shared = await SecureStore.getItemAsync(SHARED_PENDING_TASK_KEY, {
            accessGroup: KEYCHAIN_GROUP,
          });
          if (shared) {
            stored = shared;
            await AsyncStorage.setItem(PENDING_LINK_TASK_ID, shared);
            await SecureStore.deleteItemAsync(SHARED_PENDING_TASK_KEY, {
              accessGroup: KEYCHAIN_GROUP,
            });
          }
        } catch {}
      }

      if (cancelled || !stored) return;
      setPendingTaskId(stored);
      setAddingPlace(true);
      setLinkLoadStatus('loading');
      setProcessingUrl('En cours...');
      processingUrlRef.current = 'pending';
      pollStartRef.current = Date.now();
      scheduleNextPoll(stored, 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleNextPoll, setAddingPlace, setLinkLoadStatus]);

  // Handle shared URLs (from share intent)
  const handleSharedUrl = useCallback(
    async (url: string) => {
      if (processingUrlRef.current === url) return;
      try {
        processingUrlRef.current = url;
        const response = await createLinkPreviewTask(url);
        if (response?.taskId) {
          setPendingTaskId(response.taskId);
          setAddingPlace(true);
          setLinkLoadStatus('loading');
          setProcessingUrl(url);
          AsyncStorage.setItem(PENDING_LINK_TASK_ID, response.taskId);
          pollStartRef.current = Date.now();
          scheduleNextPoll(response.taskId, 0);
        } else {
          showError("Impossible de lancer l'analyse du lien partagé.");
          processingUrlRef.current = null;
        }
      } catch (error: unknown) {
        const err = error as { message?: string; name?: string };
        const isNetworkError =
          err.message?.includes('Network request failed') ||
          err.message?.includes('Aborted') ||
          err.name === 'AbortError';
        if (!isNetworkError) {
          console.error('[LinkProcessing] Erreur:', error);
          showError(err.message || "Une erreur est survenue lors de l'analyse du lien.");
        }
        processingUrlRef.current = null;
        setLinkLoadStatus('idle');
      }
    },
    [showError, scheduleNextPoll, setAddingPlace, setLinkLoadStatus]
  );

  useShareHandler(handleSharedUrl);

  // Handle deep links from share extension (openHostApp with ?shareUrl=...)
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const shareUrl = parsed.searchParams.get('shareUrl');
        if (shareUrl) handleSharedUrl(decodeURIComponent(shareUrl));
      } catch {}
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [handleSharedUrl]);

  // AppState: check pending tasks when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState !== 'active') return;

      let taskId = pendingTaskId ?? (await AsyncStorage.getItem(PENDING_LINK_TASK_ID));
      if (!taskId) {
        try {
          const shared = await SecureStore.getItemAsync(SHARED_PENDING_TASK_KEY, {
            accessGroup: KEYCHAIN_GROUP,
          });
          if (shared) {
            taskId = shared;
            await AsyncStorage.setItem(PENDING_LINK_TASK_ID, shared);
            await SecureStore.deleteItemAsync(SHARED_PENDING_TASK_KEY, {
              accessGroup: KEYCHAIN_GROUP,
            });
          }
        } catch {}
      }

      if (taskId) {
        if (isRefreshingOnAppStateRef.current) return;
        isRefreshingOnAppStateRef.current = true;
        try {
          const done = await checkTaskStatus(taskId);
          if (done) {
            await onPlaceSaved();
          } else {
            setPendingTaskId(taskId);
            setAddingPlace(true);
            setLinkLoadStatus('loading');
            setProcessingUrl('En cours...');
            pollStartRef.current = Date.now();
            scheduleNextPoll(taskId, 0);
          }
        } catch {}
        finally {
          setTimeout(() => {
            isRefreshingOnAppStateRef.current = false;
          }, 1000);
        }
        return;
      }
      if (isAddingPlace && processingUrl) {
        if (isRefreshingOnAppStateRef.current) return;
        isRefreshingOnAppStateRef.current = true;
        try {
          await onPlaceSaved();
        } catch {}
        finally {
          setTimeout(() => {
            isRefreshingOnAppStateRef.current = false;
          }, 1000);
        }
      }
    });
    return () => subscription.remove();
  }, [
    pendingTaskId,
    isAddingPlace,
    processingUrl,
    onPlaceSaved,
    checkTaskStatus,
    scheduleNextPoll,
    setAddingPlace,
    setLinkLoadStatus,
  ]);

  return {
    processingUrl,
    pendingTaskId,
    handleTaskCreated,
    handleSharedUrl,
    clearPendingTask,
    setProcessingUrl,
  };
}
