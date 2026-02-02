import { Redirect } from 'expo-router';

/**
 * Route catch-all pour gérer les URLs non reconnues
 * Redirige vers home pour éviter les erreurs "unmatched route"
 * Utile pour les deep links d'expo-share-intent
 */
export default function UnmatchedRoute() {
  // Rediriger vers home immédiatement
  return <Redirect href="/map" />;
}
