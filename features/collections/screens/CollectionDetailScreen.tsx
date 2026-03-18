import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  useColorScheme,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  MarkerView,
  LocationPuck,
} from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Toast from '@/components/common/Toast';
import GlassButton from '@/components/ui/GlassButton';
import { getCollection, getAllPlacesSummary, type PlaceSummary } from '@/lib/api';
import { useMap } from '@/features/places/hooks/useMap';
import { useToast } from '@/hooks/useToast';
import { Colors } from '@/constants/theme';
import { placesToGeoJSON } from '@/features/places/utils/placesToGeoJSON';

const CLUSTER_RED = '#E53935';
const MAPBOX_STYLE_LIGHT = 'mapbox://styles/mapbox/standard';
const MAPBOX_STYLE_DARK = 'mapbox://styles/mapbox/standard';

export default function CollectionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const mapStyle = isDark ? MAPBOX_STYLE_LIGHT : MAPBOX_STYLE_DARK;

  const { region, loadingLocation, cameraRef, animateToUser, startWatchingUser, stopWatchingUser, isProgrammaticChange, location } = useMap();
  const shapeSourceRef = useRef<ShapeSource>(null);
  const { toast, showError, hideToast } = useToast();

  const [collectionName, setCollectionName] = useState('');
  const [collectionPlaces, setCollectionPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUser, setFollowUser] = useState(false);

  const loadCollection = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [collectionRes, placesRes] = await Promise.all([
        getCollection(id),
        getAllPlacesSummary(),
      ]);
      if (!collectionRes?.collection || !placesRes?.places) {
        showError('Impossible de charger la collection');
        return;
      }
      setCollectionName(collectionRes.collection.name);
      const placeIds = new Set(collectionRes.collection.places.map((collectionPlace: { placeId: string }) => collectionPlace.placeId));
      setCollectionPlaces(placesRes.places.filter((place) => placeIds.has(place.id)));
    } catch {
      showError('Impossible de charger la collection');
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useFocusEffect(
    useCallback(() => {
      loadCollection();
    }, [loadCollection])
  );

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

  const handleRegionDidChange = useCallback(
    (regionFeature: { properties?: { isUserInteraction?: boolean } }) => {
      if (!regionFeature?.properties?.isUserInteraction) return;
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
            onRegionDidChange={handleRegionDidChange}
          >
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
              cluster
              clusterRadius={15}
              clusterMaxZoomLevel={14}
              onPress={handleShapePress as (e: unknown) => void}
            >
              <CircleLayer
                id="collection-clusters"
                filter={['has', 'point_count']}
                style={{
                  circleRadius: 18,
                  circleColor: CLUSTER_RED,
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#fff',
                  circlePitchAlignment: 'viewport',
                }}
              />
              <SymbolLayer
                id="collection-cluster-count"
                filter={['has', 'point_count']}
                style={{
                  textField: ['get', 'point_count_abbreviated'],
                  textSize: 12,
                  textColor: '#fff',
                  textPitchAlignment: 'viewport',
                }}
              />
            </ShapeSource>
            {validPlaces.map((place) => (
              <MarkerView
                key={place.id}
                coordinate={[place.lon!, place.lat!]}
                allowOverlap={false}
              >
                <View
                  style={[
                    markerStyles.emojiBox,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={markerStyles.emoji}>
                    {place.markerEmoji ?? '📍'}
                  </Text>
                </View>
              </MarkerView>
            ))}
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

const MARKER_BOX = 40;

const markerStyles = StyleSheet.create({
  emojiBox: {
    width: MARKER_BOX,
    height: MARKER_BOX,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: MARKER_BOX / 2,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  emoji: {
    fontSize: 22,
    textAlign: 'center',
  },
});

