import { apiRequest } from './client';

export interface CollectionSummary {
  id: string;
  name: string;
  description?: string | null;
  createdBy: string;
  createdAt: string;
  placesCount: number;
  sharedWithGroups: string[];
  isPrivate: boolean;
  coverImage?: string | null;
}

export interface CollectionDetail {
  id: string;
  name: string;
  description?: string | null;
  createdBy: string;
  createdAt: string;
  isPrivate: boolean;
  coverImage?: string | null;
  places: Array<{
    id: string;
    placeId: string;
    placeName?: string | null;
    address?: string | null;
    city?: string | null;
    googleFormattedAddress?: string | null;
    googlePhotoUrl?: string | null;
    googleRating?: number | null;
    addedAt: string;
  }>;
  sharedWithGroups: Array<{ id: string; name: string }>;
}

export async function getCollections(): Promise<{ collections: CollectionSummary[] } | null> {
  return apiRequest('/api/collections');
}

export async function getCollection(collectionId: string): Promise<{ collection: CollectionDetail } | null> {
  return apiRequest(`/api/collections/${collectionId}`);
}

export async function createCollection(data: {
  name: string;
  description?: string;
  isPrivate?: boolean;
  coverImage?: string;
  placeIds?: string[];
  groupIds?: string[];
}): Promise<{ collection: CollectionSummary } | null> {
  return apiRequest('/api/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCollection(collectionId: string, data: {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  coverImage?: string;
}): Promise<{ collection: CollectionSummary } | null> {
  return apiRequest(`/api/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCollection(collectionId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}`, { method: 'DELETE' });
}

export async function duplicateCollection(collectionId: string): Promise<{ collection: CollectionSummary } | null> {
  return apiRequest(`/api/collections/${collectionId}/duplicate`, { method: 'POST' });
}

export async function addPlaceToCollection(collectionId: string, placeId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/places`, {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  });
}

export async function removePlaceFromCollection(collectionId: string, placeId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/places/${placeId}`, { method: 'DELETE' });
}

export async function batchUpdateCollectionPlaces(
  collectionId: string,
  addPlaceIds: string[],
  removePlaceIds: string[]
): Promise<{ message: string; added: number; removed: number } | null> {
  return apiRequest(`/api/collections/${collectionId}/places/batch`, {
    method: 'PUT',
    body: JSON.stringify({ addPlaceIds, removePlaceIds }),
  });
}

export async function shareCollectionWithGroup(collectionId: string, groupId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/groups`, {
    method: 'POST',
    body: JSON.stringify({ groupId }),
  });
}

export async function unshareCollectionFromGroup(collectionId: string, groupId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/groups/${groupId}`, { method: 'DELETE' });
}

export async function getPlaceCollections(placeId: string): Promise<{ collectionIds: string[] } | null> {
  return apiRequest(`/api/collections/places/${placeId}`);
}
