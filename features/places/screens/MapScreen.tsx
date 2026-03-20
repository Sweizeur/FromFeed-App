import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Pressable,
  Platform,
  TouchableWithoutFeedback,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  LocationPuck,
  StyleImport,
} from '@rnmapbox/maps';
import LinkBottomSheet from '@/features/places/components/LinkBottomSheet';
import Toast from '@/components/common/Toast';
import MapMarkers from '@/features/places/components/MapMarkers';
import type { Place, PlaceSummary } from '@/features/places/types';
import { usePlaces } from '@/features/places/hooks/usePlaces';
import { useMap } from '@/features/places/hooks/useMap';
import { useFiltersStore } from '@/features/places/store/useFiltersStore';
import { useToast } from '@/hooks/useToast';
import { useLinkProcessing } from '@/features/places/hooks/useLinkProcessing';
import { useAddingPlace } from '@/features/places/context/AddingPlaceContext';
import { darkColor, Colors } from '@/constants/theme';
import MapTabHeader from '@/features/places/components/MapTabHeader';
import PlaceFilters from '@/features/places/components/PlaceFilters';
import LinkLoadBanner from '@/features/places/components/LinkLoadBanner';
import { router } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { placesToGeoJSON } from '@/features/places/utils/placesToGeoJSON';
import { matchesTypeFilter } from '@/utils/typeHierarchy';
import {
  useMapStyleConfig,
  CLUSTER_LAYER_STYLE,
  CLUSTER_COUNT_LAYER_STYLE,
  CLUSTER_SOURCE_PROPS,
} from '@/features/places/constants/map-config';

