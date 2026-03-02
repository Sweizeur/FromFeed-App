import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '@/components/common/Toast';
import PlaceTransition from '@/components/places/PlaceTransition';
import AddToCollectionModal from '@/components/collections/AddToCollectionModal';
import { deletePlace, type Place, type PlaceSummary } from '@/lib/api';
import { usePlaces } from '@/hooks/usePlaces';
import { useToast } from '@/hooks/useToast';
import { matchesTypeFilter } from '@/utils/typeHierarchy';

export default function SavedPlacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    placesSummary,
    selectedPlace,
    placesListKey,
    refreshing,
    refreshPlaces,
    clearSelectedPlace,
    setSelectedPlace,
  } = usePlaces();

  const { toast, showSuccess, showError, hideToast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isAddToCollectionModalVisible, setIsAddToCollectionModalVisible] = useState(false);
  const [selectedPlaceForCollection, setSelectedPlaceForCollection] = useState<string | null>(null);

  const placeDetailsScrollViewRef = useRef<any>(null);

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setSelectedType(null);
  };

  const filteredPlaces = useMemo(() => {
    if (!selectedCategory && !selectedType) return placesSummary;
    return placesSummary.filter((place) => {
      if (selectedCategory && place.category !== selectedCategory) return false;
      if (selectedCategory && selectedType && !matchesTypeFilter(place.type, selectedType)) return false;
      return true;
    });
  }, [placesSummary, selectedCategory, selectedType]);

  const handlePlacePress = useCallback((place: Place | PlaceSummary) => {
    setSelectedPlace(place as Place);
  }, [setSelectedPlace]);

  const handleDeletePlaces = useCallback(async (placeIds: string[]) => {
    try {
      await Promise.all(placeIds.map((placeId) => deletePlace(placeId)));
      showSuccess(`${placeIds.length} lieu${placeIds.length > 1 ? 'x' : ''} supprimé${placeIds.length > 1 ? 's' : ''} avec succès`);
      await refreshPlaces(false);
    } catch (error) {
      __DEV__ && console.error('[SavedPlaces] Erreur lors de la suppression:', error);
      showError('Une erreur est survenue lors de la suppression des lieux.');
    }
  }, [refreshPlaces, showSuccess, showError]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={[styles.content, { paddingBottom: insets.bottom + 52 }]}>
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
        </View>

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
  content: {
    flex: 1,
  },
});

