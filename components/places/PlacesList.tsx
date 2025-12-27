import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, Text, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlaceSummary } from '@/types/api';
import PlaceCard from './PlaceCard';
import { darkColor } from '@/constants/theme';

interface PlacesListProps {
  onPlacePress?: (place: PlaceSummary) => void;
  placesSummary: PlaceSummary[]; // Places passées depuis le parent (requis)
  onRefresh?: () => Promise<void>; // Fonction de rafraîchissement
  refreshing?: boolean; // État de rafraîchissement
  onDeletePlaces?: (placeIds: string[]) => Promise<void>; // Fonction pour supprimer des lieux
  onAddToCollection?: (placeId: string) => void; // Fonction pour ajouter à une collection
}

export default function PlacesList({ onPlacePress, placesSummary, onRefresh, refreshing = false, onDeletePlaces, onAddToCollection }: PlacesListProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

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
      await onRefresh();
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedPlaceIds(new Set());
  };

  const togglePlaceSelection = (placeId: string) => {
    const newSelected = new Set(selectedPlaceIds);
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    setSelectedPlaceIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedPlaceIds.size === 0 || !onDeletePlaces) return;
    
    const count = selectedPlaceIds.size;
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
              await onDeletePlaces(Array.from(selectedPlaceIds));
              setSelectedPlaceIds(new Set());
              setIsSelectionMode(false);
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (placesSummary.length === 0) {
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
      data={placesSummary}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PlaceCard
          place={item}
          onPress={() => {
            if (isSelectionMode) {
              togglePlaceSelection(item.id);
            } else {
              onPlacePress?.(item);
            }
          }}
          isSelectionMode={isSelectionMode}
          isSelected={selectedPlaceIds.has(item.id)}
          onAddToCollection={onAddToCollection ? () => onAddToCollection(item.id) : undefined}
          isInCollection={placesInCollections.has(item.id)}
        />
      )}
      ListFooterComponent={
        isSelectionMode && selectedPlaceIds.size > 0 ? (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleDeleteSelected}
              style={[styles.deleteButtonFooter, isDeleting && styles.deleteButtonDisabled]}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={14} color="#FF3B30" />
              <Text style={styles.deleteButtonTextFooter}>
                {isDeleting ? 'Suppression...' : 'Supprimer'}
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
        placesSummary.length > 0 ? (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerText}>
                {isSelectionMode && selectedPlaceIds.size > 0
                  ? `${selectedPlaceIds.size} sélectionné${selectedPlaceIds.size > 1 ? 's' : ''}`
                  : `${placesSummary.length} ${placesSummary.length === 1 ? 'lieu sauvegardé' : 'lieux sauvegardés'}`}
              </Text>
              {isSelectionMode && selectedPlaceIds.size > 0 && (
                <TouchableOpacity
                  onPress={() => setSelectedPlaceIds(new Set())}
                  style={styles.clearSelectionButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearSelectionText}>Tout désélectionner</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.headerRight}>
              {isSelectionMode && selectedPlaceIds.size > 0 && (
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
