import React, { useState, useCallback, useMemo, useRef } from 'react';
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
} from '@rnmapbox/maps';
import LinkBottomSheet from '@/features/places/components/LinkBottomSheet';
import Toast from '@/components/common/Toast';
import MapMarkers from '@/features/places/components/MapMarkers';
import type { Place, PlaceSummary } from '@/features/places/types';
import { usePlaces } from '@/features/places/hooks/usePlaces';
import { useMap } from '@/features/places/hooks/useMap';
import { useToast } from '@/hooks/useToast';
import { useLinkProcessing } from '@/features/places/hooks/useLinkProcessing';
import { useAddingPlace } from '@/features/places/context/AddingPlaceContext';
import { darkColor, Colors } from '@/constants/theme';
import GlassButton from '@/components/ui/GlassButton';
import MapTabHeader from '@/features/places/components/MapTabHeader';
import LinkLoadBanner from '@/features/places/components/LinkLoadBanner';
import { router } from 'expo-router';
import { placesToGeoJSON } from '@/features/places/utils/placesToGeoJSON';

const CLUSTER_RED = '#E53935';
const MAPBOX_STYLE_LIGHT = 'mapbox://styles/mapbox/standard';
const MAPBOX_STYLE_DARK = 'mapbox://styles/mapbox/standard';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const mapStyle = isDark ? MAPBOX_STYLE_LIGHT : MAPBOX_STYLE_DARK;

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

  const filteredPlaces = placesSummary;
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

  const clusterLayerStyle = useMemo(
    () => ({
      circleRadius: 18,
      circleColor: CLUSTER_RED,
      circleStrokeWidth: 2,
      circleStrokeColor: '#fff',
      circlePitchAlignment: 'viewport' as const,
    }),
    []
  );
  const clusterCountLayerStyle = useMemo(
    () =>
      ({
        textField: ['get', 'point_count_abbreviated'],
        textSize: 12,
        textColor: '#fff',
        textPitchAlignment: 'viewport',
      }) as const,
    []
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
                cluster
                clusterRadius={15}
                clusterMaxZoomLevel={14}
                onPress={handleShapePress as (e: unknown) => void}
              >
                <CircleLayer
                  id="places-clusters"
                  filter={['has', 'point_count']}
                  style={clusterLayerStyle}
                />
                <SymbolLayer
                  id="places-cluster-count"
                  filter={['has', 'point_count']}
                  style={clusterCountLayerStyle as Record<string, unknown>}
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
              <GlassButton
                icon="locate"
                onPress={handleCenterUser}
                active={followUser}
                activeTint="#0a7ea4"
                activeTextColor="#fff"
                accessibilityLabel={
                  followUser
                    ? 'Ne plus suivre ma position'
                    : 'Centrer et suivre ma position'
                }
                textColor="#fff"
                backgroundColor="#3a3b3d"
                borderColor="#3a3b3d"
                forceSolid
              />
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
  container: { flex: 1 },
  mapContainer: { flex: 1, position: 'relative', width: '100%' },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerUserButton: { position: 'absolute', right: 16, zIndex: 10 },
});

