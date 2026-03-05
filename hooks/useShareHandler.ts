import { useEffect, useRef } from 'react';
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

  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  usePollPendingShareOnActive(isReady);

  useEffect(() => {
    // Attendre que le module soit prêt
    if (!isReady) {
      return;
    }

    // Si on a un share intent et qu'on ne l'a pas encore traité
    if (hasShareIntent && shareIntent) {
      // Créer un identifiant unique pour ce share intent
      const shareId = JSON.stringify(shareIntent);
      
      // Vérifier si on a déjà traité ce share intent
      if (hasHandledShare.current === shareId) {
        return;
      }
      
      hasHandledShare.current = shareId;

      // Fonction pour traiter une URL partagée
      let extractedUrl: string | null = null;

      // expo-share-intent peut retourner différents types de contenu
      // On cherche une URL dans le texte ou directement
      
      // Si c'est directement une URL
      if (shareIntent.url) {
        extractedUrl = shareIntent.url;
      }
      // Si c'est du texte qui contient une URL
      else if (shareIntent.text) {
        const text = shareIntent.text;
        // Chercher une URL dans le texte (format http:// ou https://)
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          extractedUrl = urlMatch[0];
        } else {
          // Si le texte entier ressemble à une URL
          if (text.startsWith('http://') || text.startsWith('https://')) {
            extractedUrl = text;
          }
        }
      }

      if (!extractedUrl) {
        console.log('[ShareHandler] Aucune URL trouvée dans le contenu partagé:', shareIntent);
        resetShareIntent(true);
        return;
      }

      // Traiter toute URL partagée (TikTok, Instagram, ou autre lien de lieu)
      onUrlReceived(extractedUrl);
      resetShareIntent(true);
    }
  }, [isReady, hasShareIntent, shareIntent, onUrlReceived, resetShareIntent]);
}
