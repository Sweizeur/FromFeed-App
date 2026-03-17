import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Keyboard,
  TouchableWithoutFeedback,
  useColorScheme,
} from 'react-native';
import { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ClusteredMapView from 'react-native-map-clustering';
import LinkBottomSheet from '@/features/places/components/LinkBottomSheet';
import Toast from '@/components/common/Toast';
import { type Place, type PlaceSummary } from '@/lib/api';
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

const CLUSTER_RED = '#E53935';
const CLUSTER_SIZE = 32;
const CLUSTER_FONT_SIZE = 12;
const DEFAULT_MARKER_EMOJI = '📍';
const MARKER_EMOJI_SIZE = 28;
const MARKER_EMOJI_BOX = 40;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const {
    placesSummary,
    refreshPlaces,
    loadPlaceDetails,
    setSelectedPlace,
  } = usePlaces();

  const {
    region,
    loadingLocation,
    mapViewRef,
    animateToPlace,
    animateToUser,
    startWatchingUser,
    stopWatchingUser,
    isProgrammaticChange,
  } = useMap();

  const { toast, showError, hideToast } = useToast();
  const { isAddingPlace, setAddingPlace, linkLoadStatus, setLinkLoadStatus, successMessage, setSuccessMessage } = useAddingPlace();

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
            <ClusteredMapView
              ref={mapViewRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={region}
              showsUserLocation
              onRegionChangeComplete={handleRegionChangeComplete}
              clusterColor={CLUSTER_RED}
              clusterTextColor="#FFFFFF"
              renderCluster={({ id, geometry, properties, onPress }) => (
                <Marker
                  key={`cluster-${id}-${properties.point_count}`}
                  coordinate={{
                    latitude: geometry.coordinates[1],
                    longitude: geometry.coordinates[0],
                  }}
                  onPress={onPress}
                >
                  <View style={clusterStyles.bubble}>
                    <Text style={clusterStyles.count} numberOfLines={1}>
                      {properties.point_count}
                    </Text>
                  </View>
                </Marker>
              )}
            >
              {filteredPlaces
                .filter((p) => p?.id && p.lat != null && p.lon != null)
                .map((place) => (
                  <Marker
                    key={place.id}
                    coordinate={{ latitude: place.lat!, longitude: place.lon! }}
                    title={place.placeName || place.rawTitle || 'Lieu'}
                    description={place.googleFormattedAddress || place.address || undefined}
                    onPress={() => handlePlacePress(place)}
                    tracksViewChanges={false}
                  >
                    <View
                      style={[
                        markerStyles.emojiBox,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          shadowColor: '#000',
                        },
                      ]}
                    >
                      <Text style={markerStyles.emoji}>{place.markerEmoji ?? DEFAULT_MARKER_EMOJI}</Text>
                    </View>
                  </Marker>
                ))}
            </ClusteredMapView>
          )}
          {!loadingLocation && !region && (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={darkColor} />
            </View>
          )}
          {!loadingLocation && region && (
            <View style={[styles.centerUserButton, { bottom: insets.bottom + 72 }]} pointerEvents="box-none">
              <GlassButton
                icon="locate"
                onPress={handleCenterUser}
                active={followUser}
                activeTint="#0a7ea4"
                activeTextColor="#fff"
                accessibilityLabel={followUser ? 'Ne plus suivre ma position' : 'Centrer et suivre ma position'}
                textColor={theme.text}
                backgroundColor={theme.background}
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
              showError(error.message || "Une erreur est survenue lors de l'analyse du lien.");
            }
          }}
        />

        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
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

const clusterStyles = StyleSheet.create({
  bubble: {
    width: CLUSTER_SIZE,
    height: CLUSTER_SIZE,
    borderRadius: CLUSTER_SIZE / 2,
    backgroundColor: CLUSTER_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  count: { color: '#FFFFFF', fontSize: CLUSTER_FONT_SIZE, fontWeight: '600' },
});

const markerStyles = StyleSheet.create({
  emojiBox: {
    width: MARKER_EMOJI_BOX,
    height: MARKER_EMOJI_BOX,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: MARKER_EMOJI_BOX / 2,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emoji: { fontSize: MARKER_EMOJI_SIZE, lineHeight: MARKER_EMOJI_BOX, textAlign: 'center' },
});
