import { useState, useEffect, useCallback } from 'react';
import { getAllPlacesSummary, getPlaceDetails, type Place, type PlaceSummary } from '@/lib/api';

/**
 * Hook pour gérer les places (chargement, rafraîchissement, sélection)
 */
export function usePlaces() {
  const [placesSummary, setPlacesSummary] = useState<PlaceSummary[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placesListKey, setPlacesListKey] = useState(0); // Key pour forcer le re-render de PlacesList
  const [refreshing, setRefreshing] = useState(false);

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

  /**
   * Charge toutes les places depuis l'API
   */
  const loadPlaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[usePlaces] Chargement de toutes les places...');
      const response = await getAllPlacesSummary();
      console.log('[usePlaces] Places chargées:', response.places.length);

      const validPlaces = filterValidPlaces(response.places);
      setPlacesSummary(validPlaces);
    } catch (err) {
      console.error('[usePlaces] Erreur lors du chargement des places:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des places');
    } finally {
      setLoading(false);
    }
  }, [filterValidPlaces]);

  /**
   * Rafraîchit la liste des places
   */
  const refreshPlaces = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await getAllPlacesSummary();
      const validPlaces = filterValidPlaces(response.places);
      setPlacesSummary(validPlaces);
      setPlacesListKey((prev) => prev + 1); // Forcer le re-render de PlacesList
    } catch (err) {
      console.error('[usePlaces] Erreur lors du rafraîchissement des places:', err);
    } finally {
      setRefreshing(false);
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
      console.error('[usePlaces] Erreur lors du chargement des détails:', err);
      throw err;
    }
  }, []);

  /**
   * Réinitialise la sélection de place
   */
  const clearSelectedPlace = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  // Charger les places au montage
  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

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

