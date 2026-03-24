import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { PlaceSummary } from '@/features/places/types';
import { Colors } from '@/constants/theme';
import GlassButton from '@/components/ui/GlassButton';

interface PlaceFiltersProps {
  places: PlaceSummary[];
  selectedCategory: string | null; // "Restauration" | "Activité" | "Non classé" | null (tous)
  selectedType: string | null;
  onCategoryChange: (category: string | null) => void;
  onTypeChange: (type: string | null) => void;
  /** Apparence pour le dark mode (défaut: apparence système) */
  colorScheme?: 'light' | 'dark' | null;
  transparentBackground?: boolean;
}

export default function PlaceFilters({
  places,
  selectedCategory,
  selectedType,
  onCategoryChange,
  onTypeChange,
  colorScheme: colorSchemeProp,
  transparentBackground = false,
}: PlaceFiltersProps) {
  const systemScheme = useColorScheme();
  const isDark = (colorSchemeProp ?? systemScheme) === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const themedStyles = useMemo(
    () =>
      isDark
        ? {
            container: {
              backgroundColor: transparentBackground ? 'transparent' : theme.background,
              borderBottomColor: transparentBackground ? 'transparent' : theme.border,
            },
            glassBg: '#252628' as string | undefined,
            glassBorder: '#3C3E40' as string | undefined,
            textColor: theme.icon,
            activeTint: theme.tint,
            activeTextColor: theme.background,
          }
        : {
            container: {
              backgroundColor: transparentBackground ? 'transparent' : theme.background,
              borderBottomColor: transparentBackground ? 'transparent' : theme.border,
            },
            glassBg: undefined as string | undefined,
            glassBorder: undefined as string | undefined,
            textColor: theme.icon,
            activeTint: theme.text,
            activeTextColor: theme.surface,
          },
    [isDark, theme, transparentBackground]
  );

  const categoriesAvailability = React.useMemo(() => {
    let hasRestauration = false;
    let hasActivite = false;
    let hasNonClasse = false;

    places.forEach((place) => {
      if (!place.types || place.types.length === 0) return;
      if (place.category === 'Restauration') hasRestauration = true;
      else if (place.category === 'Activité') hasActivite = true;
      else hasNonClasse = true;
    });

    return { hasRestauration, hasActivite, hasNonClasse };
  }, [places]);

  const visibleCategories = React.useMemo(() => {
    const categories: Array<'Restauration' | 'Activité' | 'Non classé'> = [];
    if (categoriesAvailability.hasRestauration) categories.push('Restauration');
    if (categoriesAvailability.hasActivite) categories.push('Activité');
    if (categoriesAvailability.hasNonClasse) categories.push('Non classé');
    return categories.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [categoriesAvailability]);

  // Extraire les types uniques selon la catégorie sélectionnée
  const allTypes = React.useMemo(() => {
    const typesSet = new Set<string>();
    places.forEach((place) => {
      // Si une catégorie est sélectionnée, ne prendre que les types de cette catégorie
      if (selectedCategory === 'Non classé') {
        if (place.category != null) return;
      } else if (selectedCategory && place.category !== selectedCategory) {
        return;
      }
      place.types?.forEach((t) => typesSet.add(t));
    });
    return Array.from(typesSet).sort();
  }, [places, selectedCategory]);

  const showTypeRow = selectedCategory && allTypes.length > 0;

  const goBackToCategories = () => {
    onCategoryChange(null);
  };

  return (
    <View style={[styles.container, themedStyles.container]}>
      {!showTypeRow ? (
        /* Vue catégories : Tous, Restauration, Activité */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.categoryContainer}
        >
          <GlassButton
            label="Tous"
            onPress={() => onCategoryChange(null)}
            active={selectedCategory === null}
            textColor={themedStyles.textColor}
            activeTextColor={themedStyles.activeTextColor}
            activeTint={themedStyles.activeTint}
            backgroundColor={themedStyles.glassBg}
            borderColor={themedStyles.glassBorder}
          />
          {visibleCategories.map((category) => (
            <GlassButton
              key={category}
              label={category}
              onPress={() => onCategoryChange(category)}
              active={selectedCategory === category}
              textColor={themedStyles.textColor}
              activeTextColor={themedStyles.activeTextColor}
              activeTint={themedStyles.activeTint}
              backgroundColor={themedStyles.glassBg}
              borderColor={themedStyles.glassBorder}
            />
          ))}
        </ScrollView>
      ) : (
        /* Vue sous-filtres : retour catégorie + types (les filtres catégorie disparaissent) */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.typeContainer}
        >
          <GlassButton
            label={selectedCategory ?? ''}
            onPress={goBackToCategories}
            icon="chevron-back"
            iconSize={18}
            compact
            textColor={theme.text}
            backgroundColor={themedStyles.glassBg}
            borderColor={themedStyles.glassBorder}
            style={styles.backButtonSpacing}
          />
          <GlassButton
            label="Tous"
            onPress={() => onTypeChange(null)}
            active={selectedType === null}
            compact
            style={styles.typeButton}
            textColor={themedStyles.textColor}
            activeTextColor={themedStyles.activeTextColor}
            activeTint={themedStyles.activeTint}
            backgroundColor={themedStyles.glassBg}
            borderColor={themedStyles.glassBorder}
          />
          {allTypes.map((type) => (
            <GlassButton
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              onPress={() => onTypeChange(type)}
              active={selectedType === type}
              compact
              style={styles.typeButton}
              textColor={themedStyles.textColor}
              activeTextColor={themedStyles.activeTextColor}
              activeTint={themedStyles.activeTint}
              backgroundColor={themedStyles.glassBg}
              borderColor={themedStyles.glassBorder}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    overflow: 'visible',
  },
  scroll: {
    overflow: 'visible',
  },
  categoryContainer: {
    gap: 8,
    paddingRight: 16,
    paddingVertical: 2,
    alignItems: 'center',
  },
  typeContainer: {
    gap: 8,
    paddingRight: 16,
    paddingVertical: 2,
    alignItems: 'center',
  },
  backButtonSpacing: {
    marginRight: 4,
  },
  typeButton: {
    alignSelf: 'center'
  },
});

