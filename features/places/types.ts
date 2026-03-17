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
    [key: string]: unknown;
  } | null;
  google?: {
    place_id: string;
    rating?: number;
    user_ratings_total?: number;
    formatted_address?: string;
    lat?: number;
    lon?: number;
    website?: string;
    [key: string]: unknown;
  } | null;
  placeId?: string | null;
  processing?: boolean;
  success?: boolean;
  message?: string;
}

export interface CreateLinkPreviewTaskResponse {
  taskId: string;
  status: 'queued';
}

export type TaskStatus = 'queued' | 'processing' | 'done' | 'failed' | 'expired';

export interface GetTaskStatusResponse {
  taskId: string;
  status: TaskStatus;
  result?: LinkPreviewResponse;
  error?: string;
}

export interface PlaceVideo {
  id: string;
  provider: string;
  videoId: string;
  canonicalUrl: string;
  rawTitle?: string | null;
  rawDescription?: string | null;
  createdAt: string;
}

export interface PlaceVideoFeedItem {
  id: string;
  provider?: 'tiktok' | 'instagram';
  videoId: string;
  canonicalUrl: string;
  rawTitle?: string | null;
  rawDescription?: string | null;
  placeId: string;
  placeName?: string | null;
  placeAddress?: string | null;
  category?: string | null;
  type?: string | null;
}

export interface Place {
  id: string;
  provider: string;
  providers?: string[];
  videoId: string;
  canonicalUrl: string;
  rawTitle?: string | null;
  rawDescription?: string | null;
  videos?: PlaceVideo[];
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
  googleOpenNow?: boolean | null;
  googleOpeningHours?: string | null;
  userRating?: number | null;
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
  googlePhone?: string | null;
  notes?: string | null;
  provider: string;
  canonicalUrl: string;
  websiteUrl?: string | null;
  category?: string | null;
  type?: string | null;
  markerEmoji?: string | null;
  userRating?: number | null;
  collectionIds?: string[];
}

export interface PlacesSummaryResponse {
  places: PlaceSummary[];
}

export interface PlaceDetailsResponse {
  place: Place;
}
