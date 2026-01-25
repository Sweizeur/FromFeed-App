import React, { useState, useRef, useEffect } from 'react';
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
import PlansScreen from './plans';
import CollectionsScreen from './collections';
import { analyzeLink, deletePlace, sendAIMessage, type Place, type PlaceSummary } from '@/lib/api';
import { usePlaces } from '@/hooks/usePlaces';
import { useMap } from '@/hooks/useMap';
import { useToast } from '@/hooks/useToast';
import { useShareHandler } from '@/hooks/useShareHandler';
import { matchesTypeFilter } from '@/utils/typeHierarchy';
import { darkColor } from '@/constants/theme';

const HEADER_WHITE_HEIGHT = 120;
const BOTTOM_NAV_HEIGHT = 52;

export default function HomeScreen() {
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
  const [activeTab, setActiveTab] = useState('home');
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [processingUrl, setProcessingUrl] = useState<string | null>(null);
  const processingUrlRef = useRef<string | null>(null); // Ref pour éviter les traitements multiples de la même URL
  
  // Filtres
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  // Réinitialiser le type quand on change de catégorie
  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedType(null); // Réinitialiser le type
  };

  // Refs
  const slidingCardRef = useRef<SlidingCardRef>(null);
  const placeDetailsScrollViewRef = useRef<any>(null);
  
  // Shared value pour suivre la position de la carte coulissante
  const cardTranslateY = useSharedValue(0);
  
  // Sauvegarder la dernière position translateY de la carte pour la restaurer au remontage
  // Utiliser un état persistant en dehors du composant pour survivre au démontage
  const lastCardTranslateYRef = useRef<number | null>(null);

  /**
   * Gère le clic sur un lieu (marqueur ou dans la liste)
   */
  const handlePlacePress = React.useCallback(async (place: Place | PlaceSummary) => {
    // Si c'est un PlaceSummary, charger les détails complets
    if ('provider' in place && !('createdAt' in place)) {
      try {
        await loadPlaceDetails(place.id);
      } catch (error) {
        __DEV__ && console.error('[Home] Erreur lors du chargement des détails:', error);
        showError('Impossible de charger les détails du lieu.');
        return;
      }
    } else {
      // C'est une Place complète, utiliser directement
      setSelectedPlace(place as Place);
    }

    // Animer la carte vers le lieu
    await animateToPlace(place);

    // Animer la carte coulissante vers 50% de visibilité
    if (slidingCardRef.current) {
      slidingCardRef.current.animateToSnapPoint(50);
    }
  }, [loadPlaceDetails, setSelectedPlace, animateToPlace]);

  /**
   * Gère la sauvegarde d'un lien
   */
  const handleSaveLink = async (result: any) => {
    console.log('Lien analysé avec succès:', result);
    
    // Vérifier si c'est un traitement asynchrone (ne devrait plus arriver maintenant)
    if (result && 'processing' in result && result.processing === true) {
      // Le traitement est en cours en arrière-plan (ancien comportement)
      showSuccess('Le lien est en cours de traitement. Le lieu sera ajouté automatiquement une fois l\'analyse terminée.');
      setIsAddingPlace(true);
      // Le skeleton sera retiré quand le lieu apparaîtra dans la liste
      return;
    }
    
    // Vérifier si le lieu a bien été créé
    if (!result.placeId) {
      showError('Le lieu n\'a pas pu être ajouté. Les informations extraites ne correspondent pas aux données Google Places.');
      setIsAddingPlace(false);
      return;
    }
    
    // Note: La place est déjà liée à l'utilisateur automatiquement par /api/link-preview
    // si l'utilisateur est connecté. Pas besoin d'appeler linkPlace().
    
    // Construire un message de succès informatif
    const placeName = result.llm?.placeName || result.google?.name || result.place?.name || 'Lieu';
    const city = result.llm?.city || result.google?.formatted_address?.split(',')[0] || result.place?.city;
    
    let successMessage: string;
    if (city) {
      successMessage = `Bravo, ${placeName} a été ajouté dans ${city}`;
    } else {
      successMessage = `Bravo, ${placeName} a été ajouté dans vos lieux sauvegardés`;
    }
    
    showSuccess(successMessage);

    // Rafraîchir silencieusement la liste pour afficher le nouveau lieu
    // Rafraîchir silencieusement la liste pour afficher le nouveau lieu
    await refreshPlaces(true, true); // skipCache=true pour voir le nouveau lieu, silent=true pour pas de loader
    
    // Retirer le skeleton une fois la liste rafraîchie (délai pour que l'animation soit fluide)
    setTimeout(() => {
      setIsAddingPlace(false);
      setProcessingUrl(null);
      processingUrlRef.current = null;
    }, 500);
  };

  // Handler pour les URLs partagées depuis le share sheet
  // Traite automatiquement le lien sans ouvrir le modal
  const handleSharedUrl = React.useCallback(async (url: string) => {
    // Éviter de traiter la même URL deux fois
    if (processingUrlRef.current === url) {
      console.log('[Home] URL déjà en cours de traitement, ignorée:', url);
      return;
    }
    
    console.log('[Home] URL partagée reçue, traitement automatique:', url);
    
    try {
      // Marquer cette URL comme en cours de traitement
      processingUrlRef.current = url;
      
      // Afficher le skeleton pendant le traitement
      setIsAddingPlace(true);
      setProcessingUrl(url);
      
      // Appeler directement l'API pour traiter le lien
      const result = await analyzeLink(url);
      
      if (result) {
        // Traiter le résultat comme si c'était depuis le modal
        await handleSaveLink(result);
      } else {
        showError('Impossible d\'analyser le lien partagé.');
        setIsAddingPlace(false);
        setProcessingUrl(null);
        processingUrlRef.current = null;
      }
    } catch (error: any) {
      // Ne pas afficher d'erreur si c'est juste une requête réseau interrompue
      // (l'utilisateur a peut-être quitté l'app)
      const isNetworkError = error?.message?.includes('Network request failed') || 
                            error?.message?.includes('Aborted') ||
                            error?.name === 'AbortError';
      
      if (!isNetworkError) {
        console.error('[Home] Erreur lors du traitement automatique du lien partagé:', error);
        showError(error?.message || 'Une erreur est survenue lors de l\'analyse du lien.');
      } else {
        console.log('[Home] Requête interrompue (app peut-être en arrière-plan), le lieu sera vérifié au retour');
      }
      
      // Ne pas retirer le skeleton si c'est une erreur réseau
      // On le retirera quand l'app reviendra au premier plan
      if (!isNetworkError) {
        setIsAddingPlace(false);
        setProcessingUrl(null);
        processingUrlRef.current = null;
      }
    }
  }, [showSuccess, showError, refreshPlaces]);

  // Écouter les URLs partagées
  useShareHandler(handleSharedUrl);

  // Ref pour éviter les requêtes multiples au retour de l'app
  const isRefreshingOnAppStateRef = useRef(false);

  // Gérer le retour de l'app au premier plan quand un lieu est en cours d'ajout
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && isAddingPlace && processingUrl) {
        // Éviter les requêtes multiples
        if (isRefreshingOnAppStateRef.current) {
          return;
        }
        
        isRefreshingOnAppStateRef.current = true;
        
        try {
          // Rafraîchir la liste pour voir si le lieu a été ajouté
          // Gérer les erreurs réseau silencieusement (requêtes interrompues)
          await refreshPlaces(true, true);
        } catch (error: any) {
          // Gérer les erreurs réseau de manière silencieuse
          const isNetworkError = error?.message?.includes('Network request failed') || 
                                error?.message?.includes('Aborted') ||
                                error?.name === 'AbortError';
          
          if (!isNetworkError) {
            console.error('[Home] Erreur lors de la vérification du lieu:', error);
          }
          // Ne pas retirer le skeleton ici, attendre la réponse de analyzeLink
        } finally {
          // Réinitialiser après un court délai pour permettre un nouveau refresh si nécessaire
          setTimeout(() => {
            isRefreshingOnAppStateRef.current = false;
          }, 1000);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAddingPlace, processingUrl, refreshPlaces]);

  /**
   * Gère les erreurs lors de l'analyse de lien
   */
  const handleLinkError = (error: Error) => {
    showError(error.message || 'Une erreur est survenue lors de l\'analyse du lien.');
  };

  /**
   * Supprime les liens entre les lieux et l'utilisateur
   */
  const handleDeletePlaces = async (placeIds: string[]) => {
    try {
      // Supprimer chaque lieu un par un
      await Promise.all(placeIds.map(placeId => deletePlace(placeId)));
      
      // Afficher un message de succès
      showSuccess(`${placeIds.length} lieu${placeIds.length > 1 ? 'x' : ''} supprimé${placeIds.length > 1 ? 's' : ''} avec succès`);
      
      // Rafraîchir la liste des lieux (avec cache car c'est une action automatique)
      await refreshPlaces(false);
    } catch (error) {
      __DEV__ && console.error('[Home] Erreur lors de la suppression:', error);
      showError('Une erreur est survenue lors de la suppression des lieux.');
    }
  };

  /**
   * Mesure la hauteur totale du header (blanc + vert)
   */
  const handleHeaderContainerLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setHeaderHeight(height);
  };

  /**
   * Filtre les places selon les filtres sélectionnés
   */
  const filteredPlaces = React.useMemo(() => {
    if (!selectedCategory && !selectedType) {
      // Pas de filtre : retourner directement la liste (évite le filter inutile)
      return placesSummary;
    }
    
    return placesSummary.filter((place) => {
      // Filtre par catégorie
      if (selectedCategory && place.category !== selectedCategory) {
        return false;
      }
      
      // Filtre par type (seulement si une catégorie est sélectionnée)
      // Utilise la hiérarchie des types pour inclure les sous-types
      if (selectedCategory && selectedType && !matchesTypeFilter(place.type, selectedType)) {
        return false;
      }
      
      return true;
    });
  }, [placesSummary, selectedCategory, selectedType]);

  /**
   * Callback pour gérer les changements de position de la carte coulissante
   * Note: cardTranslateY est un shared value (référence stable), pas besoin de dépendance
   */
  const handleCardPositionChange = React.useCallback((translateY: number) => {
    cardTranslateY.value = translateY;
  }, []); // Pas de dépendances car cardTranslateY est un shared value stable

  /**
   * Callback quand la carte atteint un snap point
   * On sauvegarde le translateY pour le restaurer au remontage
   */
  const handleSnapPointReached = React.useCallback((translateY: number, cardHeight: number) => {
    // Sauvegarder le translateY pour le restaurer au remontage
    lastCardTranslateYRef.current = translateY;
  }, []);

  /**
   * Style animé pour ajuster la hauteur de la carte en fonction de la position de la carte coulissante
   * Utiliser 'worklet' pour optimiser les performances
   * Note: Dans un worklet, on utilise directement la shared value sans .value
   */
  const mapContainerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    // Dans un worklet, on accède directement à la shared value (pas besoin de .value)
    const mapHeight = HEADER_WHITE_HEIGHT + cardTranslateY.value;
    return {
      height: mapHeight,
    };
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Header blanc + Filtres - seulement sur la page home */}
        {activeTab === 'home' && (
          <MapHeader
            onLayout={handleHeaderContainerLayout}
            onAddLinkPress={() => setIsLinkModalVisible(true)}
            onAIPress={() => router.push('/ai')}
            places={placesSummary}
            selectedCategory={selectedCategory}
            selectedType={selectedType}
            onCategoryChange={handleCategoryChange}
            onTypeChange={setSelectedType}
          />
        )}
        
        {/* Contenu selon l'onglet actif */}
        {activeTab === 'home' && (
          <>
            {/* Carte */}
            <Animated.View style={[styles.mapContainer, mapContainerAnimatedStyle]}>
              {/* Popup upgrade superposée sur la map */}
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
                  {/* Marqueurs pour les lieux sauvegardés */}
                  {filteredPlaces
                    .filter((place) => 
                      place && 
                      place.id && 
                      place.lat != null && 
                      place.lon != null
                    )
                    .map((place) => (
                      <Marker
                        key={place.id}
                        coordinate={{
                          latitude: place.lat!,
                          longitude: place.lon!,
                        }}
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

            {/* Carte coulissante */}
            {headerHeight > 0 && (
              <SlidingCard
                ref={slidingCardRef}
                headerHeight={headerHeight}
                headerWhiteHeight={HEADER_WHITE_HEIGHT}
                bottomNavHeight={BOTTOM_NAV_HEIGHT + insets.bottom}
                initialSnap={lastCardTranslateYRef.current === null ? "mid" : undefined}
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

        {activeTab === 'collections' && <CollectionsScreen activeTab={activeTab} onTabChange={setActiveTab} />}

        {activeTab === 'plans' && <PlansScreen activeTab={activeTab} onTabChange={setActiveTab} />}

        {activeTab === 'settings' && (
          <View style={styles.tabContent}>
            <Text style={styles.tabTitle}>Settings</Text>
          </View>
        )}

        {/* Bottom Sheet pour ajouter un lien */}
        <LinkBottomSheet
          visible={isLinkModalVisible}
          onClose={() => {
            setIsLinkModalVisible(false);
            setLinkInput('');
            // Ne pas retirer le skeleton ici si un traitement est en cours
            // Il sera retiré dans handleSaveLink une fois terminé
            if (!isAddingPlace) {
              setProcessingUrl(null);
            }
          }}
          linkInput={linkInput}
          onLinkInputChange={setLinkInput}
          onStartProcessing={() => {
            // Afficher le skeleton AVANT le début du traitement
            setIsAddingPlace(true);
            // Stocker l'URL en cours de traitement
            if (linkInput.trim()) {
              setProcessingUrl(linkInput.trim());
            }
          }}
          onSaveLink={async (result) => {
            // Stocker l'URL si disponible dans le résultat
            if (result?.url) {
              setProcessingUrl(result.url);
            }
            try {
              await handleSaveLink(result);
            } catch (error: any) {
              // Gérer les erreurs réseau de manière gracieuse
              const isNetworkError = error?.message?.includes('Network request failed') || 
                                    error?.message?.includes('Aborted') ||
                                    error?.name === 'AbortError';
              
              if (!isNetworkError) {
                // Le skeleton sera retiré dans handleSaveLink après le refresh
                throw error;
              } else {
                // Ne pas retirer le skeleton si c'est une erreur réseau
                // On le retirera quand l'app reviendra au premier plan
                console.log('[Home] Requête interrompue depuis le modal, le lieu sera vérifié au retour');
              }
            }
          }}
          onError={(error) => {
            const isNetworkError = error?.message?.includes('Network request failed') || 
                                  error?.message?.includes('Aborted') ||
                                  error?.name === 'AbortError';
            
            if (!isNetworkError) {
              setIsAddingPlace(false); // Retirer le skeleton en cas d'erreur
              setProcessingUrl(null);
              handleLinkError(error);
            } else {
              console.log('[Home] Erreur réseau depuis le modal, le lieu sera vérifié au retour');
            }
          }}
        />


        {/* Modal Ajouter à une collection */}
        {selectedPlaceForCollection && (
          <AddToCollectionModal
            visible={isAddToCollectionModalVisible}
            onClose={() => {
              setIsAddToCollectionModalVisible(false);
              setSelectedPlaceForCollection(null);
            }}
            placeId={selectedPlaceForCollection}
            onSuccess={() => {
              refreshPlaces(false);
            }}
          />
        )}

        {/* Toast pour les notifications */}
        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={hideToast}
        />

        {/* Barre de navigation en bas */}
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    position: 'relative',
    width: '100%',
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: darkColor,
  },
});
