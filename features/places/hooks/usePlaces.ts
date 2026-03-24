import type { Place, PlaceSummary } from '@/features/places/types';
import { getAllPlacesSummary, getPlaceDetails } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

const STALE_TIME = 30 * 1000; // 30 seconds

function filterValidPlaces(places: PlaceSummary[]): PlaceSummary[] {
  return places.filter(
    (place) =>
      place?.id &&
      place.lat != null &&
      place.lon != null &&
      !isNaN(place.lat) &&
      !isNaN(place.lon) &&
      isFinite(place.lat) &&
      isFinite(place.lon)
  );
}

export function usePlaces() {
  const queryClient = useQueryClient();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const {
    data: placesSummary = [],
    isLoading,
    isFetching,
    isRefetching,
    error: queryError,
  } = useQuery({
    queryKey: ['places', 'summary'],
    queryFn: async () => {
      const response = await getAllPlacesSummary(false);
      return filterValidPlaces(response?.places ?? []);
    },
    staleTime: STALE_TIME,
    gcTime: 5 * 60 * 1000,
  });

  const loading = isLoading;
  const refreshing = isRefetching;
  const error = queryError?.message ?? null;

  const loadPlaces = useCallback(
    async (skipCache = false, _forceRefresh = false) => {
      if (skipCache) {
        await queryClient.invalidateQueries({ queryKey: ['places', 'summary'] });
        await queryClient.refetchQueries({ queryKey: ['places', 'summary'] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['places', 'summary'] });
      }
    },
    [queryClient]
  );

  const refreshPlaces = useCallback(
    async (skipCache = false, _silent = false) => {
      if (skipCache) {
        await queryClient.refetchQueries({ queryKey: ['places', 'summary'] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['places', 'summary'] });
      }
    },
    [queryClient]
  );

  const loadingPlaceRef = useRef<string | null>(null);

  const loadPlaceDetails = useCallback(async (placeId: string) => {
    if (loadingPlaceRef.current === placeId) return;
    loadingPlaceRef.current = placeId;
    try {
      const place = await queryClient.fetchQuery({
        queryKey: ['place', placeId],
        queryFn: async () => {
          const response = await getPlaceDetails(placeId);
          return response?.place ?? null;
        },
        staleTime: 30_000,
      });
      if (place) setSelectedPlace(place);
    } catch (err) {
      __DEV__ && console.error('[usePlaces] Erreur lors du chargement des détails:', err);
    } finally {
      loadingPlaceRef.current = null;
    }
  }, [queryClient]);

  const clearSelectedPlace = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  return {
    placesSummary,
    selectedPlace,
    loading,
    error,
    placesListKey: 0,
    refreshing,
    loadPlaces,
    refreshPlaces,
    loadPlaceDetails,
    clearSelectedPlace,
    setSelectedPlace,
  };
}
