import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ScrollView,
  Image,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import {
  getAllPlacesSummary,
  batchUpdateCollectionPlaces,
} from '@/lib/api';
import { useCollection } from '@/features/collections/hooks/useCollection';
import { useQuery } from '@tanstack/react-query';
import type { PlaceSummary } from '@/features/places/types';

export default function EditCollectionPlacesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: collectionData, isLoading: loadingCollection } = useCollection(id);
  const { data: placesData } = useQuery({
    queryKey: ['places', 'summary'],
    queryFn: async () => {
      const res = await getAllPlacesSummary();
      return res?.places ?? [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (collectionData?.places && placesData) {
      const ids = new Set(collectionData.places.map((cp: { placeId: string }) => cp.placeId));
      setInitialIds(ids);
      setSelectedIds(new Set(ids));
      setPlaces(placesData);
    }
  }, [collectionData, placesData]);
  const loading = loadingCollection;

  const subtextColor = isDark ? theme.icon : '#888';
  const inputBg = isDark ? '#252628' : '#F5F5F5';
  const inputBorder = isDark ? '#3A3B3D' : '#E5E5E5';

  const togglePlace = useCallback((placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  }, []);

  const handleBack = useCallback(async () => {
    if (!id) {
      router.back();
      return;
    }

    const toAdd = [...selectedIds].filter((placeId) => !initialIds.has(placeId));
    const toRemove = [...initialIds].filter((placeId) => !selectedIds.has(placeId));

    if (toAdd.length === 0 && toRemove.length === 0) {
      router.back();
      return;
    }

    setSaving(true);
    try {
      await batchUpdateCollectionPlaces(id, toAdd, toRemove);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
      router.back();
    }
  }, [id, selectedIds, initialIds, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          )}
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Gérer les lieux</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={[styles.loadingText, { color: subtextColor }]}>Chargement...</Text>
        </View>
      ) : places.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="location-outline" size={48} color={isDark ? '#555' : '#CCC'} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun lieu sauvegardé</Text>
          <Text style={[styles.emptySubtitle, { color: subtextColor }]}>
            Ajoutez des lieux depuis la carte d'abord
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.selectionCount, { color: theme.text }]}>
            {selectedIds.size} lieu{selectedIds.size !== 1 ? 'x' : ''} dans la collection
          </Text>

          {places.map((place) => {
            const selected = selectedIds.has(place.id);

            return (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.placeItem,
                  {
                    backgroundColor: selected ? (isDark ? '#2A2D30' : '#EDF4FF') : inputBg,
                    borderColor: selected ? (isDark ? '#4A8CFF' : '#A8C8FF') : inputBorder,
                  },
                ]}
                onPress={() => togglePlace(place.id)}
                activeOpacity={0.7}
              >
                <View style={styles.placeItemRow}>
                  {place.googlePhotoUrl ? (
                    <Image source={{ uri: place.googlePhotoUrl }} style={styles.placeImg} />
                  ) : (
                    <View style={[styles.placeImgPlaceholder, selected && { backgroundColor: isDark ? '#3A3D42' : '#D6E4FF' }]}>
                      <Ionicons name="location" size={18} color={selected ? (isDark ? '#6AA3FF' : '#3B7DDD') : subtextColor} />
                    </View>
                  )}
                  <View style={styles.placeTextContainer}>
                    <Text style={[styles.placeName, { color: theme.text }]} numberOfLines={1}>
                      {place.placeName || place.rawTitle || 'Lieu sans nom'}
                    </Text>
                    <Text style={[styles.placeAddress, { color: subtextColor }]} numberOfLines={1}>
                      {place.googleFormattedAddress || place.address || place.city || ''}
                    </Text>
                  </View>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={isDark ? '#4A8CFF' : '#3B7DDD'} />
                ) : (
                  <Ionicons name="add-circle-outline" size={20} color={subtextColor} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  placeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  placeImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  placeImgPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeTextContainer: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 12,
  },
});
