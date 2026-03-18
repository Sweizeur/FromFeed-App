import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, Text, RefreshControl, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlaceSummary } from '@/features/places/types';

/** Item factice pour afficher le skeleton en tête de liste pendant l'ajout d'un lieu */
export interface PlaceSummarySkeletonItem {
  id: '__skeleton__';
  __isSkeleton: true;
}
import PlaceCard from './PlaceCard';
import PlaceCardSkeleton from './PlaceCardSkeleton';
import GlassButton from '@/components/ui/GlassButton';
import { Colors, darkColor } from '@/constants/theme';

interface PlacesListProps {
  onPlacePress?: (place: PlaceSummary) => void;
  placesSummary: PlaceSummary[]; // Places passées depuis le parent (requis)
  onRefresh?: (skipCache?: boolean) => Promise<void>; // Fonction de rafraîchissement
  refreshing?: boolean; // État de rafraîchissement
  onDeletePlaces?: (placeIds: string[]) => Promise<void>; // Fonction pour supprimer des lieux
  onAddToCollection?: (placeId: string) => void; // Fonction pour ajouter à une collection
  isAddingPlace?: boolean; // Affiche un skeleton pendant l'ajout d'un lieu
}

export default function PlacesList({ onPlacePress, placesSummary, onRefresh, refreshing = false, onDeletePlaces, onAddToCollection, isAddingPlace = false }: PlacesListProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  // Utiliser un tableau au lieu d'un Set pour une meilleure stabilité
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const themedStyles = useMemo(
    () =>
      isDark
        ? {
            headerText: { color: theme.text },
            clearSelectionText: { color: theme.icon },
            emptyText: { color: theme.text },
            emptySubtext: { color: theme.icon },
            deleteButtonHeader: { backgroundColor: '#3C2A2A', borderColor: '#4A3535' },
          }
        : {},
    [isDark, theme]
  );

  // Convertir en Set pour les vérifications rapides
  const selectedPlaceIdsSet = useMemo(() => new Set(selectedPlaceIds), [selectedPlaceIds]);

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

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh(true);
    }
  }, [onRefresh]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        tintColor={theme.text}
      />
    ),
    [refreshing, handleRefresh, theme.text]
  );

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
  const renderItem = React.useCallback(({ item }: { item: PlaceSummary }) => {
    const isSelected = selectedPlaceIdsSet.has(item.id);
    
    const handlePress = () => {
      if (isSelectionMode) {
        togglePlaceSelection(item.id);
      } else {
        onPlacePress?.(item);
      }
    };

    const handleAddToCollection = onAddToCollection 
      ? () => onAddToCollection(item.id)
      : undefined;

    return (
      <PlaceCard
        place={item}
        onPress={handlePress}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onAddToCollection={handleAddToCollection}
        isInCollection={placesInCollections.has(item.id)}
      />
    );
  }, [isSelectionMode, selectedPlaceIdsSet, onPlacePress, onAddToCollection, placesInCollections, togglePlaceSelection]);

  const keyExtractor = React.useCallback(
    (item: PlaceSummary | PlaceSummarySkeletonItem) => item.id,
    []
  );

  // Ajouter le skeleton comme premier élément si on est en train d'ajouter un lieu
  const dataWithSkeleton = React.useMemo((): (PlaceSummary | PlaceSummarySkeletonItem)[] => {
    if (isAddingPlace) {
      const skeletonItem: PlaceSummarySkeletonItem = { id: '__skeleton__', __isSkeleton: true };
      return [skeletonItem, ...placesSummary];
    }
    return placesSummary;
  }, [placesSummary, isAddingPlace]);

  // Render item qui gère à la fois les lieux et le skeleton
  const renderItemWithSkeleton = React.useCallback(
    ({ item }: { item: PlaceSummary | PlaceSummarySkeletonItem }) => {
      if ('__isSkeleton' in item && item.__isSkeleton) {
        return (
          <View style={styles.skeletonContainer}>
            <PlaceCardSkeleton />
          </View>
        );
      }
      return renderItem({ item: item as PlaceSummary });
    },
    [renderItem]
  );

  if (placesSummary.length === 0 && !isAddingPlace) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, themedStyles.emptyText]}>Aucun lieu sauvegardé</Text>
        <Text style={[styles.emptySubtext, themedStyles.emptySubtext]}>
          Ajoutez un lien TikTok ou Instagram pour commencer
        </Text>
      </View>
    );
  }

  const stickyHeader = (
    <View style={styles.stickyHeaderContainer}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerText, themedStyles.headerText]}>
            {isSelectionMode && selectedPlaceIds.length > 0
              ? `${selectedPlaceIds.length} sélectionné${selectedPlaceIds.length > 1 ? 's' : ''}`
              : `${placesSummary.length} ${placesSummary.length === 1 ? 'lieu sauvegardé' : 'lieux sauvegardés'}`}
          </Text>
          {isSelectionMode && selectedPlaceIds.length > 0 && (
            <TouchableOpacity
              onPress={clearSelection}
              style={styles.clearSelectionButton}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearSelectionText, themedStyles.clearSelectionText]}>Tout désélectionner</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerRight}>
          {isSelectionMode && selectedPlaceIds.length > 0 && (
            <TouchableOpacity
              onPress={handleDeleteSelected}
              style={[styles.deleteButtonHeader, themedStyles.deleteButtonHeader, isDeleting && styles.deleteButtonDisabled]}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            </TouchableOpacity>
          )}
          <GlassButton
            label={isSelectionMode ? 'Terminer' : 'Sélectionner'}
            onPress={toggleSelectionMode}
            active={isSelectionMode}
            textColor={theme.text}
            activeTextColor={theme.background}
            activeTint={theme.tint}
            backgroundColor={isDark ? '#252628' : undefined}
            borderColor={isDark ? '#3C3E40' : undefined}
            compact
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.listWrapper}>
      {stickyHeader}
      <FlatList
        data={dataWithSkeleton}
        keyExtractor={(item) => ('__isSkeleton' in item && item.__isSkeleton) ? '__skeleton__' : keyExtractor(item)}
        renderItem={renderItemWithSkeleton}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        contentContainerStyle={styles.listContent}
        refreshControl={refreshControl}
      />
    </View>
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
  listWrapper: {
    flex: 1,
  },
  stickyHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
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
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  skeletonContainer: {
    // Pas de padding supplémentaire, le skeleton a déjà le bon style
  },
});