const useLiquidButtons = Platform.OS === 'ios' && isLiquidGlassAvailable();

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { styleURL: mapStyle, config: mapConfig } = useMapStyleConfig();

  const {
    placesSummary,
    refreshPlaces,
    loadPlaceDetails,
    setSelectedPlace,
  } = usePlaces();

  const {
    region,
    loadingLocation,
    cameraRef,
    animateToPlace,
    animateToUser,
    startWatchingUser,
    stopWatchingUser,
    isProgrammaticChange,
    location,
  } = useMap();

  const { toast, showError, hideToast } = useToast();
  const {
    isAddingPlace,
    setAddingPlace,
    linkLoadStatus,
    setLinkLoadStatus,
    successMessage,
    setSuccessMessage,
  } = useAddingPlace();

  const shapeSourceRef = useRef<ShapeSource>(null);

  const onPlaceSaved = useCallback(async () => {
    await refreshPlaces(true, true);
  }, [refreshPlaces]);

  const {
    handleTaskCreated,
    setProcessingUrl,
  } = useLinkProcessing({ onPlaceSaved });

  const [followUser, setFollowUser] = useState(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<
    Array<{ category: 'Restauration' | 'Activité'; type: string | null }>
  >([]);
  const setListCategory = useFiltersStore((s) => s.setCategory);
  const setListType = useFiltersStore((s) => s.setType);
  const singleFilterSelection = selectedFilters.length === 1 ? selectedFilters[0] : null;

  useEffect(() => {
    // Sync one-way: Plan -> Liste
    // La page plan garde son propre état local; la liste lit le store global.
    if (selectedFilters.length !== 1) {
      setListCategory(null);
      setListType(null);
      return;
    }

    const [filter] = selectedFilters;
    setListCategory(filter.category);
    setListType(filter.type);
  }, [selectedFilters, setListCategory, setListType]);

  const handlePlacePress = useCallback(
    async (place: Place | PlaceSummary) => {
      if ('provider' in place && !('createdAt' in place)) {
        try {
          await loadPlaceDetails(place.id);
        } catch {
          showError('Impossible de charger les détails du lieu.');
          return;
        }
      } else {
        setSelectedPlace(place as Place);
      }
      await animateToPlace(place);
    },
    [loadPlaceDetails, setSelectedPlace, animateToPlace, showError]
  );

  const filteredPlaces = useMemo(() => {
    if (selectedFilters.length === 0) return placesSummary;

    return placesSummary.filter((place) => {
      return selectedFilters.some((filter) => {
        if (place.category !== filter.category) return false;
        if (filter.type === null) return true;
        return matchesTypeFilter(place.type, filter.type);
      });
    });
  }, [placesSummary, selectedFilters]);

  const toggleFilter = useCallback(
    (category: 'Restauration' | 'Activité', type: string | null) => {
      setSelectedFilters((prev) => {
        const exists = prev.some((f) => f.category === category && f.type === type);
        if (exists) {
          return prev.filter((f) => !(f.category === category && f.type === type));
        }
        return [...prev, { category, type }];
      });
    },
    []
  );
  const geoJson = useMemo(
    () => placesToGeoJSON(filteredPlaces),
    [filteredPlaces]
  );
  const placesById = useMemo(() => {
    const m = new Map<string, PlaceSummary>();
    filteredPlaces.forEach((p) => p?.id && m.set(p.id, p));
    return m;
  }, [filteredPlaces]);

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
        return;
      }
      const id = props.id as string | undefined;
      if (id) {
        const place = placesById.get(id);
        if (place) await handlePlacePress(place);
      }
    },
    [placesById, handlePlacePress, cameraRef]
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


  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <MapTabHeader
          placesCount={filteredPlaces.length}
          onAddPress={() => setIsLinkModalVisible(true)}
          onPlacesPress={() => router.navigate('/places')}
        />
        <LinkLoadBanner
          status={linkLoadStatus}
          successMessage={successMessage}
          onSuccessDismiss={() => {
            setLinkLoadStatus('idle');
            setSuccessMessage(null);
          }}
        />
        <View style={styles.mapContainer}>
          <View style={[styles.inlineFilters, { top: insets.top + 78 }]}>
            <PlaceFilters
              places={placesSummary}
              selectedCategory={singleFilterSelection?.category ?? null}
              selectedType={singleFilterSelection?.type ?? null}
              onCategoryChange={(category) => {
                if (!category) {
                  setSelectedFilters([]);
                  return;
                }
                setSelectedFilters([
                  { category: category as 'Restauration' | 'Activité', type: null },
                ]);
              }}
              onTypeChange={(type) => {
                const category = singleFilterSelection?.category;
                if (!category) return;
                setSelectedFilters([{ category, type }]);
              }}
              colorScheme={colorScheme}
              transparentBackground
            />
          </View>
          {loadingLocation && (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={darkColor} />
            </View>
          )}
          {!loadingLocation && region && (
            <MapView
              style={StyleSheet.absoluteFillObject}
              styleURL={mapStyle}
              projection="globe"
              onRegionDidChange={handleRegionDidChange}
            >
              <StyleImport
                id="basemap"
                existing
                config={mapConfig}
              />
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
                <LocationPuck
                  visible
                  puckBearing="heading"
                  puckBearingEnabled
                />
              )}
              <ShapeSource
                ref={shapeSourceRef}
                id="places"
                shape={geoJson}
                {...CLUSTER_SOURCE_PROPS}
                onPress={handleShapePress as (e: unknown) => void}
              >
                <CircleLayer
                  id="places-clusters"
                  filter={['has', 'point_count']}
                  style={CLUSTER_LAYER_STYLE}
                />
                <SymbolLayer
                  id="places-cluster-count"
                  filter={['has', 'point_count']}
                  style={CLUSTER_COUNT_LAYER_STYLE as Record<string, unknown>}
                />
              </ShapeSource>
              <MapMarkers
                places={filteredPlaces}
                theme={theme}
                onPlacePress={handlePlacePress}
              />
            </MapView>
          )}
          {!loadingLocation && !region && (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={darkColor} />
            </View>
          )}
          {!loadingLocation && region && (
            <View
              style={[styles.centerUserButton, { bottom: insets.bottom + 72 }]}
              pointerEvents="box-none"
            >
              {useLiquidButtons ? (
                <GlassView
                  glassEffectStyle="regular"
                  isInteractive
                  style={styles.glassButtonGroup}
                >
                  <Pressable
                    onPress={() => {}}
                    accessibilityRole="button"
                    accessibilityLabel="Filtre (bientot disponible)"
                    style={styles.groupButton}
                  >
                    <Ionicons
                      name="options-outline"
                      size={18}
                      color={theme.text}
                    />
                  </Pressable>
                  <View style={[styles.groupDivider, { backgroundColor: theme.border }]} />
                  <Pressable
                    onPress={handleCenterUser}
                    accessibilityRole="button"
                    accessibilityLabel={
                      followUser
                        ? 'Ne plus suivre ma position'
                        : 'Centrer et suivre ma position'
                    }
                    style={styles.groupButton}
                  >
                    <Ionicons
                      name={followUser ? 'navigate' : 'navigate-outline'}
                      size={18}
                      color={followUser ? '#0a7ea4' : theme.text}
                    />
                  </Pressable>
                </GlassView>
              ) : (
                <View
                  style={[
                    styles.fallbackButtonGroup,
                    {
                      backgroundColor: '#3a3b3d',
                      borderColor: '#3a3b3d',
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => {}}
                    accessibilityRole="button"
                    accessibilityLabel="Filtre (bientot disponible)"
                    style={styles.groupButton}
                  >
                    <Ionicons
                      name="options-outline"
                      size={18}
                      color="#fff"
                    />
                  </Pressable>
                  <View style={[styles.groupDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                  <Pressable
                    onPress={handleCenterUser}
                    accessibilityRole="button"
                    accessibilityLabel={
                      followUser
                        ? 'Ne plus suivre ma position'
                        : 'Centrer et suivre ma position'
                    }
                    style={styles.groupButton}
                  >
                    <Ionicons
                      name={followUser ? 'navigate' : 'navigate-outline'}
                      size={18}
                      color={followUser ? '#0a7ea4' : '#fff'}
                    />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        <LinkBottomSheet
          visible={isLinkModalVisible}
          onClose={() => {
            setIsLinkModalVisible(false);
            setLinkInput('');
            if (!isAddingPlace) setProcessingUrl(null);
          }}
          linkInput={linkInput}
          onLinkInputChange={setLinkInput}
          onTaskCreated={handleTaskCreated}
          onStartProcessing={() => {
            setAddingPlace(true);
            setLinkLoadStatus('loading');
            if (linkInput.trim()) setProcessingUrl(linkInput.trim());
          }}
          onError={(error) => {
            const isNetworkError =
              error?.message?.includes('Network request failed') ||
              error?.message?.includes('Aborted') ||
              error?.name === 'AbortError';
            if (!isNetworkError) {
              setAddingPlace(false);
              setLinkLoadStatus('idle');
              setProcessingUrl(null);
              showError(
                error.message ||
                  "Une erreur est survenue lors de l'analyse du lien."
              );
            }
          }}
        />

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={hideToast}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'visible' },
  mapContainer: { flex: 1, position: 'relative', width: '100%', overflow: 'visible' },
  inlineFilters: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
  },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerUserButton: { position: 'absolute', right: 16, zIndex: 10, overflow: 'visible' },
  glassButtonGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 44,
    borderRadius: 22,
    padding: 2,
    margin: -2,
    overflow: 'visible',
  },
  fallbackButtonGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  groupButton: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  groupDivider: {
    width: 20,
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
});

