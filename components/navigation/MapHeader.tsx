import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, LayoutChangeEvent, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlaceFilters from '../places/PlaceFilters';
import { PlaceSummary } from '@/types/api';
import { darkColor } from '@/constants/theme';
import AnimatedAIButton from '../common/AnimatedAIButton';

interface MapHeaderProps {
  onLayout?: (event: LayoutChangeEvent) => void;
  onAddLinkPress: () => void;
  onAIPress?: () => void;
  places?: PlaceSummary[];
  selectedCategory?: string | null;
  selectedType?: string | null;
  onCategoryChange?: (category: string | null) => void;
  onTypeChange?: (type: string | null) => void;
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  hideAIButton?: boolean;
  hideNotificationButton?: boolean;
  /** Sur l'onglet feed : afficher uniquement les filtres (pas de searchbar, pas de boutons IA/add/notifications) */
  onlyFilters?: boolean;
}

export default function MapHeader({ 
  onLayout, 
  onAddLinkPress,
  onAIPress,
  places = [],
  selectedCategory = null,
  selectedType = null,
  onCategoryChange,
  onTypeChange,
  title,
  showBackButton = false,
  onBackPress,
  hideAIButton = false,
  hideNotificationButton = false,
  onlyFilters = false,
}: MapHeaderProps) {
  const insets = useSafeAreaInsets();
  
  // Vérifier s'il y a des places avec des catégories pour afficher les filtres (ou toujours sur feed)
  const hasCategories = places.length > 0 && places.some(place => place.category === 'Restauration' || place.category === 'Activité');
  const shouldShowFilters = (onlyFilters || (hasCategories && onCategoryChange && onTypeChange)) && onCategoryChange && onTypeChange;
  
  return (
    <View style={[styles.headerContainer, (showBackButton || onlyFilters) && { paddingTop: insets.top }]} onLayout={onLayout}>
      {!onlyFilters && (
        <View style={styles.header}>
          {/* Titre et bouton retour si nécessaire */}
          {showBackButton && (
            <View style={styles.titleBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={onBackPress}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={darkColor} />
              </TouchableOpacity>
              {title && (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              )}
            </View>
          )}
          <View style={styles.searchBar}>
            {/* Zone input recherche */}
            <View style={styles.searchInputWrapper}>
              <Ionicons
                name="search"
                size={20}
                color="#A0A0A0"
                style={styles.searchIcon}
              />
              <TextInput
                placeholder="Search here..."
                placeholderTextColor="#B0B0B0"
                style={styles.searchInput}
                onBlur={() => Keyboard.dismiss()}
              />
            </View>

            {/* Boutons à droite */}
            <View style={styles.searchActions}>
              {!hideNotificationButton && (
                <TouchableOpacity activeOpacity={0.7} style={styles.circleButtonLight}>
                  <Ionicons name="notifications-outline" size={18} color={darkColor} />
                </TouchableOpacity>
              )}
              {onAIPress && !hideAIButton && (
                <AnimatedAIButton onPress={onAIPress} size={38} />
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.circleButtonPrimary}
                onPress={onAddLinkPress}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {shouldShowFilters && (
        <View style={[styles.subHeader, onlyFilters && styles.subHeaderOnlyFilters]}>
          <PlaceFilters
            places={places}
            selectedCategory={selectedCategory}
            selectedType={selectedType}
            onCategoryChange={onCategoryChange}
            onTypeChange={onTypeChange}
          />
        </View>
      )}
    </View>
  );
}

// Composant séparé pour la popup upgrade (superposée sur la map)
export function UpgradePopup() {
  return (
    <View style={upgradePopupStyles.container}>
      <View style={upgradePopupStyles.content}>
        <Text style={upgradePopupStyles.text}>
          1/5 saves used on the FromFeed free plan {'\n'}
          <Text style={{ fontWeight: 'bold' }}>Upgrade</Text> now for unlimited saves
        </Text>
        <TouchableOpacity style={upgradePopupStyles.button} onPress={() => {}}>
          <Text style={upgradePopupStyles.buttonText}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    // Container pour mesurer la hauteur totale
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: darkColor,
    flex: 1,
  },
  header: {
    height: 120,
    backgroundColor: '#fff',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  subHeader: {
    height: 52,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  subHeaderOnlyFilters: {
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: darkColor,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#555',
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 10,
  },
  circleButtonLight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F3F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonPrimary: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Styles pour la popup upgrade (superposée sur la map)
const upgradePopupStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8, // Juste sous le header vert (le mapContainer commence après le header)
    left: 16,
    right: 16,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    zIndex: 1, // Au-dessus de la map (zIndex: 0) mais en dessous de la card coulissante (zIndex: 2+)
    shadowColor: darkColor,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3, // Moins élevé que la card coulissante
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
  },
  button: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: darkColor,
    fontSize: 14,
    fontWeight: '600',
  },
});

