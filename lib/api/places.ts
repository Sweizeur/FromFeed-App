import { apiRequest } from './client';
import type {
  PlacesResponse,
  PlacesSummaryResponse,
  PlacesListResponse,
  PlaceDetailsResponse,
  PlaceVideoFeedItem,
  Place,
  PlaceSummary,
} from '@/features/places/types';

export type { Place, PlaceSummary };

export async function getUserPlaces(page: number = 1, limit: number = 20): Promise<PlacesResponse | null> {
  return apiRequest<PlacesResponse>(`/api/places?page=${page}&limit=${limit}`);
}

export async function linkPlace(placeId: string): Promise<{ success: boolean; message: string } | null> {
  return apiRequest('/api/link-place', {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  });
}

export async function getAllPlacesSummary(skipCache: boolean = false): Promise<PlacesSummaryResponse | null> {
  const url = skipCache ? '/api/places/markers?skipCache=true' : '/api/places/markers';
  return apiRequest<PlacesSummaryResponse>(url);
}

export async function getPlacesCount(): Promise<{ count: number } | null> {
  return apiRequest<{ count: number }>('/api/places/count');
}

export async function getPlaceVideosFeed(params?: {
  category?: string | null;
  type?: string | null;
  limit?: number;
  q?: string | null;
}): Promise<{ videos: PlaceVideoFeedItem[] } | null> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.q != null && params.q.trim() !== '') searchParams.set('q', params.q.trim());
  const qs = searchParams.toString();
  const url = qs ? `/api/places/feed?${qs}` : '/api/places/feed';
  return apiRequest<{ videos: PlaceVideoFeedItem[] }>(url);
}

export async function getPlacesList(params?: {
  cursor?: string;
  limit?: number;
}): Promise<PlacesListResponse | null> {
  const searchParams = new URLSearchParams();
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const url = qs ? `/api/places/list?${qs}` : '/api/places/list';
  return apiRequest<PlacesListResponse>(url);
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResponse | null> {
  return apiRequest<PlaceDetailsResponse>(`/api/places/${encodeURIComponent(placeId)}`);
}

export async function updatePlaceRating(
  placeId: string,
  rating: number | null
): Promise<{ success: boolean; rating: number | null } | null> {
  return apiRequest(`/api/places/${encodeURIComponent(placeId)}/rating`, {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  });
}

export async function updatePlaceTested(
  placeId: string,
  isTested: boolean
): Promise<{ success: boolean; isTested: boolean } | null> {
  return apiRequest(`/api/places/${encodeURIComponent(placeId)}/tested`, {
    method: 'PATCH',
    body: JSON.stringify({ isTested }),
  });
}

export async function deletePlace(placeId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/places/${encodeURIComponent(placeId)}`, { method: 'DELETE' });
}
