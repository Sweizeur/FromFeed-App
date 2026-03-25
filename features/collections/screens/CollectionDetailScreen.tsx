import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  useColorScheme,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  LocationPuck,
  StyleImport,
  type MapState,
} from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Toast from '@/components/common/Toast';
import GlassButton from '@/components/ui/GlassButton';
import MapMarkers from '@/features/places/components/MapMarkers';
import { getAllPlacesSummary, type PlaceSummary } from '@/lib/api';
import { useCollection } from '@/features/collections/hooks/useCollection';
import { useQuery } from '@tanstack/react-query';
import { useMap } from '@/features/places/hooks/useMap';
import { useToast } from '@/hooks/useToast';
import { Colors } from '@/constants/theme';
import { placesToGeoJSON } from '@/features/places/utils/placesToGeoJSON';
import {
  useMapStyleConfig,
  CLUSTER_LAYER_STYLE,
  CLUSTER_COUNT_LAYER_STYLE,
  CLUSTER_SOURCE_PROPS,
} from '@/features/places/constants/map-config';

export default function CollectionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { styleURL: mapStyle, config: mapConfig } = useMapStyleConfig();

  const { region, loadingLocation, cameraRef, animateToUser, startWatchingUser, stopWatchingUser, isProgrammaticChange, location } = useMap();
  const shapeSourceRef = useRef<ShapeSource>(null);
  const { toast, showError, hideToast } = useToast();

  const [followUser, setFollowUser] = useState(false);

  const { data: collectionData, isLoading: loadingCollection } = useCollection(id);
  const { data: placesData } = useQuery({
    queryKey: ['places', 'summary'],
    queryFn: async () => {
      const res = await getAllPlacesSummary();
      return res?.places ?? [];
    },
    staleTime: 30_000,
  });

  const collectionName = collectionData?.name ?? '';
  const collectionPlaces = useMemo(() => {
    if (!collectionData?.places || !placesData) return [];
    const placeIds = new Set(collectionData.places.map((cp: { placeId: string }) => cp.placeId));
    return placesData.filter((place) => placeIds.has(place.id));
  }, [collectionData, placesData]);
  const loading = loadingCollection;

  const validPlaces = useMemo(
    () => collectionPlaces.filter((place) => place.lat != null && place.lon != null && !isNaN(place.lat) && !isNaN(place.lon)),
    [collectionPlaces]
  );

  const handleCenterUser = useCallback(async () => {
    if (followUser) {
      setFollowUser(false);
      stopWatchingUser();
    } else {
      setFollowUser(true);
      await startWatchingUser();
      await animateToUser();
    }
  }, [followUser, startWatchingUser, stopWatchingUser, animateToUser]);

  const handleCameraChanged = useCallback(
    (state: MapState) => {
      if (!state.gestures?.isGestureActive) return;
      if (isProgrammaticChange()) return;
      if (followUser) {
        setFollowUser(false);
        stopWatchingUser();
      }
    },
    [followUser, isProgrammaticChange, stopWatchingUser]
  );

  const geoJson = useMemo(() => placesToGeoJSON(validPlaces), [validPlaces]);

  const handleShapePress = useCallback(
    async (
      event: { features: Array<{ properties?: Record<string, unknown> | null; geometry?: { coordinates?: number[] } }> }
    ) => {
      const feature = event.features?.[0];
      if (!feature?.properties) return;
      const props = feature.properties;
      const isCluster = 'point_count' in props && typeof props.point_count === 'number';
      const coords = feature.geometry?.coordinates;
      const coordPair = coords && coords.length >= 2 ? ([coords[0], coords[1]] as [number, number]) : undefined;
      if (isCluster && shapeSourceRef.current && coordPair) {
        try {
          const zoom = await shapeSourceRef.current.getClusterExpansionZoom(feature as any);
          cameraRef.current?.setCamera({
            centerCoordinate: coordPair,
            zoomLevel: zoom,
            animationDuration: 400,
            animationMode: 'flyTo',
          });
        } catch {
          cameraRef.current?.flyTo(coordPair, 600);
        }
      }
    },
    [cameraRef]
  );

  const nameMatch = collectionName.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*(.*)$/u);
  const displayEmoji = nameMatch ? nameMatch[1] : '📁';
  const displayName = nameMatch ? nameMatch[2] : collectionName;

  const pillBg = isDark ? 'rgba(58,59,61,0.6)' : 'rgba(250,248,242,0.92)';
  const pillBorder = isDark ? 'rgba(255,255,255,0.10)' : theme.border;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.headerOuter, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <BlurView
          intensity={isDark ? 70 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.blur,
            {
              backgroundColor: isDark ? 'rgba(28,28,30,0.85)' : 'rgba(250,248,242,0.88)',
              borderColor: pillBorder,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                style={[styles.backButton, { backgroundColor: pillBg, borderColor: pillBorder }]}
              >
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </Pressable>
              <View style={styles.headerTextCol}>
                <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
                  {displayEmoji} {displayName}
                </Text>
                <Pressable onPress={() => router.push(`/collections/${id}/places`)} hitSlop={4}>
                  <Text style={[styles.headerCount, { color: theme.icon }]}>
                    {collectionPlaces.length} lieu{collectionPlaces.length !== 1 ? 'x' : ''}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.headerActions}>
              <GlassButton
                icon="add"
                onPress={() => router.push(`/collections/${id}/places`)}
                accessibilityLabel="Gérer les lieux"
                textColor={theme.text}
                backgroundColor={isDark ? '#3a3b3d' : pillBg}
                borderColor={isDark ? '#3a3b3d' : pillBorder}
              />
            </View>
          </View>
        </BlurView>
      </View>

      <View style={styles.mapContainer}>
        {loadingLocation && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
          </View>
        )}
        {!loadingLocation && region && (
          <MapView
            style={StyleSheet.absoluteFillObject}
            styleURL={mapStyle}
            projection="globe"
            onCameraChanged={handleCameraChanged}
          >
            <StyleImport id="basemap" existing config={mapConfig} />
            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: region.centerCoordinate,
                zoomLevel: region.zoomLevel,
              }}
              animationDuration={1000}
              animationMode="flyTo"
            />
            {location && (
              <LocationPuck visible puckBearing="heading" puckBearingEnabled />
            )}
            <ShapeSource
              ref={shapeSourceRef}
              id="collection-places"
              shape={geoJson}
              {...CLUSTER_SOURCE_PROPS}
              onPress={handleShapePress as (e: unknown) => void}
            >
              <CircleLayer
                id="collection-clusters"
                filter={['has', 'point_count']}
                style={CLUSTER_LAYER_STYLE}
              />
              <SymbolLayer
                id="collection-cluster-count"
                filter={['has', 'point_count']}
                style={CLUSTER_COUNT_LAYER_STYLE as Record<string, unknown>}
              />
            </ShapeSource>
            <MapMarkers
              places={validPlaces}
              theme={theme}
              onPlacePress={() => {}}
            />
          </MapView>
        )}
        {!loadingLocation && !region && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
          </View>
        )}

        {!loadingLocation && region && (
          <View style={[styles.centerUserButton, { bottom: insets.bottom + 24 }]} pointerEvents="box-none">
            <GlassButton
              icon="locate"
              onPress={handleCenterUser}
              active={followUser}
              activeTint="#0a7ea4"
              activeTextColor="#fff"
              textColor="#fff"
              backgroundColor="#3a3b3d"
              borderColor="#3a3b3d"
              forceSolid
            />
          </View>
        )}
      </View>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerOuter: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  blur: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTextCol: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    marginLeft: 8,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerCount: {
    fontSize: 13,
    marginTop: 2,
  },
  mapContainer: { flex: 1, position: 'relative', width: '100%' },
  centerUserButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
});


