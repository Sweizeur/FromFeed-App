import type { PlaceSummary } from '@/features/places/types';

const DEFAULT_EMOJI = '📍';

export interface PlaceFeatureProperties {
  id: string;
  emoji: string;
  placeName: string;
}

export interface PlaceGeoJSONFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: PlaceFeatureProperties;
}

export interface PlaceFeatureCollection {
  type: 'FeatureCollection';
  features: PlaceGeoJSONFeature[];
}

/**
 * Convertit une liste de lieux en FeatureCollection GeoJSON pour ShapeSource Mapbox.
 * Chaque feature a geometry Point et properties id, emoji, placeName.
 */
export function placesToGeoJSON(
  places: PlaceSummary[]
): PlaceFeatureCollection {
  const features: PlaceGeoJSONFeature[] = places
    .filter(
      (p) =>
        p?.id &&
        p.lat != null &&
        p.lon != null &&
        !isNaN(p.lat) &&
        !isNaN(p.lon)
    )
    .map((p) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lon!, p.lat!] as [number, number],
      },
      properties: {
        id: p.id,
        emoji: p.markerEmoji ?? DEFAULT_EMOJI,
        placeName: p.placeName || p.rawTitle || 'Lieu',
      },
    }));
  return { type: 'FeatureCollection', features };
}
