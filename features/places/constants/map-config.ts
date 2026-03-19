import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const MAPBOX_STYLE_STANDARD = 'mapbox://styles/mapbox/standard';

export const CLUSTER_RED = '#E53935';

const MAP_BASE_CONFIG = {
  colorMotorways: '#2e89ff',
  showPedestrianRoads: 'false',
  show3dObjects: 'false',
} as const satisfies Record<string, string>;

export const CLUSTER_LAYER_STYLE = {
  circleRadius: 18,
  circleColor: CLUSTER_RED,
  circleStrokeWidth: 2,
  circleStrokeColor: '#fff',
  circlePitchAlignment: 'viewport' as const,
};

export const CLUSTER_COUNT_LAYER_STYLE = {
  textField: ['get', 'point_count_abbreviated'],
  textSize: 12,
  textColor: '#fff',
  textPitchAlignment: 'viewport',
} as const;

export const CLUSTER_SOURCE_PROPS = {
  cluster: true,
  clusterRadius: 15,
  clusterMaxZoomLevel: 14,
} as const;

export function useMapStyleConfig() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const config = useMemo(
    () => ({
      ...MAP_BASE_CONFIG,
      lightPreset: isDark ? 'dusk' : 'dawn',
    }),
    [isDark],
  );

  return { styleURL: MAPBOX_STYLE_STANDARD, config };
}
