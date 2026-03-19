import { useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useShareIntent, ShareIntentModule } from 'expo-share-intent';

function getShareScheme(): string {
  const s = Constants.expoConfig?.scheme;
  return Array.isArray(s) ? s[0] ?? 'com.fromfeed.app' : s ?? 'com.fromfeed.app';
}

/**
 * Sur iOS, quand l’extension enregistre un lien sans ouvrir l’app, les données
 * restent dans l’App Group. On force une lecture au passage en actif pour les récupérer.
 */
function usePollPendingShareOnActive(isReady: boolean) {
  useEffect(() => {
    if (!isReady || Platform.OS !== 'ios' || !ShareIntentModule) return;
    const scheme = getShareScheme();
    const key = `${scheme}ShareKey`;
    const tryRead = () => {
      if (!ShareIntentModule) return;
      ShareIntentModule.getShareIntent(`${scheme}://dataUrl=${key}#weburl`);
      ShareIntentModule.getShareIntent(`${scheme}://dataUrl=${key}#text`);
    };
    tryRead();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tryRead();
    });
    return () => sub.remove();
  }, [isReady]);
}

/**
 * Hook pour gérer les URLs partagées depuis le share sheet
 * Utilise expo-share-intent pour recevoir les partages (extension ou ouverture par lien)
 */
export function useShareHandler(onUrlReceived: (url: string) => void) {
  const hasHandledShare = useRef<string | null>(null);
  const onUrlReceivedRef = useRef(onUrlReceived);
  onUrlReceivedRef.current = onUrlReceived;

  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  usePollPendingShareOnActive(isReady);

  const handleShareIntent = useCallback(() => {
    if (!shareIntent) return;

    const shareId = JSON.stringify(shareIntent);
    if (hasHandledShare.current === shareId) return;
    hasHandledShare.current = shareId;

    let extractedUrl: string | null = null;

    if ('url' in shareIntent && typeof shareIntent.url === 'string') {
      extractedUrl = shareIntent.url;
    } else if ('text' in shareIntent && typeof shareIntent.text === 'string') {
      const text = shareIntent.text;
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      extractedUrl = urlMatch?.[0] ?? (text.startsWith('http://') || text.startsWith('https://') ? text : null);
    }

    if (!extractedUrl) {
      __DEV__ && console.log('[ShareHandler] Aucune URL trouvée dans le contenu partagé:', shareIntent);
      resetShareIntent(true);
      return;
    }

    onUrlReceivedRef.current(extractedUrl);
    resetShareIntent(true);
  }, [shareIntent, resetShareIntent]);

  useEffect(() => {
    if (!isReady || !hasShareIntent) return;
    handleShareIntent();
  }, [isReady, hasShareIntent, handleShareIntent]);
}
