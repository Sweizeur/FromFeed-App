import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { PlaceSummary } from '@/types/api';

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

  return (
    <View style={styles.container}>
      {/* Filtres par catégorie */}
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

      {/* Filtres par type */}
      {selectedCategory && allTypes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeContainer}
        >
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryContainer: {
    gap: 8,
    paddingRight: 16,
  },
  filterButton: {
    paddingHorizontal: 20,
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
    marginTop: 12,
    gap: 8,
    paddingRight: 16,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  typeButtonActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
});

