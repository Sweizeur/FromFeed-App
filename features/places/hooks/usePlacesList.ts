import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getPlacesList } from '@/lib/api/places';
import type { PlaceSummary } from '@/features/places/types';
import { useCallback } from 'react';

const PAGE_SIZE = 20;

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

export function usePlacesList() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    error: queryError,
  } = useInfiniteQuery({
    queryKey: ['places', 'list'],
    queryFn: async ({ pageParam }) => {
      const response = await getPlacesList({
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
      });
      const places = filterValidPlaces(response?.places ?? []);
      return {
        places,
        nextCursor: response?.nextCursor ?? null,
        hasMore: response?.hasMore ?? false,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const places = data?.pages.flatMap((page) => page.places) ?? [];

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['places', 'list'] });
  }, [queryClient]);

  return {
    places,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    refresh,
    error: queryError?.message ?? null,
  };
}
