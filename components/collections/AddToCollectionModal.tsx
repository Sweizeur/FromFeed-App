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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColor, darkColorWithAlpha } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getCollections, addPlaceToCollection, getPlaceCollections, removePlaceFromCollection } from '@/lib/api';
import type { Collection } from '@/types/groups';

interface AddToCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  placeId: string;
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
    <View style={styles.collectionItemSkeleton}>
      <View style={styles.collectionItemContent}>
        <Animated.View style={[styles.skeletonIcon, shimmerStyle]} />
        <View style={styles.skeletonTextContainer}>
          <Animated.View style={[styles.skeletonText, shimmerStyle]} />
          <Animated.View style={[styles.skeletonText, styles.skeletonTextSmall, shimmerStyle]} />
        </View>
      </View>
    </View>
  );
}

export default function AddToCollectionModal({
  visible,
  onClose,
  placeId,
  onSuccess,
}: AddToCollectionModalProps) {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const FIXED_SHEET_HEIGHT = screenHeight * 0.6; // 60% de la hauteur de l'écran
  const translateY = useSharedValue(FIXED_SHEET_HEIGHT);
  const opacity = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [initialCollectionIds, setInitialCollectionIds] = useState<string[]>([]); // Collections où le lieu était initialement
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

  // Charger les collections et pré-sélectionner celles qui contiennent déjà le lieu
  useEffect(() => {
    if (visible) {
      const loadCollections = async () => {
        try {
          setLoading(true);
          const [collectionsResponse, placeCollectionsResponse] = await Promise.all([
            getCollections(),
            getPlaceCollections(placeId).catch(() => ({ collectionIds: [] })), // Ignorer l'erreur si le lieu n'est pas dans de collections
          ]);
          setCollections(collectionsResponse.collections as Collection[]);
          // Pré-sélectionner les collections qui contiennent déjà le lieu
          const initialIds = placeCollectionsResponse.collectionIds;
          setInitialCollectionIds(initialIds);
          setSelectedCollectionIds(initialIds);
        } catch (error) {
          console.error('[AddToCollectionModal] Erreur lors du chargement:', error);
        } finally {
          setLoading(false);
        }
      };
      loadCollections();
    }
  }, [visible, placeId]);

  // Réinitialiser quand on ferme
  useEffect(() => {
    if (!visible) {
      setSelectedCollectionIds([]);
      setInitialCollectionIds([]);
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

  const handleToggleCollection = (collectionId: string) => {
    if (selectedCollectionIds.includes(collectionId)) {
      setSelectedCollectionIds(selectedCollectionIds.filter((id) => id !== collectionId));
    } else {
      setSelectedCollectionIds([...selectedCollectionIds, collectionId]);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Calculer les différences
      const collectionsToAdd = selectedCollectionIds.filter(
        (id) => !initialCollectionIds.includes(id)
      );
      const collectionsToRemove = initialCollectionIds.filter(
        (id) => !selectedCollectionIds.includes(id)
      );

      // Retirer le lieu des collections désélectionnées
      if (collectionsToRemove.length > 0) {
        await Promise.all(
          collectionsToRemove.map((collectionId) =>
            removePlaceFromCollection(collectionId, placeId)
          )
        );
      }

      // Ajouter le lieu aux nouvelles collections sélectionnées
      if (collectionsToAdd.length > 0) {
        await Promise.all(
          collectionsToAdd.map((collectionId) =>
            addPlaceToCollection(collectionId, placeId)
          )
        );
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('[AddToCollectionModal] Erreur lors de la modification:', error);
      // TODO: Afficher un toast d'erreur
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
            <Text style={styles.bottomSheetTitle}>Ajouter à une collection</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.bottomSheetCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.bottomSheetContent}
            contentContainerStyle={[
              styles.bottomSheetContentContainer,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.collectionsList}>
                {/* Skeletons pendant le chargement */}
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonItem key={i} />
                ))}
              </View>
            ) : collections.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-outline" size={48} color="#CCC" />
                <Text style={styles.emptyStateText}>Aucune collection</Text>
                <Text style={styles.emptyStateSubtext}>
                  Créez une collection depuis l'onglet "Mes Collections"
                </Text>
              </View>
            ) : (
              <View style={styles.collectionsList}>
                {collections.map((collection) => (
                  <TouchableOpacity
                    key={collection.id}
                    style={[
                      styles.collectionItem,
                      selectedCollectionIds.includes(collection.id) && styles.collectionItemSelected,
                    ]}
                    onPress={() => handleToggleCollection(collection.id)}
                  >
                    <View style={styles.collectionItemContent}>
                      <Ionicons
                        name="folder"
                        size={20}
                        color={selectedCollectionIds.includes(collection.id) ? '#fff' : darkColor}
                      />
                      <View style={styles.collectionItemTextContainer}>
                        <Text
                          style={[
                            styles.collectionItemText,
                            selectedCollectionIds.includes(collection.id) && styles.collectionItemTextSelected,
                          ]}
                        >
                          {collection.name}
                        </Text>
                        {collection.placesCount > 0 && (
                          <Text
                            style={[
                              styles.collectionItemCount,
                              selectedCollectionIds.includes(collection.id) && styles.collectionItemCountSelected,
                            ]}
                          >
                            {collection.placesCount} lieu{collection.placesCount > 1 ? 'x' : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                    {selectedCollectionIds.includes(collection.id) && (
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Bouton de soumission */}
            {collections.length > 0 && (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {selectedCollectionIds.length === 0
                      ? 'Retirer de toutes les collections'
                      : selectedCollectionIds.length === initialCollectionIds.length && 
                        selectedCollectionIds.every(id => initialCollectionIds.includes(id))
                      ? 'Fermer'
                      : `Enregistrer`}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
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
  collectionItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  skeletonIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
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
  collectionsList: {
    gap: 8,
    marginBottom: 20,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  collectionItemSelected: {
    backgroundColor: darkColor,
    borderColor: darkColor,
  },
  collectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  collectionItemTextContainer: {
    flex: 1,
  },
  collectionItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: darkColor,
  },
  collectionItemTextSelected: {
    color: '#fff',
  },
  collectionItemCount: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  collectionItemCountSelected: {
    color: '#CCC',
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
});

