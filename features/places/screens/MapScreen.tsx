import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
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
  UserTrackingMode,
  type MapState,
} from '@rnmapbox/maps';
import LinkBottomSheet from '@/features/places/components/LinkBottomSheet';
import Toast from '@/components/common/Toast';
import MapMarkers from '@/features/places/components/MapMarkers';
import PlaceCardOverlay from '@/features/places/components/PlaceCardOverlay';
import MapActionButtons from '@/features/places/components/MapActionButtons';
import type { Place, PlaceSummary } from '@/features/places/types';
import { usePlaces } from '@/features/places/hooks/usePlaces';
import { useMap } from '@/features/places/hooks/useMap';
import { useCardAnimation } from '@/features/places/hooks/useCardAnimation';
import { useFiltersStore } from '@/features/places/store/useFiltersStore';
import { useToast } from '@/hooks/useToast';
import { useLinkProcessing } from '@/features/places/hooks/useLinkProcessing';
import { useAddingPlace } from '@/features/places/context/AddingPlaceContext';
import { updatePlaceRating, updatePlaceTested } from '@/lib/api/places';
import { darkColor, Colors } from '@/constants/theme';
import MapTabHeader from '@/features/places/components/MapTabHeader';
import PlaceFilters from '@/features/places/components/PlaceFilters';
import LinkLoadBanner from '@/features/places/components/LinkLoadBanner';
import { router, useLocalSearchParams } from 'expo-router';
import { placesToGeoJSON } from '@/features/places/utils/placesToGeoJSON';
import { matchesTypeFilter } from '@/utils/typeHierarchy';
import {
  useMapStyleConfig,
  CLUSTER_LAYER_STYLE,
  CLUSTER_COUNT_LAYER_STYLE,
  CLUSTER_SOURCE_PROPS,
} from '@/features/places/constants/map-config';

type FilterSelection = {
  category: 'Restauration' | 'Activité' | 'Non classé';
  type: string | null;
};

type ShapeFeature = {
  properties?: Record<string, unknown> | null;
  geometry?: { coordinates?: number[] };
};

