import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, Text, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlaceSummary, PendingPlace } from '@/types/api';
import PlaceCard from './PlaceCard';
import PlaceSkeleton from './PlaceSkeleton';
import { darkColor } from '@/constants/theme';

type PlaceListItem = PlaceSummary | PendingPlace;

interface PlacesListProps {
  onPlacePress?: (place: PlaceSummary) => void;
  placesSummary: PlaceSummary[]; // Places passées depuis le parent (requis)
  pendingPlaces?: PendingPlace[]; // Places en attente de traitement (squelettes)
  onRefresh?: (skipCache?: boolean) => Promise<void>; // Fonction de rafraîchissement
  refreshing?: boolean; // État de rafraîchissement
  onDeletePlaces?: (placeIds: string[]) => Promise<void>; // Fonction pour supprimer des lieux
  onAddToCollection?: (placeId: string) => void; // Fonction pour ajouter à une collection
}

export default function PlacesList({ onPlacePress, placesSummary, pendingPlaces = [], onRefresh, refreshing = false, onDeletePlaces, onAddToCollection }: PlacesListProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  // Utiliser un tableau au lieu d'un Set pour une meilleure stabilité
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Convertir en Set pour les vérifications rapides
  const selectedPlaceIdsSet = useMemo(() => new Set(selectedPlaceIds), [selectedPlaceIds]);

  // Combiner les places normales et les places en attente
  // Les places en attente sont affichées en premier
  const allPlaces: PlaceListItem[] = useMemo(() => {
    return [...pendingPlaces, ...placesSummary];
  }, [pendingPlaces, placesSummary]);

  // Utiliser directement les collectionIds depuis les places (plus besoin d'appels API)
  const placesInCollections = useMemo(() => {
    const inCollections = new Set<string>();
    placesSummary.forEach((place) => {
      if (place.collectionIds && place.collectionIds.length > 0) {
        inCollections.add(place.id);
      }
    });
    return inCollections;
  }, [placesSummary]);

  const handleRefresh = async () => {
    if (onRefresh) {
      // Passer skipCache=true pour le pull-to-refresh manuel
      await onRefresh(true);
    }
  };

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      const newMode = !prev;
      // Réinitialiser la sélection quand on quitte le mode sélection
      if (!newMode) {
        setSelectedPlaceIds([]);
      }
      return newMode;
    });
  }, []);

  const togglePlaceSelection = useCallback((placeId: string) => {
    setSelectedPlaceIds((prev) => {
      const index = prev.indexOf(placeId);
      if (index > -1) {
        // Retirer de la sélection
        return prev.filter((id) => id !== placeId);
      } else {
        // Ajouter à la sélection
        return [...prev, placeId];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPlaceIds([]);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedPlaceIds.length === 0 || !onDeletePlaces) return;
    
    const count = selectedPlaceIds.length;
    Alert.alert(
      'Supprimer les lieux',
      `Êtes-vous sûr de vouloir supprimer ${count} lieu${count > 1 ? 'x' : ''} de votre liste ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDeletePlaces([...selectedPlaceIds]);
              setSelectedPlaceIds([]);
              setIsSelectionMode(false);
            } catch (error) {
              __DEV__ && console.error('Erreur lors de la suppression:', error);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [selectedPlaceIds, onDeletePlaces]);

  // Mémoriser les callbacks pour éviter les re-renders
  // IMPORTANT: Les hooks doivent être appelés avant tout early return
  const renderItem = React.useCallback(({ item }: { item: PlaceListItem }) => {
    // Si c'est une place en attente, afficher le squelette
    if ('pending' in item && item.pending) {
      return <PlaceSkeleton url={item.url} />;
    }

    // Sinon, c'est une place normale
    const place = item as PlaceSummary;
    const isSelected = selectedPlaceIdsSet.has(place.id);
    
    const handlePress = () => {
      if (isSelectionMode) {
        togglePlaceSelection(place.id);
      } else {
        onPlacePress?.(place);
      }
    };

    const handleAddToCollection = onAddToCollection 
      ? () => onAddToCollection(place.id)
      : undefined;

    return (
      <PlaceCard
        place={place}
        onPress={handlePress}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onAddToCollection={handleAddToCollection}
        isInCollection={placesInCollections.has(place.id)}
      />
    );
  }, [isSelectionMode, selectedPlaceIdsSet, onPlacePress, onAddToCollection, placesInCollections, togglePlaceSelection]);

  const keyExtractor = React.useCallback((item: PlaceListItem) => item.id, []);

  if (allPlaces.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Aucun lieu sauvegardé</Text>
        <Text style={styles.emptySubtext}>
          Ajoutez un lien TikTok ou Instagram pour commencer
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={allPlaces}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={10}
      ListFooterComponent={
        isSelectionMode && selectedPlaceIds.length > 0 ? (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleDeleteSelected}
              style={[styles.deleteButtonFooter, isDeleting && styles.deleteButtonDisabled]}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={14} color="#FF3B30" />
              <Text style={styles.deleteButtonTextFooter}>
                {isDeleting ? 'Suppression...' : `Supprimer ${selectedPlaceIds.length}`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#1A1A1A"
        />
      }
      ListHeaderComponent={
        allPlaces.length > 0 ? (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerText}>
                {isSelectionMode && selectedPlaceIds.length > 0
                  ? `${selectedPlaceIds.length} sélectionné${selectedPlaceIds.length > 1 ? 's' : ''}`
                  : `${placesSummary.length} ${placesSummary.length === 1 ? 'lieu sauvegardé' : 'lieux sauvegardés'}${pendingPlaces.length > 0 ? ` (${pendingPlaces.length} en cours)` : ''}`}
              </Text>
              {isSelectionMode && selectedPlaceIds.length > 0 && (
                <TouchableOpacity
                  onPress={clearSelection}
                  style={styles.clearSelectionButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearSelectionText}>Tout désélectionner</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.headerRight}>
              {isSelectionMode && selectedPlaceIds.length > 0 && (
                <TouchableOpacity
                  onPress={handleDeleteSelected}
                  style={[styles.deleteButtonHeader, isDeleting && styles.deleteButtonDisabled]}
                  disabled={isDeleting}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={toggleSelectionMode}
                style={[styles.selectionButton, isSelectionMode && styles.selectionButtonActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectionButtonText, isSelectionMode && styles.selectionButtonTextActive]}>
                  {isSelectionMode ? 'Terminer' : 'Sélectionner'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    color: darkColor,
    letterSpacing: -0.3,
  },
  clearSelectionButton: {
    marginTop: 6,
  },
  clearSelectionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButtonHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  selectionButtonActive: {
    backgroundColor: darkColor,
    borderColor: darkColor,
  },
  selectionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: darkColor,
    letterSpacing: -0.2,
  },
  selectionButtonTextActive: {
    color: '#fff',
  },
  footer: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  deleteButtonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonTextFooter: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
