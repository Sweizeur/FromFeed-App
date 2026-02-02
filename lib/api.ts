import { getStoredToken } from './auth-mobile';
import type {
  LinkPreviewResponse,
  Place,
  PlacesResponse,
  PlaceSummary,
  PlacesSummaryResponse,
  PlaceDetailsResponse,
  PlaceVideoFeedItem,
  Plan,
  PlanActivity,
  PlansResponse,
  PlanResponse,
  CreatePlanRequest,
  UpdatePlanRequest,
} from '@/types/api';
import Constants from 'expo-constants';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * Vérifie si on est vraiment en mode développement
 * --no-dev désactive certaines fonctionnalités mais __DEV__ peut rester true
 */
const isDevelopment = () => {
  // Vérifier plusieurs indicateurs pour être sûr
  return (
    __DEV__ &&
    process.env.NODE_ENV !== 'production' &&
    !Constants.appOwnership?.includes('expo') &&
    Constants.executionEnvironment !== 'storeClient'
  );
};

/**
 * Log uniquement en mode développement
 */
const devLog = (...args: any[]) => {
  if (isDevelopment()) {
    console.log(...args);
  }
};

const devError = (...args: any[]) => {
  if (isDevelopment()) {
    console.error(...args);
  }
};

const devWarn = (...args: any[]) => {
  if (isDevelopment()) {
    console.warn(...args);
  }
};

/**
 * Effectue une requête API authentifiée
 * Retourne null en cas d'erreur au lieu de throw pour éviter les crashes
 */
type ApiRequestOptions = RequestInit & {
  /**
   * Timeout en millisecondes avant d'annuler la requête (AbortController).
   * Par défaut: 15s.
   */
  timeoutMs?: number;
};

async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T | null> {
  const token = await getStoredToken();
  
  const { timeoutMs = 15000, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  // Ajouter le token d'authentification si disponible
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  devLog('[API] Requête vers:', `${BACKEND_URL}${endpoint}`, 'Method:', options.method || 'GET');
  
  // Ajouter les headers ngrok si nécessaire
  if (BACKEND_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  
  // Créer un AbortController pour gérer le timeout (compatible React Native)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      devError('[API] Timeout:', endpoint);
      return null;
    }
    // Ne pas logger les erreurs réseau "Network request failed" - elles sont attendues
    // quand l'utilisateur quitte l'app pendant une requête
    const isNetworkError = error?.message?.includes('Network request failed') || 
                          error?.name === 'AbortError';
    if (!isNetworkError) {
      devError('[API] Erreur réseau:', error);
    }
    return null;
  }
  
  clearTimeout(timeoutId);

  devLog('[API] Réponse status:', response.status, 'ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    devError('[API] Erreur HTTP:', response.status, 'Body:', errorText);
    return null;
  }

  try {
    const data = await response.json();
    devLog('[API] Réponse JSON reçue');
    return data;
  } catch (parseError) {
    devError('[API] Erreur parsing JSON:', parseError);
    return null;
  }
}

/**
 * Analyse un lien (TikTok, Instagram) et extrait les informations du lieu
 */
export async function analyzeLink(url: string): Promise<LinkPreviewResponse | null> {
  return apiRequest<LinkPreviewResponse>('/api/link-preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
    // Playwright + scraping peut prendre du temps en production (cold start / navigation).
    // On augmente uniquement pour cet endpoint pour éviter les 499 (client abort ~15s).
    timeoutMs: 60000,
  });
}

/**
 * Récupère la liste des places de l'utilisateur
 */
export async function getUserPlaces(page: number = 1, limit: number = 20): Promise<PlacesResponse | null> {
  return apiRequest<PlacesResponse>(`/api/places?page=${page}&limit=${limit}`, {
    method: 'GET',
  });
}

/**
 * Lie une place à l'utilisateur connecté
 */
export async function linkPlace(placeId: string): Promise<{ success: boolean; message: string } | null> {
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
 * @param skipCache Si true, force le bypass du cache Redis (pour reload manuel)
 */
export async function getAllPlacesSummary(skipCache: boolean = false): Promise<PlacesSummaryResponse | null> {
  const url = skipCache ? '/api/places/markers?skipCache=true' : '/api/places/markers';
  return apiRequest<PlacesSummaryResponse>(url, {
    method: 'GET',
  });
}

/**
 * Récupère le nombre de lieux (endpoint léger pour polling discret)
 */
export async function getPlacesCount(): Promise<{ count: number } | null> {
  return apiRequest<{ count: number }>('/api/places/count', {
    method: 'GET',
  });
}

/**
 * Récupère le fil de vidéos TikTok des lieux de l’utilisateur (aléatoire, filtré par catégorie/type).
 */
export async function getPlaceVideosFeed(params?: {
  category?: string | null;
  type?: string | null;
  limit?: number;
}): Promise<{ videos: PlaceVideoFeedItem[] } | null> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const url = qs ? `/api/places/feed?${qs}` : '/api/places/feed';
  return apiRequest<{ videos: PlaceVideoFeedItem[] }>(url, { method: 'GET' });
}

