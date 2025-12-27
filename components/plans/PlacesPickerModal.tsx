import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, Dimensions, TouchableWithoutFeedback, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { darkColor, darkColorWithAlpha } from '@/constants/theme';
import { type PlaceSummary } from '@/lib/api';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.6; // 60% de la hauteur de l'écran pour la sélection multiple

interface PlacesPickerModalProps {
  visible: boolean;
  places: PlaceSummary[];
  selectedPlaceIds: string[];
  onPlaceSelect: (place: PlaceSummary) => void;
  onClose: () => void;
  multiSelect?: boolean; // Nouveau : permet la sélection multiple
  onMultiSelect?: (places: PlaceSummary[]) => void; // Nouveau : callback pour sélection multiple
}

export default function PlacesPickerModal({
  visible,
  places,
  selectedPlaceIds,
  onPlaceSelect,
  onClose,
  multiSelect = false,
  onMultiSelect,
}: PlacesPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [shouldRender, setShouldRender] = useState(false);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());
  const translateY = useSharedValue(MODAL_HEIGHT);
  const opacity = useSharedValue(0);

  // Gérer le rendu du composant
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
      // Réinitialiser la sélection quand le modal s'ouvre
      if (multiSelect) {
        setSelectedPlaces(new Set());
      }
    } else {
      translateY.value = withTiming(MODAL_HEIGHT, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(setShouldRender)(false);
      });
      // Réinitialiser la recherche et la sélection quand le modal commence à se fermer
      setSearchQuery('');
      setSelectedPlaces(new Set());
    }
  }, [visible, multiSelect]);

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.3,
  }));

  if (!shouldRender && !visible) return null;

  const availablePlaces = places.filter((p) => !selectedPlaceIds.includes(p.id));

  // Filtrer les lieux en fonction de la recherche
  const filteredPlaces = useMemo(() => {
    if (!searchQuery.trim()) {
      return availablePlaces;
    }

    const query = searchQuery.toLowerCase().trim();
    return availablePlaces.filter((place) => {
      const name = (place.placeName || place.rawTitle || '').toLowerCase();
      const address = (place.googleFormattedAddress || place.address || '').toLowerCase();
      return name.includes(query) || address.includes(query);
    });
  }, [availablePlaces, searchQuery]);

  const togglePlaceSelection = (placeId: string) => {
    const newSelected = new Set(selectedPlaces);
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    setSelectedPlaces(newSelected);
  };

  const handleAddSelected = () => {
    if (onMultiSelect && selectedPlaces.size > 0) {
      const placesToAdd = filteredPlaces.filter((p) => selectedPlaces.has(p.id));
      onMultiSelect(placesToAdd);
      setSelectedPlaces(new Set());
      onClose();
    }
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.modal, modalAnimatedStyle]}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <Text style={styles.modalTitle}>
              {multiSelect ? 'Sélectionner des lieux' : 'Sélectionner un lieu'}
            </Text>
            {multiSelect && selectedPlaces.size > 0 && (
              <Text style={styles.modalSubtitle}>
                {selectedPlaces.size} sélectionné{selectedPlaces.size > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={darkColor} />
          </TouchableOpacity>
        </View>
        
        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un lieu..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredPlaces}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = multiSelect && selectedPlaces.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.placeItem, isSelected && styles.placeItemSelected]}
                onPress={() => {
                  if (multiSelect) {
                    togglePlaceSelection(item.id);
                  } else {
                    onPlaceSelect(item);
                  }
                }}
              >
                {multiSelect && (
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                )}
                <View style={styles.placeItemContent}>
                  <Text style={styles.placeItemName} numberOfLines={1}>
                    {item.placeName || item.rawTitle || 'Lieu sans nom'}
                  </Text>
                  {item.googleFormattedAddress && (
                    <Text style={styles.placeItemAddress} numberOfLines={1}>
                      {item.googleFormattedAddress}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery.trim() 
                ? 'Aucun lieu ne correspond à votre recherche.'
                : 'Aucun lieu disponible. Ajoutez d\'abord des lieux depuis l\'onglet Home.'}
            </Text>
          }
          ListFooterComponent={
            multiSelect && selectedPlaces.size > 0 ? (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddSelected}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addButtonText}>
                    Ajouter {selectedPlaces.size} lieu{selectedPlaces.size > 1 ? 'x' : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkColorWithAlpha(0.3),
    zIndex: 1000,
  },
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: MODAL_HEIGHT,
    zIndex: 1001,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: darkColor,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  placeItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#999',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: darkColor,
    borderColor: darkColor,
  },
  placeItemContent: {
    flex: 1,
  },
  placeItemName: {
    fontSize: 16,
    fontWeight: '400',
    color: darkColor,
    marginBottom: 4,
  },
  placeItemAddress: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 32,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: darkColor,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

