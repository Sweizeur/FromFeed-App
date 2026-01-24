import { useEffect, useRef } from 'react';
import { useShareIntent } from 'expo-share-intent';

/**
 * Hook pour gérer les URLs partagées depuis le share sheet
 * Intercepte les URLs TikTok/Instagram et les passe au callback
 * Utilise expo-share-intent pour recevoir les partages depuis le share sheet
 */
export function useShareHandler(onUrlReceived: (url: string) => void) {
  const hasHandledShare = useRef<string | null>(null);
  
  // Utiliser le hook useShareIntent d'expo-share-intent
  const { isReady, hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

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
        // Nettoyer quand même le share intent
        resetShareIntent(true);
        return;
      }

      // Vérifier si c'est une URL TikTok ou Instagram
      const isTikTok = extractedUrl.includes('tiktok.com') || extractedUrl.includes('vm.tiktok.com');
      const isInstagram = extractedUrl.includes('instagram.com') && extractedUrl.includes('/reel/');

      if (isTikTok || isInstagram) {
        console.log('[ShareHandler] URL TikTok/Instagram détectée:', extractedUrl);
        onUrlReceived(extractedUrl);
        // Nettoyer le share intent après traitement
        resetShareIntent(true);
      } else {
        console.log('[ShareHandler] URL partagée non supportée:', extractedUrl);
        // Nettoyer le share intent même si l'URL n'est pas supportée
        resetShareIntent(true);
      }
    }
  }, [isReady, hasShareIntent, shareIntent, onUrlReceived, resetShareIntent]);
}