export default function MapScreen() {
  const { placeId, mapListNonce } = useLocalSearchParams<{
    placeId?: string;
    mapListNonce?: string;
  }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { styleURL: mapStyle, config: mapConfig } = useMapStyleConfig();

  // ── Data hooks ──
  const { placesSummary, refreshPlaces, loadPlaceDetails, setSelectedPlace, selectedPlace } =
    usePlaces();
  const {
    region,
    loadingLocation,
    cameraRef,
    animateToPlace,
    animateToUser,
    startWatchingUser,
    stopWatchingUser,
    location,
    isProgrammaticChange,
  } = useMap();
  const { toast, showError, hideToast } = useToast();
  const {
    isAddingPlace,
    setAddingPlace,
    linkLoadStatus,
    setLinkLoadStatus,
    successMessage,
    setSuccessMessage,
    linkErrorMessage,
    setLinkErrorMessage,
  } = useAddingPlace();

  const onPlaceSaved = useCallback(async () => {
    await refreshPlaces(true, true);
  }, [refreshPlaces]);
  const { handleTaskCreated, setProcessingUrl } = useLinkProcessing({ onPlaceSaved });

  // ── Card animation ──
  const {
    selectedCardPlace,
    cardPlace,
    showPlaceCard,
    dismissPlaceCardAnimated,
    toggleCardExpansion,
    cardAppearProgress,
    cardExpansionProgress,
    cardPanResponder,
    expandedFullHeight,
    navbarClearance,
  } = useCardAnimation();

  // ── Local state ──
  const shapeSourceRef = useRef<ShapeSource>(null);
  const lastIdleCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const lastHandledListFocusKeyRef = useRef<string | null>(null);
  const [followUser, setFollowUser] = useState(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<FilterSelection[]>([]);

  const setListCategory = useFiltersStore((s) => s.setCategory);
  const setListType = useFiltersStore((s) => s.setType);
  const singleFilterSelection = selectedFilters.length === 1 ? selectedFilters[0] : null;

  // ── Filter sync: Map → List store ──
  useEffect(() => {
    if (selectedFilters.length !== 1) {
      setListCategory(null);
      setListType(null);
      return;
    }
    const [filter] = selectedFilters;
    setListCategory(filter.category);
    setListType(filter.type);
  }, [selectedFilters, setListCategory, setListType]);

  // ── Filtered data ──
  const filteredPlaces = useMemo(() => {
    if (selectedFilters.length === 0) return placesSummary;
    return placesSummary.filter((place) =>
      selectedFilters.some((filter) => {
        if (filter.category === 'Non classé') {
          if (place.category != null) return false;
          if (!place.types || place.types.length === 0) return false;
        } else if (place.category !== filter.category) {
          return false;
        }
        if (filter.type === null) return true;
        return place.types?.some((t) => matchesTypeFilter(t, filter.type)) ?? false;
      }),
    );
  }, [placesSummary, selectedFilters]);

  const geoJson = useMemo(() => placesToGeoJSON(filteredPlaces), [filteredPlaces]);

  const placesById = useMemo(() => {
    const m = new Map<string, PlaceSummary>();
    filteredPlaces.forEach((p) => p?.id && m.set(p.id, p));
    return m;
  }, [filteredPlaces]);

  // ── Place callbacks ──
  const handlePlacePress = useCallback(
    async (place: Place | PlaceSummary) => {
      showPlaceCard(place as PlaceSummary);
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
    [showPlaceCard, loadPlaceDetails, setSelectedPlace, animateToPlace, showError],
  );

  const handleShapePress = useCallback(
    async (event: { features: ShapeFeature[] }) => {
      const feature = event.features?.[0];
      if (!feature?.properties) return;
      const props = feature.properties;
      const isCluster = 'point_count' in props && typeof props.point_count === 'number';
      const coords = feature.geometry?.coordinates;
      const coordPair =
        coords && coords.length >= 2 ? ([coords[0], coords[1]] as [number, number]) : undefined;
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
    [placesById, handlePlacePress, cameraRef],
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

  const handleRatingChange = useCallback(
    async (placeId: string, rating: number) => {
      try {
        await updatePlaceRating(placeId, rating || null);
        await refreshPlaces(true, true);
      } catch {
        /* silent */
      }
    },
    [refreshPlaces],
  );

  const handleTestedChange = useCallback(
    async (placeId: string, isTested: boolean) => {
      try {
        await updatePlaceTested(placeId, isTested);
        await refreshPlaces(true, true);
      } catch {
        /* silent */
      }
    },
    [refreshPlaces],
  );

  // ── Map idle ──
  const handleMapIdle = useCallback(
    (state: MapState) => {
      const center = state.properties.center;
      const snap = {
        center: [center[0], center[1]] as [number, number],
        zoom: state.properties.zoom,
      };

      if (isProgrammaticChange()) {
        lastIdleCameraRef.current = snap;
        return;
      }

      const prev = lastIdleCameraRef.current;
      const moved =
        !!prev &&
        (Math.abs(prev.zoom - snap.zoom) > 0.012 ||
          Math.abs(prev.center[0] - snap.center[0]) > 1e-6 ||
          Math.abs(prev.center[1] - snap.center[1]) > 1e-6);

      if (moved) {
        if (followUser) {
          setFollowUser(false);
          stopWatchingUser();
        }
        if (selectedCardPlace) {
          dismissPlaceCardAnimated();
        }
      }

      lastIdleCameraRef.current = snap;
    },
    [followUser, stopWatchingUser, isProgrammaticChange, dismissPlaceCardAnimated, selectedCardPlace],
  );

  // ── Filter callbacks ──
  const handleCategoryChange = useCallback(
    (category: string | null) => {
      if (!category) {
        setSelectedFilters([]);
        return;
      }
      setSelectedFilters([{ category: category as FilterSelection['category'], type: null }]);
    },
    [],
  );

  const handleTypeChange = useCallback(
    (type: string | null) => {
      const category = singleFilterSelection?.category;
      if (!category) return;
      setSelectedFilters([{ category, type }]);
    },
    [singleFilterSelection?.category],
  );

  // ── Link modal callbacks ──
  const handleLinkBannerDismiss = useCallback(() => {
    setLinkLoadStatus('idle');
    setSuccessMessage(null);
    setLinkErrorMessage(null);
  }, [setLinkLoadStatus, setSuccessMessage, setLinkErrorMessage]);

  const handleLinkModalClose = useCallback(() => {
    setIsLinkModalVisible(false);
    setLinkInput('');
    if (!isAddingPlace) setProcessingUrl(null);
  }, [isAddingPlace, setProcessingUrl]);

  const handleStartProcessing = useCallback(() => {
    setAddingPlace(true);
    setLinkLoadStatus('loading');
    setLinkErrorMessage(null);
    if (linkInput.trim()) setProcessingUrl(linkInput.trim());
  }, [setAddingPlace, setLinkLoadStatus, setLinkErrorMessage, linkInput, setProcessingUrl]);

  const handleLinkError = useCallback(
    (error: { message?: string; name?: string }) => {
      const isNetworkError =
        error?.message?.includes('Network request failed') ||
        error?.message?.includes('Aborted') ||
        error?.name === 'AbortError';
      if (!isNetworkError) {
        setAddingPlace(false);
        setLinkErrorMessage(error.message || "Une erreur est survenue lors de l'analyse du lien.");
        setLinkLoadStatus('error');
        setProcessingUrl(null);
      }
    },
    [setAddingPlace, setLinkErrorMessage, setLinkLoadStatus, setProcessingUrl],
  );

  // ── Deep-link: ouverture depuis la liste (placeId + mapListNonce uniques par tap) ──
  useEffect(() => {
    if (!placeId || Array.isArray(placeId)) return;
    if (!mapListNonce || Array.isArray(mapListNonce)) return;

    const placeFromList = placesSummary.find((p) => p.id === placeId);
    if (!placeFromList) return;

    const focusKey = `${placeId}:${mapListNonce}`;
    if (lastHandledListFocusKeyRef.current === focusKey) return;
    lastHandledListFocusKeyRef.current = focusKey;

    let cancelled = false;
    (async () => {
      await handlePlacePress(placeFromList);
      if (!cancelled) router.replace('/(tabs)/map');
    })();

    return () => {
      cancelled = true;
      lastHandledListFocusKeyRef.current = null;
    };
  }, [placeId, mapListNonce, placesSummary, handlePlacePress]);

  // ── Render ──
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
          errorMessage={linkErrorMessage}
          onDismiss={handleLinkBannerDismiss}
        />

        <View style={styles.mapContainer}>
          <View style={[styles.inlineFilters, { top: insets.top + 78 }]}>
            <PlaceFilters
              places={placesSummary}
              selectedCategory={singleFilterSelection?.category ?? null}
              selectedType={singleFilterSelection?.type ?? null}
              onCategoryChange={handleCategoryChange}
              onTypeChange={handleTypeChange}
              colorScheme={colorScheme}
              transparentBackground
            />
          </View>

          {(loadingLocation || !region) && (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={darkColor} />
            </View>
          )}

          {!loadingLocation && region && (
            <>
              <MapView
                style={StyleSheet.absoluteFillObject}
                styleURL={mapStyle}
                projection="globe"
                onMapIdle={handleMapIdle}
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
                  followUserLocation={followUser}
                  followUserMode={UserTrackingMode.Follow}
                />
                {location && <LocationPuck visible puckBearing="heading" puckBearingEnabled />}
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
                  selectedPlaceId={selectedCardPlace?.id ?? null}
                />
              </MapView>

              <PlaceCardOverlay
                place={cardPlace}
                placeDetails={
                  selectedPlace && cardPlace && selectedPlace.id === cardPlace.id
                    ? selectedPlace
                    : null
                }
                cardAppearProgress={cardAppearProgress}
                cardExpansionProgress={cardExpansionProgress}
                cardPanResponder={cardPanResponder}
                toggleCardExpansion={toggleCardExpansion}
                expandedFullHeight={expandedFullHeight}
                navbarClearance={navbarClearance}
                isDark={isDark}
                theme={theme}
                onRatingChange={handleRatingChange}
                onTestedChange={handleTestedChange}
              />

              <MapActionButtons
                followUser={followUser}
                onCenterUser={handleCenterUser}
                theme={theme}
                bottom={navbarClearance}
              />
            </>
          )}
        </View>

        <LinkBottomSheet
          visible={isLinkModalVisible}
          onClose={handleLinkModalClose}
          linkInput={linkInput}
          onLinkInputChange={setLinkInput}
          onTaskCreated={handleTaskCreated}
          onStartProcessing={handleStartProcessing}
          onError={handleLinkError}
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
});
