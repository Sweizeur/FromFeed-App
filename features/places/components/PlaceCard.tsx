import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Place, PlaceSummary } from '@/features/places/types';
import { Colors, darkColor } from '@/constants/theme';

interface PlaceCardProps {
  place: Place | PlaceSummary;
  onPress?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onAddToCollection?: () => void;
  isInCollection?: boolean;
}

const PlaceCard = React.memo(function PlaceCard({
  place,
  onPress,
  isSelectionMode = false,
  isSelected = false,
  onAddToCollection,
  isInCollection = false,
}: PlaceCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const themed = useMemo(
    () =>
      isDark
        ? {
            container: { backgroundColor: '#252628', shadowColor: '#000' },
            imagePlaceholder: { backgroundColor: '#1C1D1E' },
            name: { color: theme.text },
            address: { color: theme.icon },
            categoryText: { color: theme.text, backgroundColor: '#3C3E40' },
            notes: { color: theme.icon },
            personalRating: { color: theme.text },
            rating: { color: theme.text },
            addToCollectionButtonTop: { backgroundColor: '#3C3E40' },
            addToCollectionButtonText: { color: theme.text },
            containerSelected: { backgroundColor: '#2C2E30', borderColor: theme.tint, shadowColor: '#000' },
            checkbox: { borderColor: '#555', backgroundColor: '#252628' },
            checkboxSelected: { backgroundColor: theme.tint, borderColor: theme.tint },
          }
        : {
            container: { backgroundColor: theme.surface, shadowColor: darkColor },
            imagePlaceholder: { backgroundColor: theme.background },
            name: { color: theme.text },
            address: { color: theme.icon },
            categoryText: { color: theme.text, backgroundColor: theme.background },
            notes: { color: theme.icon },
            personalRating: { color: theme.text },
            rating: { color: theme.text },
            addToCollectionButtonTop: { backgroundColor: theme.background },
            addToCollectionButtonText: { color: theme.text },
            containerSelected: { backgroundColor: theme.surface, borderColor: theme.text, shadowColor: darkColor },
            checkbox: { borderColor: theme.border, backgroundColor: theme.surface },
            checkboxSelected: { backgroundColor: theme.text, borderColor: theme.text },
          },
    [isDark, theme]
  );

  const iconColor = isDark ? theme.icon : theme.icon;
  const starColor = isDark ? theme.text : theme.text;
  const chevronColor = isDark ? theme.icon : theme.border;

  const displayName = place.placeName || place.rawTitle || 'Lieu sans nom';
  const displayAddress = place.googleFormattedAddress || place.address || place.city || 'Adresse non disponible';
  const rating = place.googleRating;
  const providersRaw: string[] = ('providers' in place && Array.isArray(place.providers))
    ? place.providers
    : (place.provider ? [place.provider] : []);
  const providers = Array.from(new Set(providersRaw)).sort((a: string, b: string) => {
    if (a === 'tiktok' && b !== 'tiktok') return -1;
    if (b === 'tiktok' && a !== 'tiktok') return 1;
    return a.localeCompare(b);
  });

  return (
    <TouchableOpacity
      style={[
        styles.container,
        themed.container,
        isSelectionMode && styles.containerSelectionMode,
        isSelectionMode && isSelected && (isDark ? themed.containerSelected : styles.containerSelected),
      ]}
      onPress={onPress}
      activeOpacity={isSelectionMode ? 0.6 : 0.7}
    >
      {/* Image ou placeholder */}
      {place.googlePhotoUrl ? (
        <Image
          source={{ uri: place.googlePhotoUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, themed.imagePlaceholder]}>
          <Ionicons name="location" size={24} color={iconColor} />
        </View>
      )}

      {/* Contenu */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, themed.name]} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.ratingsContainer}>
            {place.userRating && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color={starColor} />
                <Text style={[styles.personalRating, themed.personalRating]}>{place.userRating}</Text>
              </View>
            )}
            {rating && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={[styles.rating, themed.rating]}>{rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.addressContainer}>
          <Ionicons name="location-outline" size={14} color={iconColor} />
          <Text style={[styles.address, themed.address]} numberOfLines={1}>
            {displayAddress}
          </Text>
        </View>

        {place.type && (
          <View style={styles.categoryContainer}>
            <Text style={[styles.categoryText, themed.categoryText]}>{place.type}</Text>
          </View>
        )}

        {place.notes && (
          <Text style={[styles.notes, themed.notes]} numberOfLines={2}>
            {place.notes}
          </Text>
        )}

        {/* Bouton ajouter/modifier collection */}
        {onAddToCollection && !isSelectionMode && (
          <TouchableOpacity
            style={[styles.addToCollectionButtonTop, themed.addToCollectionButtonTop]}
            onPress={(e) => {
              e.stopPropagation();
              onAddToCollection();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name={isInCollection ? "bookmark" : "bookmark-outline"} size={16} color={theme.text} />
            <Text style={[styles.addToCollectionButtonText, themed.addToCollectionButtonText]}>
              {isInCollection ? "Modifier" : "Ajouter à une collection"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Badges sources (toutes les vidéos) */}
        {providers.length > 0 && (
          <View style={styles.badgeContainer}>
            {providers.map((provider: string) => (
              <View
                key={provider}
                style={[styles.badge, provider === 'tiktok' ? styles.badgeTikTok : styles.badgeInstagram]}
              >
                <Ionicons
                  name={provider === 'tiktok' ? 'musical-notes' : 'logo-instagram'}
                  size={12}
                  color="#fff"
                />
                <Text style={styles.badgeText}>
                  {provider === 'tiktok' ? 'TikTok' : 'Instagram'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Actions - conteneur fixe pour éviter le décalage */}
      <View style={styles.rightIconContainer}>
        {isSelectionMode ? (
          <View
            style={[
              styles.checkbox,
              themed.checkbox,
              isSelected && (isDark ? themed.checkboxSelected : styles.checkboxSelected),
            ]}
          >
            {isSelected && (
              <View style={styles.checkboxInner}>
                <Ionicons name="checkmark" size={10} color={isDark ? theme.background : '#fff'} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.actionsContainer}>
            <Ionicons name="chevron-forward" size={20} color={chevronColor} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Comparaison personnalisée pour éviter les re-renders inutiles
  return (
    prevProps.place.id === nextProps.place.id &&
    prevProps.place.placeName === nextProps.place.placeName &&
    prevProps.place.googlePhotoUrl === nextProps.place.googlePhotoUrl &&
    prevProps.place.googleRating === nextProps.place.googleRating &&
    prevProps.place.userRating === nextProps.place.userRating &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isInCollection === nextProps.isInCollection
  );
});

export default PlaceCard;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  ratingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  personalRating: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  address: {
    flex: 1,
    fontSize: 13,
  },
  categoryContainer: {
    marginTop: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  notes: {
    fontSize: 12,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTikTok: {
    backgroundColor: darkColor,
  },
  badgeInstagram: {
    backgroundColor: '#E4405F',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  rightIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addToCollectionButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
  },
  addToCollectionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: 8,
  },
  containerSelectionMode: {
    opacity: 0.95,
  },
  containerSelected: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: darkColor,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: darkColor,
    borderColor: darkColor,
  },
  checkboxInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

