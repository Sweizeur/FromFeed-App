import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
  useColorScheme,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Marker } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Toast from '@/components/common/Toast';
import GlassButton from '@/components/ui/GlassButton';
import { getCollection, getAllPlacesSummary, type PlaceSummary } from '@/lib/api';
import { useMap } from '@/hooks/useMap';
import { useToast } from '@/hooks/useToast';
import { darkColor, Colors } from '@/constants/theme';

const CLUSTER_RED = '#E53935';
const CLUSTER_SIZE = 32;
const CLUSTER_FONT_SIZE = 12;
const DEFAULT_MARKER_EMOJI = '📍';
const MARKER_EMOJI_SIZE = 28;
const MARKER_EMOJI_BOX = 40;

export default function CollectionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const { region, loadingLocation, mapViewRef, animateToUser, startWatchingUser, stopWatchingUser, isProgrammaticChange } = useMap();
  const { toast, showError, hideToast } = useToast();

  const [collectionName, setCollectionName] = useState('');
  const [collectionPlaces, setCollectionPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUser, setFollowUser] = useState(false);

  const loadCollection = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [colRes, placesRes] = await Promise.all([
        getCollection(id),
        getAllPlacesSummary(),
      ]);
      setCollectionName(colRes.collection.name);
      const placeIds = new Set(colRes.collection.places.map((cp: any) => cp.placeId));
      setCollectionPlaces(placesRes.places.filter((p) => placeIds.has(p.id)));
    } catch {
      showError('Impossible de charger la collection');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadCollection();
    }, [loadCollection])
  );

  const validPlaces = useMemo(
    () => collectionPlaces.filter((p) => p.lat != null && p.lon != null && !isNaN(p.lat) && !isNaN(p.lon)),
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

  const handleRegionChangeComplete = useCallback(() => {
    if (isProgrammaticChange()) return;
    if (followUser) {
      setFollowUser(false);
      stopWatchingUser();
    }
  }, [followUser, isProgrammaticChange, stopWatchingUser]);

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
      {/* Header - same style as MapTabHeader */}
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
                <Pressable onPress={() => router.push({ pathname: '/edit-collection-places', params: { id } })} hitSlop={4}>
                  <Text style={[styles.headerCount, { color: theme.icon }]}>
                    {collectionPlaces.length} lieu{collectionPlaces.length !== 1 ? 'x' : ''}
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.headerActions}>
              <GlassButton
                icon="add"
                onPress={() => router.push({ pathname: '/edit-collection-places', params: { id } })}
                accessibilityLabel="Gérer les lieux"
                textColor={theme.text}
                backgroundColor={isDark ? '#3a3b3d' : pillBg}
                borderColor={isDark ? '#3a3b3d' : pillBorder}
              />
            </View>
          </View>
        </BlurView>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {loadingLocation && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
          </View>
        )}
        {!loadingLocation && region && (
          <ClusteredMapView
            ref={mapViewRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={region}
            showsUserLocation
            onRegionChangeComplete={handleRegionChangeComplete}
            clusterColor={CLUSTER_RED}
            clusterTextColor="#FFFFFF"
            renderCluster={({ id: cId, geometry, properties, onPress }) => (
              <Marker
                key={`cluster-${cId}-${properties.point_count}`}
                coordinate={{ latitude: geometry.coordinates[1], longitude: geometry.coordinates[0] }}
                onPress={onPress}
              >
                <View style={clusterStyles.bubble}>
                  <Text style={clusterStyles.count} numberOfLines={1}>{properties.point_count}</Text>
                </View>
              </Marker>
            )}
          >
            {validPlaces.map((place) => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.lat!, longitude: place.lon! }}
                title={place.placeName || place.rawTitle || 'Lieu'}
                description={place.googleFormattedAddress || place.address || undefined}
                tracksViewChanges={false}
              >
                <View style={[markerStyles.emojiBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={markerStyles.emoji}>{place.markerEmoji ?? DEFAULT_MARKER_EMOJI}</Text>
                </View>
              </Marker>
            ))}
          </ClusteredMapView>
        )}
        {!loadingLocation && !region && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
          </View>
        )}

        {/* Center user button */}
        {!loadingLocation && region && (
          <View style={[styles.centerUserButton, { bottom: insets.bottom + 24 }]} pointerEvents="box-none">
            <GlassButton
              icon="locate"
              onPress={handleCenterUser}
              active={followUser}
              activeTint="#0a7ea4"
              activeTextColor="#fff"
              textColor={theme.text}
              backgroundColor={theme.background}
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

const clusterStyles = StyleSheet.create({
  bubble: {
    width: CLUSTER_SIZE,
    height: CLUSTER_SIZE,
    borderRadius: CLUSTER_SIZE / 2,
    backgroundColor: CLUSTER_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  count: {
    color: '#FFFFFF',
    fontSize: CLUSTER_FONT_SIZE,
    fontWeight: '600',
  },
});

const markerStyles = StyleSheet.create({
  emojiBox: {
    width: MARKER_EMOJI_BOX,
    height: MARKER_EMOJI_BOX,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: MARKER_EMOJI_BOX / 2,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emoji: {
    fontSize: MARKER_EMOJI_SIZE,
    lineHeight: MARKER_EMOJI_BOX,
    textAlign: 'center',
  },
});
