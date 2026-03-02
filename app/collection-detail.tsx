import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Text,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import SlidingCard, { SlidingCardRef } from '@/components/common/SlidingCard';
import MapHeader from '@/components/navigation/MapHeader';
import PlaceTransition from '@/components/places/PlaceTransition';
import AddToCollectionModal from '@/components/collections/AddToCollectionModal';
import AddPlacesToCollectionModal from '@/components/collections/AddPlacesToCollectionModal';
import Toast from '@/components/common/Toast';
import { getCollection, getAllPlacesSummary, deletePlace, type Place, type PlaceSummary } from '@/lib/api';
import { useMap } from '@/hooks/useMap';
import { useToast } from '@/hooks/useToast';
import { matchesTypeFilter } from '@/utils/typeHierarchy';
import { darkColor } from '@/constants/theme';

const HEADER_WHITE_HEIGHT = 120;
const BOTTOM_NAV_HEIGHT = 52;

export default function CollectionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const { region, loadingLocation, mapViewRef, animateToPlace } = useMap();
  const { toast, showSuccess, showError, hideToast } = useToast();

  // État local
  const [collection, setCollection] = useState<any>(null);
  const [collectionPlaces, setCollectionPlaces] = useState<PlaceSummary[]>([]);
  const [allPlaces, setAllPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isAddToCollectionModalVisible, setIsAddToCollectionModalVisible] = useState(false);
  const [selectedPlaceForCollection, setSelectedPlaceForCollection] = useState<string | null>(null);
  const [isAddPlacesModalVisible, setIsAddPlacesModalVisible] = useState(false);
  
  // Filtres
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  
  // Refs
  const slidingCardRef = useRef<SlidingCardRef>(null);
  const placeDetailsScrollViewRef = useRef<any>(null);
  const cardTranslateY = useSharedValue(0);
  const placesListKey = useRef(0);

  // Charger la collection et les lieux
  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [collectionResponse, allPlacesResponse] = await Promise.all([
          getCollection(id),
          getAllPlacesSummary(),
        ]);
        
        setCollection(collectionResponse.collection);
        setAllPlaces(allPlacesResponse.places);
        
        // Convertir les lieux de la collection en PlaceSummary complets
        const collectionPlaceIds = new Set(
          collectionResponse.collection.places.map((cp: any) => cp.placeId)
        );
        
        const fullCollectionPlaces = allPlacesResponse.places
          .filter((place) => collectionPlaceIds.has(place.id))
          .map((place) => ({
            ...place,
            // S'assurer que les coordonnées sont présentes
            lat: place.lat ?? undefined,
            lon: place.lon ?? undefined,
          }));
        
        setCollectionPlaces(fullCollectionPlaces);
      } catch (error) {
        __DEV__ && console.error('[CollectionDetail] Erreur lors du chargement:', error);
        showError('Impossible de charger la collection');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const refreshCollection = async () => {
    if (!id) return;
    try {
      setRefreshing(true);
      // skipCache=true pour forcer la mise à jour depuis la DB lors d'un reload manuel
      const [collectionResponse, allPlacesResponse] = await Promise.all([
        getCollection(id),
        getAllPlacesSummary(true),
      ]);
      
      setCollection(collectionResponse.collection);
      setAllPlaces(allPlacesResponse.places);
      
      const collectionPlaceIds = new Set(
        collectionResponse.collection.places.map((cp: any) => cp.placeId)
      );
      
      const fullCollectionPlaces = allPlacesResponse.places
        .filter((place) => collectionPlaceIds.has(place.id))
        .map((place) => ({
          ...place,
          lat: place.lat ?? undefined,
          lon: place.lon ?? undefined,
        }));
      
      setCollectionPlaces(fullCollectionPlaces);
      placesListKey.current += 1;
    } catch (error) {
      __DEV__ && console.error('[CollectionDetail] Erreur lors du rafraîchissement:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePlacePress = async (place: Place | PlaceSummary) => {
    // Si c'est un PlaceSummary, on peut juste l'utiliser directement
    // ou charger les détails si nécessaire
    setSelectedPlace(place as Place);
    await animateToPlace(place);
    if (slidingCardRef.current) {
      slidingCardRef.current.animateToSnapPoint(50);
    }
  };

  const clearSelectedPlace = () => {
    setSelectedPlace(null);
  };

  const handleDeletePlaces = async (placeIds: string[]) => {
    try {
      // Supprimer les lieux de la collection (pas les lieux eux-mêmes)
      // TODO: Implémenter removePlaceFromCollection
      showSuccess(`${placeIds.length} lieu${placeIds.length > 1 ? 'x' : ''} retiré${placeIds.length > 1 ? 's' : ''} de la collection`);
      await refreshCollection();
    } catch (error) {
      __DEV__ && console.error('[CollectionDetail] Erreur lors de la suppression:', error);
      showError('Une erreur est survenue lors de la suppression des lieux.');
    }
  };

  const handleHeaderContainerLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setHeaderHeight(height);
  };

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedType(null);
  };

  // Filtrer les places selon les filtres sélectionnés
  const filteredPlaces = useMemo(() => {
    return collectionPlaces.filter((place) => {
      if (selectedCategory && place.category !== selectedCategory) {
        return false;
      }
      if (selectedCategory && selectedType && !matchesTypeFilter(place.type, selectedType)) {
        return false;
      }
      return true;
    });
  }, [collectionPlaces, selectedCategory, selectedType]);

  const mapContainerAnimatedStyle = useAnimatedStyle(() => {
    const mapHeight = HEADER_WHITE_HEIGHT + cardTranslateY.value;
    return {
      height: mapHeight,
    };
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={darkColor} />
        </View>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Collection introuvable</Text>
        </View>
      </View>
    );
  }

  // Filtrer les places valides pour la carte
  const validPlacesForMap = filteredPlaces.filter(
    (place) => place.lat != null && place.lon != null && !isNaN(place.lat) && !isNaN(place.lon)
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Header avec titre de la collection */}
        <MapHeader
          onLayout={handleHeaderContainerLayout}
          onAddLinkPress={() => {
            setIsAddPlacesModalVisible(true);
          }}
          places={filteredPlaces}
          selectedCategory={selectedCategory}
          selectedType={selectedType}
          onCategoryChange={handleCategoryChange}
          onTypeChange={setSelectedType}
          title={collection.name}
          showBackButton
          onBackPress={() => router.back()}
          hideAIButton
          hideNotificationButton
        />

        {/* Carte */}
        <Animated.View style={[styles.mapContainer, mapContainerAnimatedStyle]}>
          {loadingLocation && (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={darkColor} />
            </View>
          )}
          
          {!loadingLocation && region && (
            <MapView
              ref={mapViewRef}
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              showsUserLocation
              showsMyLocationButton={false}
              toolbarEnabled={false}
            >
              {validPlacesForMap.map((place) => (
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
            bottomNavHeight={insets.bottom}
            initialSnap="mid"
            enableFling
            grabber
            onPositionChange={(translateY) => {
              cardTranslateY.value = translateY;
            }}
          >
            <PlaceTransition
              selectedPlace={selectedPlace}
              placesSummary={filteredPlaces}
              placesListKey={placesListKey.current}
              onPlacePress={handlePlacePress}
              onBack={clearSelectedPlace}
              scrollViewRef={placeDetailsScrollViewRef}
              onRefreshPlaces={refreshCollection}
              refreshingPlaces={refreshing}
              onRatingUpdated={refreshCollection}
              onDeletePlaces={handleDeletePlaces}
              onAddToCollection={(placeId) => {
                setSelectedPlaceForCollection(placeId);
                setIsAddToCollectionModalVisible(true);
              }}
            />
          </SlidingCard>
        )}

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
              refreshCollection();
            }}
          />
        )}

        {/* Modal Ajouter des lieux à la collection */}
        {id && (
          <AddPlacesToCollectionModal
            visible={isAddPlacesModalVisible}
            onClose={() => {
              setIsAddPlacesModalVisible(false);
            }}
            collectionId={id}
            existingPlaceIds={collectionPlaces.map((place) => place.id)}
            onSuccess={() => {
              refreshCollection();
            }}
          />
        )}

        {/* Toast */}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
  },
});
