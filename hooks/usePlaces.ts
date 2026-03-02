import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllPlacesSummary, getPlaceDetails, type Place, type PlaceSummary } from '@/lib/api';

// Cache côté client pour éviter les requêtes multiples
const CLIENT_CACHE_DURATION = 30 * 1000; // 30 secondes
let clientCache: {
  data: PlaceSummary[];
  timestamp: number;
} | null = null;

/**
 * Hook pour gérer les places (chargement, rafraîchissement, sélection)
 */
export function usePlaces() {
  // Ref pour éviter les requêtes simultanées multiples
  const isLoadingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  /**
   * Filtre les places pour ne garder que celles avec des coordonnées valides
   */
  const filterValidPlaces = useCallback((places: PlaceSummary[]) => {
    return places.filter(
      (place) =>
        place &&
        place.id &&
        place.lat != null &&
        place.lon != null &&
        !isNaN(place.lat) &&
        !isNaN(place.lon) &&
        isFinite(place.lat) &&
        isFinite(place.lon)
    );
  }, []);

  // Initialiser avec le cache client si disponible (évite l'effet de reload)
  const [placesSummary, setPlacesSummary] = useState<PlaceSummary[]>(() => {
    if (clientCache && (Date.now() - clientCache.timestamp) < CLIENT_CACHE_DURATION) {
      // Filtrer les places valides depuis le cache
      return clientCache.data.filter(
        (place) =>
          place &&
          place.id &&
          place.lat != null &&
          place.lon != null &&
          !isNaN(place.lat) &&
          !isNaN(place.lon) &&
          isFinite(place.lat) &&
          isFinite(place.lon)
      );
    }
    return [];
  });
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  // Ne pas afficher le loader si on a déjà des données du cache
  const [loading, setLoading] = useState(() => {
    // Si on a des données du cache, ne pas afficher le loader
    return placesSummary.length === 0;
  });
  const [error, setError] = useState<string | null>(null);
  const [placesListKey, setPlacesListKey] = useState(0); // Key pour forcer le re-render de PlacesList
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Charge toutes les places depuis l'API
   * Utilise le cache par défaut (pour load initial et changement de page)
   * @param skipCache Si true, bypass le cache Redis ET le cache client
   * @param forceRefresh Si true, force le rechargement même si le cache client est valide
   */
  const loadPlaces = useCallback(async (skipCache: boolean = false, forceRefresh: boolean = false) => {
    // Vérifier le cache client si on ne force pas le refresh
    if (!forceRefresh && !skipCache && clientCache) {
      const cacheAge = Date.now() - clientCache.timestamp;
      if (cacheAge < CLIENT_CACHE_DURATION) {
        console.log('[usePlaces] Utilisation du cache client (âge:', Math.round(cacheAge / 1000), 's)');
        const validPlaces = filterValidPlaces(clientCache.data);
        setPlacesSummary(validPlaces);
        setLoading(false);
        return;
      }
    }

    // Éviter les requêtes simultanées multiples
    if (isLoadingRef.current) {
      console.log('[usePlaces] Requête déjà en cours, skip...');
      // Utiliser le cache client si disponible pendant qu'une requête est en cours
      if (clientCache) {
        const validPlaces = filterValidPlaces(clientCache.data);
        setPlacesSummary(validPlaces);
        setLoading(false);
      }
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);
      
      console.log('[usePlaces] Chargement de toutes les places...', skipCache ? '(skip cache)' : '(avec cache)');
      const response = await getAllPlacesSummary(skipCache);
      const places = response?.places ?? [];
      console.log('[usePlaces] Places chargées:', places.length);

      const validPlaces = filterValidPlaces(places);

      // Mettre à jour le cache client
      clientCache = {
        data: places,
        timestamp: Date.now(),
      };
      
      setPlacesSummary(validPlaces);
    } catch (err) {
      __DEV__ && console.error('[usePlaces] Erreur lors du chargement des places:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des places');
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [filterValidPlaces]);

  /**
   * Rafraîchit la liste des places
   * @param skipCache Si true, bypass le cache Redis (pour reload manuel uniquement)
   *                  Si false, utilise le cache (pour actions automatiques)
   * @param silent Si true, ne montre pas le loader (pour polling discret)
   */
  const refreshPlaces = useCallback(async (skipCache: boolean = false, silent: boolean = false) => {
    // Éviter les requêtes multiples simultanées
    if (isRefreshingRef.current) {
      console.log('[usePlaces] Rafraîchissement déjà en cours, ignoré');
      return;
    }

    // Pour refreshPlaces, on force toujours le rechargement (forceRefresh=true)
    // mais on respecte skipCache pour le cache Redis
    try {
      isRefreshingRef.current = true;
      if (!silent) {
        setRefreshing(true);
      }
      console.log('[usePlaces] Rafraîchissement des places...', skipCache ? '(skip cache)' : '(avec cache)', silent ? '(silent)' : '');
      
      const response = await getAllPlacesSummary(skipCache);
      const validPlaces = filterValidPlaces(response.places);
      
      // Mettre à jour le cache client
      clientCache = {
        data: response.places,
        timestamp: Date.now(),
      };
      
      setPlacesSummary(validPlaces);
      setPlacesListKey((prev) => prev + 1); // Forcer le re-render de PlacesList
    } catch (err) {
      __DEV__ && console.error('[usePlaces] Erreur lors du rafraîchissement des places:', err);
      // Ne pas propager l'erreur pour les erreurs réseau silencieuses
    } finally {
      isRefreshingRef.current = false;
      if (!silent) {
        // Petit délai pour laisser le RefreshControl natif terminer son animation (évite le warning UIKit)
        setTimeout(() => setRefreshing(false), 100);
      }
    }
  }, [filterValidPlaces]);

  /**
   * Charge les détails complets d'une place
   */
  const loadPlaceDetails = useCallback(async (placeId: string) => {
    try {
      console.log('[usePlaces] Chargement des détails complets pour:', placeId);
      const response = await getPlaceDetails(placeId);
      setSelectedPlace(response.place);
    } catch (err) {
      __DEV__ && console.error('[usePlaces] Erreur lors du chargement des détails:', err);
      // Erreur silencieuse - l'utilisateur ne doit pas voir les erreurs techniques
    }
  }, []);

  /**
   * Réinitialise la sélection de place
   */
  const clearSelectedPlace = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  // Charger les places au montage
  // Utiliser le cache client si disponible (évite les requêtes multiples lors de switch rapide)
  useEffect(() => {
    // Si on a déjà des données (depuis l'initialisation du state), vérifier si on doit recharger
    if (placesSummary.length > 0) {
      // Vérifier si le cache est encore valide
      if (clientCache && (Date.now() - clientCache.timestamp) < CLIENT_CACHE_DURATION) {
        // Cache encore valide, ne pas recharger
        console.log('[usePlaces] Données déjà disponibles depuis le cache valide, pas de rechargement');
        return;
      }
      // Cache expiré, recharger silencieusement en arrière-plan
      console.log('[usePlaces] Cache expiré, rechargement en arrière-plan');
      loadPlaces(false, false).catch(() => {
        // Erreur silencieuse, on garde les données du cache
      });
      return;
    }

    // Si on a des données en cache client récentes, les utiliser directement
    if (clientCache && (Date.now() - clientCache.timestamp) < CLIENT_CACHE_DURATION) {
      console.log('[usePlaces] Utilisation du cache client au montage');
      const validPlaces = filterValidPlaces(clientCache.data);
      setPlacesSummary(validPlaces);
      setLoading(false);
      // Ne PAS recharger si le cache est encore valide (évite les requêtes inutiles)
    } else {
      // Pas de cache ou cache expiré, charger normalement
      loadPlaces();
    }
  }, [loadPlaces, filterValidPlaces, placesSummary.length]);

  return {
    placesSummary,
    selectedPlace,
    loading,
    error,
    placesListKey,
    refreshing,
    loadPlaces,
    refreshPlaces,
    loadPlaceDetails,
    clearSelectedPlace,
    setSelectedPlace,
  };
}

