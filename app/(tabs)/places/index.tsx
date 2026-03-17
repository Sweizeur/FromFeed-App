import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useColorScheme } from 'react-native';
import { useSearchText } from './_layout';
import PlacesList from '@/components/places/PlacesList';
import PlaceFilters from '@/components/places/PlaceFilters';
import { usePlaces } from '@/hooks/usePlaces';
import { useAddingPlace } from '@/contexts/AddingPlaceContext';
import { Colors } from '@/constants/theme';
import { matchesTypeFilter } from '@/utils/typeHierarchy';

/** Fallback si useHeaderHeight retourne 0 */
const FALLBACK_HEADER_OFFSET = Platform.OS === 'ios' ? 120 : 56;

const HEADER_ANIMATION_DURATION = 250;

export default function PlacesScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const colorScheme = useColorScheme();
  const { searchText } = useSearchText();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const targetPadding = headerHeight > 0 ? headerHeight : FALLBACK_HEADER_OFFSET;
  const animatedPaddingTop = useSharedValue(targetPadding);
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  useEffect(() => {
    animatedPaddingTop.value = withTiming(targetPadding, {
      duration: HEADER_ANIMATION_DURATION,
    });
  }, [targetPadding, animatedPaddingTop]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    paddingTop: animatedPaddingTop.value,
  }));

  const themedStyles = useMemo(
    () => ({
      container: { backgroundColor: theme.background },
      emptyTitle: { color: theme.text },
      emptyText: { color: theme.icon },
      divider: { backgroundColor: isDark ? '#2C2E30' : '#F0F0F0' },
    }),
    [theme, isDark]
  );

  const {
    placesSummary,
    refreshing,
    refreshPlaces,
  } = usePlaces();
  const { isAddingPlace, placesVersion } = useAddingPlace();

  const initialVersion = useRef(placesVersion);
  useEffect(() => {
    if (placesVersion > initialVersion.current) {
      refreshPlaces(true, true);
    }
  }, [placesVersion, refreshPlaces]);

  const filteredPlaces = useMemo(() => {
    return placesSummary.filter((place) => {
      if (selectedCategory && place.category !== selectedCategory) return false;
      if (selectedCategory && selectedType && !matchesTypeFilter(place.type, selectedType)) return false;
      const q = searchText.trim().toLowerCase();
      if (!q) return true;
      const haystack = [
        place.placeName,
        place.rawTitle,
        place.city,
        place.address,
        place.googleFormattedAddress,
        place.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [placesSummary, searchText, selectedCategory, selectedType]);

  const handlePlacePress = useCallback(
    (place: any) => {
      // Pour l'instant on renvoie juste vers la carte centrée sur ce lieu
      // Tu pourras adapter si tu veux un détail dédié
      router.push('/(tabs)/map');
    },
    [router]
  );

  return (
    <Animated.View style={[styles.container, themedStyles.container, containerAnimatedStyle]}>
      {placesSummary.length === 0 && !isAddingPlace ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, themedStyles.emptyTitle]}>Aucun lieu sauvegardé</Text>
          <Text style={[styles.emptyText, themedStyles.emptyText]}>
            Ajoutez d’abord des lieux depuis la carte, puis utilisez la recherche pour les retrouver.
          </Text>
        </View>
      ) : (
        <>
          <PlaceFilters
            places={placesSummary}
            selectedCategory={selectedCategory}
            selectedType={selectedType}
            onCategoryChange={setSelectedCategory}
            onTypeChange={setSelectedType}
            colorScheme={colorScheme ?? 'light'}
          />
          <View style={[styles.divider, themedStyles.divider]} />

          <PlacesList
            placesSummary={filteredPlaces}
            onPlacePress={handlePlacePress}
            onRefresh={refreshPlaces}
            refreshing={refreshing}
            isAddingPlace={isAddingPlace}
          />
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginBottom: 4,
  },
});