/**
 * Récupère les détails complets d'une place spécifique
 * Utilisé quand l'utilisateur clique sur un lieu pour voir tous les détails
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResponse | null> {
  return apiRequest<PlaceDetailsResponse>(`/api/places/${placeId}`, {
    method: 'GET',
  });
}

/**
 * Met à jour la note personnelle d'un lieu
 * @param placeId ID du lieu
 * @param rating Note entière de 1 à 5, ou null pour supprimer
 */
export async function updatePlaceRating(placeId: string, rating: number | null): Promise<{ success: boolean; rating: number | null } | null> {
  return apiRequest<{ success: boolean; rating: number | null }>(`/api/places/${placeId}/rating`, {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  });
}

/**
 * Récupère tous les plans de l'utilisateur
 */
export async function getPlans(): Promise<{ plans: any[] } | null> {
  return apiRequest<{ plans: any[] }>('/api/plans', {
    method: 'GET',
  });
}

/**
 * Récupère les détails d'un plan spécifique
 */
export async function getPlan(planId: string): Promise<{ plan: any } | null> {
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
}): Promise<{ plan: any } | null> {
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
}): Promise<{ plan: any } | null> {
  return apiRequest<{ plan: any }>(`/api/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Supprime un plan
 */
export async function deletePlan(planId: string): Promise<{ message: string } | null> {
  return apiRequest<{ message: string }>(`/api/plans/${planId}`, {
    method: 'DELETE',
  });
}

/**
 * Supprime le lien entre un lieu et l'utilisateur (ne supprime pas le lieu en DB)
 */
export async function deletePlace(placeId: string): Promise<{ message: string } | null> {
  return apiRequest<{ message: string }>(`/api/places/${placeId}`, {
    method: 'DELETE',
  });
}

/**
 * Envoie un message à l'assistant IA avec streaming
 * @param prompt Message de l'utilisateur
 * @param conversationId ID de la conversation (optionnel, pour continuer une conversation existante)
 * @param onChunk Callback appelé à chaque chunk reçu
 * @param onComplete Callback appelé quand la réponse est complète
 * @param onError Callback appelé en cas d'erreur
 */
// Variable pour empêcher les appels simultanés et gérer la connexion WebSocket
let isStreamingActive = false;
let currentWebSocket: WebSocket | null = null;

export async function sendAIMessageStreaming(
  prompt: string,
  conversationId: string | undefined,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string, conversationId: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  // Empêcher les appels simultanés
  if (isStreamingActive) {
    devWarn('[API] Un stream est déjà actif, annulation de la nouvelle requête');
    return;
  }

  const token = await getStoredToken();
  if (!token) {
    devError('[API] Token d\'authentification manquant');
    return;
  }

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  
  // Convertir l'URL HTTP/HTTPS en WebSocket (WS/WSS)
  let wsUrl: string;
  if (BACKEND_URL.startsWith('https://')) {
    wsUrl = BACKEND_URL.replace('https://', 'wss://') + '/api/ai/chat/ws?token=' + encodeURIComponent(token);
  } else if (BACKEND_URL.startsWith('http://')) {
    wsUrl = BACKEND_URL.replace('http://', 'ws://') + '/api/ai/chat/ws?token=' + encodeURIComponent(token);
  } else {
    // Fallback pour les URLs sans schéma
    wsUrl = `wss://${BACKEND_URL}/api/ai/chat/ws?token=${encodeURIComponent(token)}`;
  }

  return new Promise((resolve, reject) => {
    try {
      isStreamingActive = true;
      devLog('[API] Connexion WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'));

      // Fermer la connexion précédente si elle existe
      if (currentWebSocket) {
        currentWebSocket.close();
      }

      const ws = new WebSocket(wsUrl);
      currentWebSocket = ws;

      let fullResponse = '';
      let isComplete = false;
      let resolved = false;

      const cleanup = () => {
        isStreamingActive = false;
        if (currentWebSocket === ws) {
          currentWebSocket = null;
        }
        if (!resolved) {
          resolved = true;
        }
      };

      ws.onopen = () => {
        devLog('[API] WebSocket connecté, en attente du message de bienvenue...');
        // Ne pas envoyer le message immédiatement, attendre le message "connected"
      };

      ws.onmessage = (event) => {
        try {
          // Vérifier que les données existent et sont de type string
          if (!event.data || typeof event.data !== 'string') {
            devWarn('[API] Message WebSocket avec type invalide:', typeof event.data);
            return;
          }

          // Limiter la taille pour éviter les attaques DoS
          if (event.data.length > 100000) {
            devError('[API] Message WebSocket trop volumineux:', event.data.length);
            cleanup();
            ws.close();
            return;
          }

          // Parser JSON avec gestion d'erreur
          let data: any;
          try {
            data = JSON.parse(event.data);
          } catch (parseError) {
            devError('[API] Erreur de parsing JSON:', parseError, 'Data:', event.data.substring(0, 100));
            if (!isComplete) {
              cleanup();
              ws.close();
            }
            return;
          }

          // Valider la structure de base
          if (!data || typeof data !== 'object' || !data.type) {
            devWarn('[API] Message WebSocket sans type:', data);
            return;
          }

          if (data.type === 'connected') {
            devLog('[API] WebSocket:', data.message);
            // Maintenant que le serveur est prêt, envoyer le message de chat
            devLog('[API] Envoi du message de chat au serveur...');
            ws.send(JSON.stringify({
              type: 'chat',
              prompt,
              conversationId,
            }));
            return;
          }

          if (data.type === 'chunk') {
            // Valider que content existe et est une string
            if (typeof data.content === 'string') {
              fullResponse += data.content;
              onChunk(data.content);
            } else {
              devWarn('[API] Chunk sans contenu valide:', data);
            }
          } else if (data.type === 'complete') {
            isComplete = true;
            cleanup();
            const finalResponse = typeof data.response === 'string' ? data.response : fullResponse;
            const finalConversationId = typeof data.conversationId === 'string' ? data.conversationId : conversationId || '';
            onComplete(finalResponse, finalConversationId);
            ws.close();
            resolve();
          } else if (data.type === 'error') {
            cleanup();
            ws.close();
            return;
          } else {
            devWarn('[API] Type de message WebSocket inconnu:', data.type);
          }
        } catch (e) {
          devError('[API] Erreur lors du traitement du message WebSocket:', e);
          if (!isComplete) {
            cleanup();
            ws.close();
          }
        }
      };

      ws.onerror = (error) => {
        devError('[API] Erreur WebSocket:', error);
        if (!isComplete && !resolved) {
          cleanup();
        }
      };

      ws.onclose = (event) => {
        devLog('[API] WebSocket fermé, code:', event.code, 'reason:', event.reason);
        cleanup();
      };

      // Timeout de sécurité (5 minutes)
      setTimeout(() => {
        if (!isComplete && !resolved) {
          cleanup();
          ws.close();
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      isStreamingActive = false;
      currentWebSocket = null;
      devError('[API] Erreur lors de l\'initialisation WebSocket:', error);
    }
  });
}

/**
 * Envoie un message à l'assistant IA (mode classique, sans streaming)
 * @param prompt Message de l'utilisateur
 * @param conversationId ID de la conversation (optionnel, pour continuer une conversation existante)
 */
export async function sendAIMessage(
  prompt: string,
  conversationId?: string
): Promise<{ success: boolean; response: string; conversationId: string } | null> {
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
): Promise<{ success: boolean; plan?: any; error?: string } | null> {
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
): Promise<{ success: boolean; message?: string; error?: string } | null> {
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
} | null> {
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
} | null> {
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
} | null> {
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
} | null> {
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
} | null> {
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
} | null> {
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
} | null> {
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
} | null> {
  return apiRequest(`/api/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Supprime un groupe
 */
export async function deleteGroup(groupId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/groups/${groupId}`, {
    method: 'DELETE',
  });
}

/**
 * Ajoute un membre à un groupe
 */
export async function addGroupMember(groupId: string, email: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Retire un membre d'un groupe
 */
export async function removeGroupMember(groupId: string, memberId: string): Promise<{ message: string } | null> {
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
} | null> {
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
} | null> {
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
} | null> {
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
} | null> {
  return apiRequest(`/api/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Supprime une collection
 */
export async function deleteCollection(collectionId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}`, {
    method: 'DELETE',
  });
}

/**
 * Ajoute un lieu à une collection
 */
export async function addPlaceToCollection(collectionId: string, placeId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/places`, {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  });
}

/**
 * Retire un lieu d'une collection
 */
export async function removePlaceFromCollection(collectionId: string, placeId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/places/${placeId}`, {
    method: 'DELETE',
  });
}

/**
 * Partage une collection avec un groupe
 */
export async function shareCollectionWithGroup(collectionId: string, groupId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/groups`, {
    method: 'POST',
    body: JSON.stringify({ groupId }),
  });
}

/**
 * Retire le partage d'une collection avec un groupe
 */
export async function unshareCollectionFromGroup(collectionId: string, groupId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/collections/${collectionId}/groups/${groupId}`, {
    method: 'DELETE',
  });
}

/**
 * Récupère les IDs des collections qui contiennent un lieu
 */
export async function getPlaceCollections(placeId: string): Promise<{
  collectionIds: string[];
} | null> {
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
