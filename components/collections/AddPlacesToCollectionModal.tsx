import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColor, darkColorWithAlpha } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getAllPlacesSummary, addPlaceToCollection } from '@/lib/api';
import type { PlaceSummary } from '@/types/api';

interface AddPlacesToCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  collectionId: string;
  existingPlaceIds: string[]; // IDs des lieux déjà dans la collection
  onSuccess?: () => void;
}

// Composant Skeleton pour le chargement
function SkeletonItem() {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 1], [0.3, 0.7]);
    return {
      opacity,
    };
  });

  return (
    <View style={styles.placeItemSkeleton}>
      <View style={styles.placeItemContent}>
        <Animated.View style={[styles.skeletonImage, shimmerStyle]} />
        <View style={styles.skeletonTextContainer}>
          <Animated.View style={[styles.skeletonText, shimmerStyle]} />
          <Animated.View style={[styles.skeletonText, styles.skeletonTextSmall, shimmerStyle]} />
        </View>
      </View>
    </View>
  );
}

export default function AddPlacesToCollectionModal({
  visible,
  onClose,
  collectionId,
  existingPlaceIds,
  onSuccess,
}: AddPlacesToCollectionModalProps) {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const FIXED_SHEET_HEIGHT = screenHeight * 0.6;
  const translateY = useSharedValue(FIXED_SHEET_HEIGHT);
  const opacity = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
      keyboardOffset.value = 0;
    } else {
      translateY.value = withTiming(FIXED_SHEET_HEIGHT, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }, () => {
        runOnJS(setShouldRender)(false);
      });
      keyboardOffset.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  // Charger les lieux disponibles (exclure ceux déjà dans la collection)
  useEffect(() => {
    if (visible) {
      const loadPlaces = async () => {
        try {
          setLoading(true);
          const response = await getAllPlacesSummary();
          // Filtrer les lieux déjà dans la collection
          const availablePlaces = response.places.filter(
            (place) => !existingPlaceIds.includes(place.id)
          );
          setPlaces(availablePlaces);
        } catch (error) {
          console.error('[AddPlacesToCollectionModal] Erreur lors du chargement:', error);
        } finally {
          setLoading(false);
        }
      };
      loadPlaces();
    }
  }, [visible, existingPlaceIds]);

  // Réinitialiser quand on ferme
  useEffect(() => {
    if (!visible) {
      setSelectedPlaceIds([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        keyboardOffset.value = withTiming(-e.endCoordinates.height, {
          duration: e.duration || 250,
        });
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardOffset.value = withTiming(0, { duration: 250 });
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        translateY.value = withTiming(FIXED_SHEET_HEIGHT, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
        setTimeout(onClose, 200);
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value + keyboardOffset.value },
    ],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleTogglePlace = (placeId: string) => {
    if (selectedPlaceIds.includes(placeId)) {
      setSelectedPlaceIds(selectedPlaceIds.filter((id) => id !== placeId));
    } else {
      setSelectedPlaceIds([...selectedPlaceIds, placeId]);
    }
  };

  const handleSave = async () => {
    if (selectedPlaceIds.length === 0) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      // Ajouter tous les lieux sélectionnés à la collection
      await Promise.all(
        selectedPlaceIds.map((placeId) =>
          addPlaceToCollection(collectionId, placeId)
        )
      );
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('[AddPlacesToCollectionModal] Erreur lors de l\'ajout:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!shouldRender && !visible) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: darkColorWithAlpha(0.4) },
            animatedOverlayStyle,
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Bottom Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.bottomSheet,
            { height: FIXED_SHEET_HEIGHT },
            animatedSheetStyle,
          ]}
        >
          {/* Grabber */}
          <View style={styles.bottomSheetGrabber} />

          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Ajouter des lieux</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.bottomSheetCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content - ScrollView */}
          <ScrollView
            style={styles.bottomSheetContent}
            contentContainerStyle={styles.bottomSheetContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.placesList}>
                {/* Skeletons pendant le chargement */}
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonItem key={i} />
                ))}
              </View>
            ) : places.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color="#CCC" />
                <Text style={styles.emptyStateText}>Aucun lieu disponible</Text>
                <Text style={styles.emptyStateSubtext}>
                  Tous vos lieux sont déjà dans cette collection
                </Text>
              </View>
            ) : (
              <View style={styles.placesList}>
                {places.map((place) => (
                  <TouchableOpacity
                    key={place.id}
                    style={[
                      styles.placeItem,
                      selectedPlaceIds.includes(place.id) && styles.placeItemSelected,
                    ]}
                    onPress={() => handleTogglePlace(place.id)}
                  >
                    <View style={styles.placeItemContent}>
                      {place.googlePhotoUrl ? (
                        <Image
                          source={{ uri: place.googlePhotoUrl }}
                          style={styles.placeImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.placeImagePlaceholder}>
                          <Ionicons name="location" size={20} color={selectedPlaceIds.includes(place.id) ? '#fff' : '#999'} />
                        </View>
                      )}
                      <View style={styles.placeItemTextContainer}>
                        <Text
                          style={[
                            styles.placeItemText,
                            selectedPlaceIds.includes(place.id) && styles.placeItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {place.placeName || place.rawTitle || 'Lieu sans nom'}
                        </Text>
                        <Text
                          style={[
                            styles.placeItemAddress,
                            selectedPlaceIds.includes(place.id) && styles.placeItemAddressSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {place.googleFormattedAddress || place.address || place.city || 'Adresse non disponible'}
                        </Text>
                      </View>
                    </View>
                    {selectedPlaceIds.includes(place.id) && (
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Bouton de soumission - Fixe en bas */}
          {places.length > 0 && (
            <View style={[styles.submitButtonContainer, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  selectedPlaceIds.length === 0 && styles.submitButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving || selectedPlaceIds.length === 0}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {selectedPlaceIds.length === 0
                      ? 'Sélectionner des lieux'
                      : `Ajouter ${selectedPlaceIds.length} lieu${selectedPlaceIds.length > 1 ? 'x' : ''}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: darkColor,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 20,
    elevation: 15,
    flexDirection: 'column',
  },
  bottomSheetGrabber: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: darkColor,
  },
  bottomSheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetContentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  submitButtonContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  placesList: {
    gap: 8,
    marginBottom: 20,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  placeItemSelected: {
    backgroundColor: darkColor,
    borderColor: darkColor,
  },
  placeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  placeImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  placeImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeItemTextContainer: {
    flex: 1,
  },
  placeItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: darkColor,
    marginBottom: 4,
  },
  placeItemTextSelected: {
    color: '#fff',
  },
  placeItemAddress: {
    fontSize: 13,
    color: '#666',
  },
  placeItemAddressSelected: {
    color: '#CCC',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  submitButton: {
    backgroundColor: darkColor,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  placeItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  skeletonImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  skeletonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonText: {
    width: '70%',
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonTextSmall: {
    width: '50%',
    height: 12,
    marginBottom: 0,
  },
});

