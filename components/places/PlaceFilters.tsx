import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlaceSummary } from '@/types/api';
import { darkColor } from '@/constants/theme';

interface PlaceFiltersProps {
  places: PlaceSummary[];
  selectedCategory: string | null; // "Restauration" | "Activité" | null (tous)
  selectedType: string | null;
  onCategoryChange: (category: string | null) => void;
  onTypeChange: (type: string | null) => void;
}

export default function PlaceFilters({
  places,
  selectedCategory,
  selectedType,
  onCategoryChange,
  onTypeChange,
}: PlaceFiltersProps) {
  // Extraire les types uniques selon la catégorie sélectionnée
  const allTypes = React.useMemo(() => {
    const typesSet = new Set<string>();
    places.forEach((place) => {
      // Si une catégorie est sélectionnée, ne prendre que les types de cette catégorie
      if (selectedCategory && place.category !== selectedCategory) {
        return;
      }
      if (place.type) {
        typesSet.add(place.type);
      }
    });
    return Array.from(typesSet).sort();
  }, [places, selectedCategory]);

  const showTypeRow = selectedCategory && allTypes.length > 0;

  const goBackToCategories = () => {
    onCategoryChange(null);
    onTypeChange(null);
  };

  return (
    <View style={styles.container}>
      {!showTypeRow ? (
        /* Vue catégories : Tous, Restauration, Activité */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedCategory === null && styles.filterButtonActive,
            ]}
            onPress={() => onCategoryChange(null)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedCategory === null && styles.filterButtonTextActive,
              ]}
            >
              Tous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedCategory === 'Restauration' && styles.filterButtonActive,
            ]}
            onPress={() => onCategoryChange('Restauration')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedCategory === 'Restauration' && styles.filterButtonTextActive,
              ]}
            >
              Restauration
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedCategory === 'Activité' && styles.filterButtonActive,
            ]}
            onPress={() => onCategoryChange('Activité')}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedCategory === 'Activité' && styles.filterButtonTextActive,
              ]}
            >
              Activité
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* Vue sous-filtres : retour catégorie + types (les filtres catégorie disparaissent) */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeContainer}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBackToCategories}
          >
            <Ionicons name="chevron-back" size={18} color={darkColor} />
            <Text style={styles.backButtonText}>{selectedCategory}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              selectedType === null && styles.typeButtonActive,
            ]}
            onPress={() => onTypeChange(null)}
          >
            <Text
              style={[
                styles.typeButtonText,
                selectedType === null && styles.typeButtonTextActive,
              ]}
            >
              Tous
            </Text>
          </TouchableOpacity>
          {allTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                selectedType === type && styles.typeButtonActive,
              ]}
              onPress={() => onTypeChange(type)}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  selectedType === type && styles.typeButtonTextActive,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryContainer: {
    gap: 8,
    paddingRight: 16,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F3F3',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  typeContainer: {
    gap: 8,
    paddingRight: 16,
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 4,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: darkColor,
    marginLeft: 2,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  typeButtonActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
});

