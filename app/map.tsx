import React, { useState, useRef, useEffect, Suspense, lazy, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Text,
  Keyboard,
  TouchableWithoutFeedback,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import SlidingCard, { SlidingCardRef } from '@/components/common/SlidingCard';
import MapHeader, { UpgradePopup } from '@/components/navigation/MapHeader';
import BottomNav from '@/components/navigation/BottomNav';
import LinkBottomSheet from '@/components/modals/LinkBottomSheet';
import Toast from '@/components/common/Toast';
import PlaceTransition from '@/components/places/PlaceTransition';
import AddToCollectionModal from '@/components/collections/AddToCollectionModal';
import CollectionsScreen from './collections';
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
import { darkColor } from '@/constants/theme';

// Lazy load TikTokFeed pour ne pas charger react-native-webview au démarrage (évite crash si le binaire n’a pas été reconstruit)
const TikTokFeed = lazy(() => import('@/components/feed/TikTokFeed'));

class TikTokFeedErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: darkColor, textAlign: 'center' }}>
            Pour afficher les TikToks dans l’app, reconstruisez le binaire natif :
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 12, textAlign: 'center' }}>
            npx expo run:ios
          </Text>
          <Text style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            (ou run:android)
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const HEADER_WHITE_HEIGHT = 120;
const BOTTOM_NAV_HEIGHT = 52;

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const { region, loadingLocation, mapViewRef, animateToPlace } = useMap();
  const { toast, showSuccess, showError, hideToast } = useToast();

  // État local pour l'UI
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [isAddToCollectionModalVisible, setIsAddToCollectionModalVisible] = useState(false);
  const [selectedPlaceForCollection, setSelectedPlaceForCollection] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [activeTab, setActiveTab] = useState('map');
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

  const slidingCardRef = useRef<SlidingCardRef>(null);
  const placeDetailsScrollViewRef = useRef<any>(null);
  const cardTranslateY = useSharedValue(0);
  const lastCardTranslateYRef = useRef<number | null>(null);

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
    if (slidingCardRef.current) {
      slidingCardRef.current.animateToSnapPoint(50);
    }
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

  const handleHeaderContainerLayout = (event: LayoutChangeEvent) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  };

  const filteredPlaces = React.useMemo(() => {
    if (!selectedCategory && !selectedType) return placesSummary;
    return placesSummary.filter((place) => {
      if (selectedCategory && place.category !== selectedCategory) return false;
      if (selectedCategory && selectedType && !matchesTypeFilter(place.type, selectedType)) return false;
      return true;
    });
  }, [placesSummary, selectedCategory, selectedType]);

  const handleCardPositionChange = React.useCallback((translateY: number) => {
    cardTranslateY.value = translateY;
  }, []);

  const handleSnapPointReached = React.useCallback((translateY: number, _cardHeight: number) => {
    lastCardTranslateYRef.current = translateY;
  }, []);

  const mapContainerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return { height: HEADER_WHITE_HEIGHT + cardTranslateY.value };
  });

  const showHeader = activeTab === 'map' || activeTab === 'plans' || activeTab === 'search';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Header (map + search) */}
        {showHeader && (
          <MapHeader
            onLayout={handleHeaderContainerLayout}
            onAddLinkPress={() => setIsLinkModalVisible(true)}
            onAIPress={() => router.push('/ai')}
            places={placesSummary}
            selectedCategory={selectedCategory}
            selectedType={selectedType}
            onCategoryChange={handleCategoryChange}
            onTypeChange={setSelectedType}
            onlyFilters={activeTab === 'search'}
          />
        )}

        {/* Onglet Carte (afficher aussi si activeTab === 'plans' car onglet Planning désactivé) */}
        {(activeTab === 'map' || activeTab === 'plans') && (
          <>
            <Animated.View style={[styles.mapContainer, mapContainerAnimatedStyle]}>
              <UpgradePopup />
              {loadingLocation && (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color={darkColor} />
                </View>
              )}
              {!loadingLocation && region && (
                <MapView
                  ref={mapViewRef}
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={region}
                  showsUserLocation
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
                      />
                    ))}
                </MapView>
              )}
              {!loadingLocation && !region && (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color={darkColor} />
                </View>
              )}
            </Animated.View>
            {headerHeight > 0 && (
              <SlidingCard
                ref={slidingCardRef}
                headerHeight={headerHeight}
                headerWhiteHeight={HEADER_WHITE_HEIGHT}
                bottomNavHeight={BOTTOM_NAV_HEIGHT + insets.bottom}
                initialSnap={lastCardTranslateYRef.current === null ? 'mid' : undefined}
                restoreTranslateY={lastCardTranslateYRef.current}
                enableFling
                grabber
                testID="sliding-card"
                onPositionChange={handleCardPositionChange}
                onSnapPointReached={handleSnapPointReached}
              >
                <PlaceTransition
                  selectedPlace={selectedPlace}
                  placesSummary={filteredPlaces}
                  placesListKey={placesListKey}
                  onPlacePress={handlePlacePress}
                  onBack={clearSelectedPlace}
                  scrollViewRef={placeDetailsScrollViewRef}
                  onRefreshPlaces={refreshPlaces}
                  refreshingPlaces={refreshing}
                  onRatingUpdated={() => refreshPlaces(false)}
                  onDeletePlaces={handleDeletePlaces}
                  onAddToCollection={(placeId) => {
                    setSelectedPlaceForCollection(placeId);
                    setIsAddToCollectionModalVisible(true);
                  }}
                  isAddingPlace={isAddingPlace}
                />
              </SlidingCard>
            )}
          </>
        )}

        {/* Onglet Recherche - fil TikTok (lazy + ErrorBoundary pour WebView) */}
        {activeTab === 'search' && (
          <View style={[styles.searchTabContent, { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom }]}>
            <TikTokFeedErrorBoundary>
              <Suspense fallback={
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={darkColor} />
                  <Text style={styles.hint}>Chargement du fil...</Text>
                </View>
              }>
                <TikTokFeed
                  selectedCategory={selectedCategory}
                  selectedType={selectedType}
                />
              </Suspense>
            </TikTokFeedErrorBoundary>
          </View>
        )}

        {activeTab === 'collections' && <CollectionsScreen activeTab={activeTab} onTabChange={setActiveTab} />}
        {/* Onglet Planning désactivé
        {activeTab === 'plans' && <PlansScreen activeTab={activeTab} onTabChange={setActiveTab} />}
        */}
        {activeTab === 'settings' && (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Settings</Text>
          </View>
        )}

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

        {selectedPlaceForCollection && (
          <AddToCollectionModal
            visible={isAddToCollectionModalVisible}
            onClose={() => {
              setIsAddToCollectionModalVisible(false);
              setSelectedPlaceForCollection(null);
            }}
            placeId={selectedPlaceForCollection}
            onSuccess={() => refreshPlaces(false)}
          />
        )}

        <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapContainer: { position: 'relative', width: '100%' },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContent: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  tabTitle: { fontSize: 24, fontWeight: '600', color: darkColor },
  searchTabContent: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { fontSize: 14, color: '#666', marginTop: 8 },
});
