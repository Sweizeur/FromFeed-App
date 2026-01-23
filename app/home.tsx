import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Text,
  Keyboard,
  TouchableWithoutFeedback,
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
    
    // Vérifier si c'est un traitement asynchrone
    if (result && 'processing' in result && result.processing === true) {
      // Le traitement est en cours en arrière-plan
      showSuccess('Le lien est en cours de traitement. Le lieu sera ajouté automatiquement une fois l\'analyse terminée.');
      
      // Rafraîchir la liste après quelques secondes pour voir le nouveau lieu
      // On fait plusieurs tentatives car le traitement peut prendre du temps
      const refreshAttempts = [3, 8, 15]; // Rafraîchir après 3s, 8s, et 15s
      refreshAttempts.forEach((delay) => {
        setTimeout(async () => {
          await refreshPlaces(true); // skipCache pour voir le nouveau lieu
        }, delay * 1000);
      });
      
      return;
    }
    
    // Ancien format de réponse (pour compatibilité)
    // Vérifier si le lieu a bien été créé
    if (!result.placeId) {
      showError('Le lieu n\'a pas pu être ajouté. Les informations extraites ne correspondent pas aux données Google Places.');
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

    // Rafraîchir toutes les places (avec cache car c'est une action automatique)
    await refreshPlaces(false);
  };

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
          }}
          linkInput={linkInput}
          onLinkInputChange={setLinkInput}
          onSaveLink={handleSaveLink}
          onError={handleLinkError}
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
