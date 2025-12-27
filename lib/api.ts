import { getStoredToken } from './auth-mobile';
import type {
  LinkPreviewResponse,
  Place,
  PlacesResponse,
  PlaceSummary,
  PlacesSummaryResponse,
  PlaceDetailsResponse,
  Plan,
  PlanActivity,
  PlansResponse,
  PlanResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
} from '@/types/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * Effectue une requête API authentifiée
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getStoredToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Ajouter le token d'authentification si disponible
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log('[API] Requête vers:', `${BACKEND_URL}${endpoint}`, 'Method:', options.method || 'GET');
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });

  console.log('[API] Réponse status:', response.status, 'ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Erreur HTTP:', response.status, 'Body:', errorText);
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText || `HTTP error! status: ${response.status}` };
    }
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log('[API] Réponse JSON reçue');
  return data;
}

/**
 * Analyse un lien (TikTok, Instagram) et extrait les informations du lieu
 */
export async function analyzeLink(url: string): Promise<LinkPreviewResponse> {
  return apiRequest<LinkPreviewResponse>('/api/link-preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/**
 * Récupère la liste des places de l'utilisateur
 */
export async function getUserPlaces(page: number = 1, limit: number = 20): Promise<PlacesResponse> {
  return apiRequest<PlacesResponse>(`/api/places?page=${page}&limit=${limit}`, {
    method: 'GET',
  });
}

/**
 * Lie une place à l'utilisateur connecté
 */
export async function linkPlace(placeId: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/api/link-place', {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  });
}

/**
 * Récupère toutes les places avec données moyennes (pour marqueurs + liste)
 * Cette fonction charge les données nécessaires pour afficher :
 * - Les marqueurs sur la carte
 * - La liste complète dans la card
 * Les détails complets sont chargés via getPlaceDetails() quand nécessaire
 */
export async function getAllPlacesSummary(): Promise<PlacesSummaryResponse> {
  return apiRequest<PlacesSummaryResponse>('/api/places/markers', {
    method: 'GET',
  });
}

/**
 * Récupère les détails complets d'une place spécifique
 * Utilisé quand l'utilisateur clique sur un lieu pour voir tous les détails
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResponse> {
  return apiRequest<PlaceDetailsResponse>(`/api/places/${placeId}`, {
    method: 'GET',
  });
}

/**
 * Met à jour la note personnelle d'un lieu
 * @param placeId ID du lieu
 * @param rating Note entière de 1 à 5, ou null pour supprimer
 */
export async function updatePlaceRating(placeId: string, rating: number | null): Promise<{ success: boolean; rating: number | null }> {
  return apiRequest<{ success: boolean; rating: number | null }>(`/api/places/${placeId}/rating`, {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  });
}

/**
 * Récupère tous les plans de l'utilisateur
 */
export async function getPlans(): Promise<{ plans: any[] }> {
  return apiRequest<{ plans: any[] }>('/api/plans', {
    method: 'GET',
  });
}

/**
 * Récupère les détails d'un plan spécifique
 */
export async function getPlan(planId: string): Promise<{ plan: any }> {
  return apiRequest<{ plan: any }>(`/api/plans/${planId}`, {
    method: 'GET',
  });
}

/**
 * Crée un nouveau plan
 */
export async function createPlan(data: {
  date: string;
  title?: string;
  notes?: string;
  activities: {
    placeId: string;
    order: number;
    startTime?: string;
    notes?: string;
  }[];
}): Promise<{ plan: any }> {
  return apiRequest<{ plan: any }>('/api/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Met à jour un plan existant
 */
export async function updatePlan(planId: string, data: {
  title?: string;
  notes?: string;
  activities?: {
    placeId: string;
    order: number;
    startTime?: string;
    notes?: string;
  }[];
}): Promise<{ plan: any }> {
  return apiRequest<{ plan: any }>(`/api/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Supprime un plan
 */
export async function deletePlan(planId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/plans/${planId}`, {
    method: 'DELETE',
  });
}

/**
 * Supprime le lien entre un lieu et l'utilisateur (ne supprime pas le lieu en DB)
 */
export async function deletePlace(placeId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/places/${placeId}`, {
    method: 'DELETE',
  });
}

/**
 * Envoie un message à l'assistant IA
 * @param prompt Message de l'utilisateur
 * @param conversationId ID de la conversation (optionnel, pour continuer une conversation existante)
 */
export async function sendAIMessage(
  prompt: string,
  conversationId?: string
): Promise<{ success: boolean; response: string; conversationId: string }> {
  return apiRequest<{ success: boolean; response: string; conversationId: string }>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt, conversationId }),
  });
}

/**
 * Valide un plan temporaire et le crée
 */
export async function validateDraftPlan(
  conversationId: string,
  draftPlan: any,
  messageId?: string
): Promise<{ success: boolean; plan?: any; error?: string }> {
  return apiRequest<{ success: boolean; plan?: any; error?: string }>('/api/ai/draft-plan/validate', {
    method: 'POST',
    body: JSON.stringify({ conversationId, draftPlan, messageId }),
  });
}

/**
 * Rejette un plan temporaire
 */
export async function rejectDraftPlan(
  conversationId: string,
  messageId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('/api/ai/draft-plan/reject', {
    method: 'POST',
    body: JSON.stringify({ conversationId, messageId }),
  });
}

/**
 * Récupère la liste des conversations de l'utilisateur
 */
export async function getConversations(): Promise<{
  success: boolean;
  conversations: Array<{
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    _count: { messages: number };
  }>;
}> {
  return apiRequest('/api/ai/conversations', {
    method: 'GET',
  });
}

/**
 * Récupère une conversation avec ses messages
 */
export async function getConversation(conversationId: string): Promise<{
  success: boolean;
  conversation: {
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      createdAt: string;
    }>;
  };
}> {
  return apiRequest(`/api/ai/conversations/${conversationId}`, {
    method: 'GET',
  });
}

/**
 * Crée une nouvelle conversation
 */
export async function createConversation(title?: string): Promise<{
  success: boolean;
  conversation: {
    id: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
  };
}> {
  return apiRequest('/api/ai/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

/**
 * Supprime une conversation
 */
export async function deleteConversation(conversationId: string): Promise<{
  success: boolean;
  message: string;
}> {
  return apiRequest(`/api/ai/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

/**
 * Récupère tous les groupes de l'utilisateur
 */
export async function getGroups(): Promise<{
  groups: Array<{
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      isOwner: boolean;
    }>;
    sharedCollectionsCount: number;
  }>;
}> {
  return apiRequest('/api/groups', {
    method: 'GET',
  });
}

/**
 * Récupère les détails d'un groupe spécifique
 */
export async function getGroup(groupId: string): Promise<{
  group: {
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      isOwner: boolean;
    }>;
    sharedCollections: Array<{
      id: string;
      name: string;
      description?: string | null;
      isPrivate: boolean;
      coverImage?: string | null;
      placesCount: number;
      createdAt: string;
    }>;
  };
}> {
  return apiRequest(`/api/groups/${groupId}`, {
    method: 'GET',
  });
}

/**
 * Crée un nouveau groupe
 */
export async function createGroup(data: {
  name: string;
  description?: string;
  memberEmails?: string[];
}): Promise<{
  group: {
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      isOwner: boolean;
    }>;
    sharedCollectionsCount: number;
  };
}> {
  return apiRequest('/api/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Met à jour un groupe
 */
export async function updateGroup(groupId: string, data: {
  name?: string;
  description?: string;
}): Promise<{
  group: {
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      isOwner: boolean;
    }>;
    sharedCollectionsCount: number;
  };
}> {
  return apiRequest(`/api/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Supprime un groupe
 */
export async function deleteGroup(groupId: string): Promise<{ message: string }> {
  return apiRequest(`/api/groups/${groupId}`, {
    method: 'DELETE',
  });
}

/**
 * Ajoute un membre à un groupe
 */
export async function addGroupMember(groupId: string, email: string): Promise<{ message: string }> {
  return apiRequest(`/api/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Retire un membre d'un groupe
 */
export async function removeGroupMember(groupId: string, memberId: string): Promise<{ message: string }> {
  return apiRequest(`/api/groups/${groupId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

/**
 * Récupère toutes les collections de l'utilisateur
 */
export async function getCollections(): Promise<{
  collections: Array<{
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    placesCount: number;
    sharedWithGroups: string[];
    isPrivate: boolean;
    coverImage?: string | null;
  }>;
}> {
  return apiRequest('/api/collections', {
    method: 'GET',
  });
}

/**
 * Récupère les détails d'une collection spécifique
 */
export async function getCollection(collectionId: string): Promise<{
  collection: {
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
    sharedWithGroups: Array<{
      id: string;
      name: string;
    }>;
  };
}> {
  return apiRequest(`/api/collections/${collectionId}`, {
    method: 'GET',
  });
}

/**
 * Crée une nouvelle collection
 */
export async function createCollection(data: {
  name: string;
  description?: string;
  isPrivate?: boolean;
  coverImage?: string;
  placeIds?: string[];
  groupIds?: string[];
}): Promise<{
  collection: {
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    placesCount: number;
    sharedWithGroups: string[];
    isPrivate: boolean;
    coverImage?: string | null;
  };
}> {
  return apiRequest('/api/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Met à jour une collection
 */
export async function updateCollection(collectionId: string, data: {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  coverImage?: string;
}): Promise<{
  collection: {
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    placesCount: number;
    sharedWithGroups: string[];
    isPrivate: boolean;
    coverImage?: string | null;
  };
}> {
  return apiRequest(`/api/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Supprime une collection
 */
export async function deleteCollection(collectionId: string): Promise<{ message: string }> {
  return apiRequest(`/api/collections/${collectionId}`, {
    method: 'DELETE',
  });
}

/**
 * Ajoute un lieu à une collection
 */
export async function addPlaceToCollection(collectionId: string, placeId: string): Promise<{ message: string }> {
  return apiRequest(`/api/collections/${collectionId}/places`, {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  });
}

/**
 * Retire un lieu d'une collection
 */
export async function removePlaceFromCollection(collectionId: string, placeId: string): Promise<{ message: string }> {
  return apiRequest(`/api/collections/${collectionId}/places/${placeId}`, {
    method: 'DELETE',
  });
}

/**
 * Partage une collection avec un groupe
 */
export async function shareCollectionWithGroup(collectionId: string, groupId: string): Promise<{ message: string }> {
  return apiRequest(`/api/collections/${collectionId}/groups`, {
    method: 'POST',
    body: JSON.stringify({ groupId }),
  });
}

/**
 * Retire le partage d'une collection avec un groupe
 */
export async function unshareCollectionFromGroup(collectionId: string, groupId: string): Promise<{ message: string }> {
  return apiRequest(`/api/collections/${collectionId}/groups/${groupId}`, {
    method: 'DELETE',
  });
}

/**
 * Récupère les IDs des collections qui contiennent un lieu
 */
export async function getPlaceCollections(placeId: string): Promise<{
  collectionIds: string[];
}> {
  return apiRequest(`/api/collections/places/${placeId}`, {
    method: 'GET',
  });
}

// Ré-exporter les types pour compatibilité
export type {
  LinkPreviewResponse,
  Place,
  PlacesResponse,
  PlaceSummary,
  PlacesSummaryResponse,
  PlaceDetailsResponse,
  Plan,
  PlanActivity,
  PlansResponse,
  PlanResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
};
