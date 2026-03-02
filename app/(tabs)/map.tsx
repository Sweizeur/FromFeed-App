import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Keyboard,
  TouchableWithoutFeedback,
  AppState,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CLUSTER_RED = '#E53935';
const CLUSTER_SIZE = 32;
const CLUSTER_FONT_SIZE = 12;
const DEFAULT_MARKER_EMOJI = '📍';
const MARKER_EMOJI_SIZE = 28;
const MARKER_EMOJI_BOX = 40;
import ClusteredMapView from 'react-native-map-clustering';
import LinkBottomSheet from '@/components/modals/LinkBottomSheet';
import Toast from '@/components/common/Toast';
import { createLinkPreviewTask, getTaskStatus, deletePlace, type Place, type PlaceSummary } from '@/lib/api';

const PENDING_LINK_TASK_ID = '@fromfeed:pendingLinkTaskId';
// Polling avec backoff : 1s, 2s, 4s, 8s, 10s puis 10s (max 10–15s entre deux polls)
const POLL_INTERVALS = [1000, 2000, 4000, 8000, 10000];
const POLL_MAX_MS = 5 * 60 * 1000;
import { usePlaces } from '@/hooks/usePlaces';
import { useMap } from '@/hooks/useMap';
import { useToast } from '@/hooks/useToast';
import { useShareHandler } from '@/hooks/useShareHandler';
import { matchesTypeFilter } from '@/utils/typeHierarchy';
import { darkColor, Colors } from '@/constants/theme';
import GlassButton from '@/components/ui/GlassButton';
import MapTabHeader from '@/components/navigation/MapTabHeader';
import { router } from 'expo-router';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  // Hooks personnalisés
  const {
    placesSummary,
    selectedPlace,
    placesListKey,
    refreshing,
    refreshPlaces,
    loadPlaceDetails,
    clearSelectedPlace,
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
  const { toast, showSuccess, showError, hideToast } = useToast();

  // Suivi utilisateur : carte recentrée à chaque déplacement ; désactivé quand l'utilisateur déplace la carte
  const [followUser, setFollowUser] = useState(false);

  // État local pour l'UI
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [processingUrl, setProcessingUrl] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const processingUrlRef = useRef<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);

  // Filtres
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedType(null);
  };

  const handlePlacePress = React.useCallback(async (place: Place | PlaceSummary) => {
    if ('provider' in place && !('createdAt' in place)) {
      try {
        await loadPlaceDetails(place.id);
      } catch (error) {
        __DEV__ && console.error('[Map] Erreur lors du chargement des détails:', error);
        showError('Impossible de charger les détails du lieu.');
        return;
      }
    } else {
      setSelectedPlace(place as Place);
    }
    await animateToPlace(place);
  }, [loadPlaceDetails, setSelectedPlace, animateToPlace]);

  const clearPendingTask = useCallback(() => {
    setPendingTaskId(null);
    setIsAddingPlace(false);
    setProcessingUrl(null);
    processingUrlRef.current = null;
    AsyncStorage.removeItem(PENDING_LINK_TASK_ID);
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const handleSaveLink = useCallback(async (result: any) => {
    if (result && 'processing' in result && result.processing === true) {
      showSuccess('Le lien est en cours de traitement. Le lieu sera ajouté automatiquement une fois l\'analyse terminée.');
      setIsAddingPlace(true);
      return;
    }
    if (!result?.placeId) {
      showError('Le lieu n\'a pas pu être ajouté. Les informations extraites ne correspondent pas aux données Google Places.');
      setIsAddingPlace(false);
      return;
    }
    const placeName = result.llm?.placeName || result.google?.name || result.place?.name || 'Lieu';
    const city = result.llm?.city || result.google?.formatted_address?.split(',')[0] || result.place?.city;
    const successMessage = city
      ? `Bravo, ${placeName} a été ajouté dans ${city}`
      : `Bravo, ${placeName} a été ajouté dans vos lieux sauvegardés`;
    showSuccess(successMessage);
    await refreshPlaces(true, true);
    setTimeout(() => {
      setIsAddingPlace(false);
      setProcessingUrl(null);
      processingUrlRef.current = null;
    }, 500);
  }, [showSuccess, showError, refreshPlaces]);

  const checkTaskStatus = useCallback(async (taskId: string) => {
    const statusRes = await getTaskStatus(taskId);
    if (!statusRes) return false;
    if (statusRes.status === 'done' && statusRes.result) {
      await handleSaveLink(statusRes.result);
      clearPendingTask();
      return true;
    }
    if (statusRes.status === 'failed' || statusRes.status === 'expired') {
      showError(statusRes.error || 'L\'analyse du lien a échoué.');
      clearPendingTask();
      return true;
    }
    return false;
  }, [handleSaveLink, clearPendingTask, showError]);

  const scheduleNextPoll = useCallback((taskId: string, attempt: number) => {
    if (pollTimeoutRef.current) return;
    const elapsed = Date.now() - pollStartRef.current;
    if (elapsed >= POLL_MAX_MS) {
      showError('L\'analyse prend trop de temps. Réessayez plus tard.');
      clearPendingTask();
      return;
    }
    const delay = attempt < POLL_INTERVALS.length ? POLL_INTERVALS[attempt] : 10000;
    pollTimeoutRef.current = setTimeout(async () => {
      pollTimeoutRef.current = null;
      const done = await checkTaskStatus(taskId);
      if (!done) scheduleNextPoll(taskId, attempt + 1);
    }, delay);
  }, [checkTaskStatus, clearPendingTask, showError]);

  const handleTaskCreated = useCallback((taskId: string) => {
    setPendingTaskId(taskId);
    setIsAddingPlace(true);
    setProcessingUrl('En cours...');
    processingUrlRef.current = 'pending';
    AsyncStorage.setItem(PENDING_LINK_TASK_ID, taskId);
    pollStartRef.current = Date.now();
    scheduleNextPoll(taskId, 0);
  }, [scheduleNextPoll]);

  useEffect(() => {
    if (!pendingTaskId) return;
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [pendingTaskId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await AsyncStorage.getItem(PENDING_LINK_TASK_ID);
      if (cancelled || !stored) return;
      setPendingTaskId(stored);
      setIsAddingPlace(true);
      setProcessingUrl('En cours...');
      processingUrlRef.current = 'pending';
      pollStartRef.current = Date.now();
      scheduleNextPoll(stored, 0);
    })();
    return () => { cancelled = true; };
  }, [scheduleNextPoll]);

  const handleSharedUrl = React.useCallback(async (url: string) => {
    if (processingUrlRef.current === url) return;
    try {
      processingUrlRef.current = url;
      const response = await createLinkPreviewTask(url);
      if (response?.taskId) {
        setPendingTaskId(response.taskId);
        setIsAddingPlace(true);
        setProcessingUrl(url);
        AsyncStorage.setItem(PENDING_LINK_TASK_ID, response.taskId);
        pollStartRef.current = Date.now();
        scheduleNextPoll(response.taskId, 0);
      } else {
        showError('Impossible de lancer l\'analyse du lien partagé.');
        processingUrlRef.current = null;
      }
    } catch (error: any) {
      const isNetworkError = error?.message?.includes('Network request failed') ||
        error?.message?.includes('Aborted') || error?.name === 'AbortError';
      if (!isNetworkError) {
        console.error('[Map] Erreur lors du traitement automatique du lien partagé:', error);
        showError(error?.message || 'Une erreur est survenue lors de l\'analyse du lien.');
      }
      processingUrlRef.current = null;
    }
  }, [showError, scheduleNextPoll]);

  useShareHandler(handleSharedUrl);

  const isRefreshingOnAppStateRef = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState !== 'active') return;
      const taskId = pendingTaskId ?? (await AsyncStorage.getItem(PENDING_LINK_TASK_ID));
      if (taskId) {
        if (isRefreshingOnAppStateRef.current) return;
        isRefreshingOnAppStateRef.current = true;
        try {
          const done = await checkTaskStatus(taskId);
          if (done) {
            await refreshPlaces(true, true);
          } else {
            // Encore en cours → relancer le polling
            setPendingTaskId(taskId);
            setIsAddingPlace(true);
            setProcessingUrl('En cours...');
            pollStartRef.current = Date.now();
            scheduleNextPoll(taskId, 0);
          }
        } catch (_) {}
        finally {
          setTimeout(() => { isRefreshingOnAppStateRef.current = false; }, 1000);
        }
        return;
      }
      if (isAddingPlace && processingUrl) {
        if (isRefreshingOnAppStateRef.current) return;
        isRefreshingOnAppStateRef.current = true;
        try {
          await refreshPlaces(true, true);
        } catch (_) {}
        finally {
          setTimeout(() => { isRefreshingOnAppStateRef.current = false; }, 1000);
        }
      }
    });
    return () => subscription.remove();
  }, [pendingTaskId, isAddingPlace, processingUrl, refreshPlaces, checkTaskStatus, scheduleNextPoll]);

  const handleLinkError = (error: Error) => {
    showError(error.message || 'Une erreur est survenue lors de l\'analyse du lien.');
  };

  const handleDeletePlaces = async (placeIds: string[]) => {
    try {
      await Promise.all(placeIds.map(placeId => deletePlace(placeId)));
      showSuccess(`${placeIds.length} lieu${placeIds.length > 1 ? 'x' : ''} supprimé${placeIds.length > 1 ? 's' : ''} avec succès`);
      await refreshPlaces(false);
    } catch (error) {
      __DEV__ && console.error('[Map] Erreur lors de la suppression:', error);
      showError('Une erreur est survenue lors de la suppression des lieux.');
    }
  };

  const filteredPlaces = React.useMemo(() => {
    if (!selectedCategory && !selectedType) return placesSummary;
    return placesSummary.filter((place) => {
      if (selectedCategory && place.category !== selectedCategory) return false;
      if (selectedCategory && selectedType && !matchesTypeFilter(place.type, selectedType)) return false;
      return true;
    });
  }, [placesSummary, selectedCategory, selectedType]);

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
                          shadowColor: isDark ? '#000' : '#000',
                        },
                      ]}
                    >
                        <Text style={markerStyles.emoji}>
                          {place.markerEmoji ?? DEFAULT_MARKER_EMOJI}
                        </Text>
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
            setIsAddingPlace(true);
            if (linkInput.trim()) setProcessingUrl(linkInput.trim());
          }}
          onError={(error) => {
            const isNetworkError = error?.message?.includes('Network request failed') ||
              error?.message?.includes('Aborted') || error?.name === 'AbortError';
            if (!isNetworkError) {
              setIsAddingPlace(false);
              setProcessingUrl(null);
              handleLinkError(error);
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
