/**
 * Types pour les réponses API
 */

export interface LinkPreviewResponse {
  place?: {
    name: string;
    address?: string;
    city?: string;
    websiteUrl?: string;
    source: 'tiktok' | 'instagram';
    url: string;
  };
  llm?: {
    hasAddress: boolean;
    address: string | null;
    placeName: string | null;
    city: string | null;
    country: string | null;
    websiteUrl: string | null;
    notes: string | null;
    confidence: 'high' | 'medium' | 'low';
  } | null;
  osm?: {
    lat: string;
    lon: string;
    display_name: string;
    address?: Record<string, string>;
    [key: string]: any;
  } | null;
  google?: {
    place_id: string;
    rating?: number;
    user_ratings_total?: number;
    formatted_address?: string;
    lat?: number;
    lon?: number;
    website?: string;
    [key: string]: any;
  } | null;
  placeId?: string | null;
  // Réponse asynchrone (traitement en cours)
  processing?: boolean;
  success?: boolean;
  message?: string;
}

/**
 * Vidéo associée à un lieu
 */
export interface PlaceVideo {
  id: string;
  provider: string;
  videoId: string;
  canonicalUrl: string;
  rawTitle?: string | null;
  rawDescription?: string | null;
  createdAt: string;
}

/** Élément du fil vidéo (place_videos) pour l’onglet Recherche */
export interface PlaceVideoFeedItem {
  id: string;
  videoId: string;
  canonicalUrl: string;
  rawTitle?: string | null;
  placeId: string;
  placeName?: string | null;
  category?: string | null;
  type?: string | null;
}

/**
 * Place complète avec toutes les données
 */
export interface Place {
  id: string;
  provider: string; // Provider de la première vidéo (pour compatibilité)
  providers?: string[]; // Tous les providers présents sur les vidéos
  videoId: string; // VideoId de la première vidéo (pour compatibilité)
  canonicalUrl: string; // CanonicalUrl de la première vidéo (pour compatibilité)
  rawTitle?: string | null; // RawTitle de la première vidéo (pour compatibilité)
  rawDescription?: string | null; // RawDescription de la première vidéo (pour compatibilité)
  videos?: PlaceVideo[]; // Toutes les vidéos associées au lieu
  placeName?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  lat?: number | null;
  lon?: number | null;
  postcode?: string | null;
  googleRating?: number | null;
  googleUserRatingsTotal?: number | null;
  googleFormattedAddress?: string | null;
  googlePhone?: string | null;
  googleWebsite?: string | null;
  googlePhotoUrl?: string | null;
  userRating?: number | null; // Note personnelle de l'utilisateur (0.5 à 5, par pas de 0.5)
  category?: string | null;
  type?: string | null;
  createdAt: string;
  lastUpdated: string;
}

export interface PlacesResponse {
  places: Place[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Place avec données moyennes (pour marqueurs + liste)
 * Contient les données nécessaires pour afficher les marqueurs sur la carte
 * et la liste dans la card, mais pas tous les détails complets
 */
export interface PlaceSummary {
  id: string;
  lat: number;
  lon: number;
  placeName?: string | null;
  rawTitle?: string | null;
  googleFormattedAddress?: string | null;
  address?: string | null;
  city?: string | null;
  googleRating?: number | null;
  googleUserRatingsTotal?: number | null;
  googlePhotoUrl?: string | null;
  notes?: string | null;
  provider: string;
  canonicalUrl: string;
  websiteUrl?: string | null;
  category?: string | null;
  type?: string | null;
  userRating?: number | null; // Note personnelle de l'utilisateur (1 à 5)
  collectionIds?: string[]; // IDs des collections contenant ce lieu
}

export interface PlacesSummaryResponse {
  places: PlaceSummary[];
}

export interface PlaceDetailsResponse {
  place: Place;
}

/**
 * Activité dans un plan (restaurant, activité, etc.)
 */
export interface PlanActivity {
  id: string;
  planId: string;
  placeId: string;
  order: number; // Ordre dans la journée (0 = première activité)
  startTime?: string | null; // Heure de début optionnelle (format HH:mm)
  endTime?: string | null; // Heure de fin optionnelle (format HH:mm)
  notes?: string | null; // Notes spécifiques pour cette activité
  place: PlaceSummary; // Place associée
  createdAt: string;
}

/**
 * Plan de sortie (une journée avec plusieurs activités)
 */
export interface Plan {
  id: string;
  userId: string;
  date: string; // Date au format YYYY-MM-DD
  title?: string | null; // Titre optionnel de la sortie
  notes?: string | null; // Notes générales sur la sortie
  activities: PlanActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface PlansResponse {
  plans: Plan[];
}

export interface PlanResponse {
  plan: Plan;
}

export interface CreatePlanRequest {
  date: string; // YYYY-MM-DD
  title?: string;
  notes?: string;
  activities: {
    placeId: string;
    order: number;
    startTime?: string;
    notes?: string;
  }[];
}

export interface UpdatePlanRequest {
  title?: string;
  notes?: string;
  activities?: {
    placeId: string;
    order: number;
    startTime?: string;
    notes?: string;
  }[];
}

