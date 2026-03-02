import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  useColorScheme,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Place } from '@/types/api';
import { updatePlaceRating } from '@/lib/api';
import PersonalRatingStars from './PersonalRatingStars';
import PlaceInfoSection from './PlaceInfoSection';
import { Colors, darkColor } from '@/constants/theme';

interface PlaceDetailsProps {
  place: Place;
  onBack: () => void;
  scrollViewRef?: React.RefObject<ScrollView>;
  onRatingUpdated?: () => void | Promise<void>;
}

export default function PlaceDetails({ place, onBack, scrollViewRef, onRatingUpdated }: PlaceDetailsProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const internalScrollViewRef = useRef<ScrollView>(null);
  const scrollRef = scrollViewRef || internalScrollViewRef;
  const displayName = place.placeName || place.rawTitle || 'Lieu sans nom';
  const displayAddress = place.googleFormattedAddress || place.address || place.city || 'Adresse non disponible';
  const rating = place.googleRating;
  const userRatingsTotal = place.googleUserRatingsTotal;
  const openNow = place.googleOpenNow;
  const openingHoursText = place.googleOpeningHours;
  const [userRating, setUserRating] = useState<number | null>(place.userRating ?? null);
  const [isRatingUpdating, setIsRatingUpdating] = useState(false);

  // Formater les horaires (chaque ligne = "Monday: 9:00 AM – 5:00 PM") avec jours en français
  const dayNamesFr: Record<string, string> = {
    Monday: 'Lundi', Tuesday: 'Mardi', Wednesday: 'Mercredi', Thursday: 'Jeudi',
    Friday: 'Vendredi', Saturday: 'Samedi', Sunday: 'Dimanche',
  };
  const openingHoursLines = openingHoursText
    ? openingHoursText
        .split('\n')
        .map((line) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex < 0) return line;
          const dayEn = line.slice(0, colonIndex).trim();
          const rest = line.slice(colonIndex + 1).trim();
          const dayFr = dayNamesFr[dayEn] || dayEn;
          return `${dayFr}: ${rest}`;
        })
    : [];

  // Mettre à jour la note quand le lieu change
  useEffect(() => {
    setUserRating(place.userRating ?? null);
  }, [place.id, place.userRating]);

  const handleOpenWebsite = () => {
    // Privilégier l'URL Google si elle existe
    const websiteUrl = place.googleWebsite || place.websiteUrl;
    
    // Sécurité : Valider que l'URL est valide avant de l'ouvrir
    const validateUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        // Vérifier que c'est bien http ou https (pas javascript:, data:, etc.)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };
    
    if (websiteUrl && validateUrl(websiteUrl)) {
      Linking.openURL(websiteUrl);
    } else if (place.canonicalUrl && validateUrl(place.canonicalUrl)) {
      Linking.openURL(place.canonicalUrl);
    } else {
      __DEV__ && console.warn('[SECURITY] Tentative d\'ouverture d\'URL invalide:', websiteUrl || place.canonicalUrl);
    }
  };

  const handleOpenMap = () => {
    if (place.lat && place.lon) {
      let url: string;
      
      if (Platform.OS === 'ios') {
        // Apple Maps sur iOS
        url = `http://maps.apple.com/?ll=${place.lat},${place.lon}&q=${encodeURIComponent(displayName)}`;
      } else {
        // Google Maps sur Android
        url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
      }
      
      Linking.openURL(url);
    }
  };

  const handleCall = () => {
    if (place.googlePhone) {
      // Nettoyer le numéro de téléphone (enlever espaces, tirets, parenthèses)
      const cleanPhone = place.googlePhone.replace(/[\s\-\(\)]/g, '');
      Linking.openURL(`tel:${cleanPhone}`);
    }
  };

  const handleRatingPress = async (ratingValue: number) => {
    if (isRatingUpdating) return;
    
    // Si on clique sur la même note, on la supprime
    const newRating = userRating === ratingValue ? null : ratingValue;
    
    // Sauvegarder l'ancienne valeur pour pouvoir la restaurer en cas d'erreur
    const previousRating = userRating;
    
    // Mise à jour optimiste : afficher immédiatement la nouvelle note
    setUserRating(newRating);
    setIsRatingUpdating(true);
    
    try {
      await updatePlaceRating(place.id, newRating);
      // Rafraîchir la liste des lieux après la mise à jour réussie
      if (onRatingUpdated) {
        await onRatingUpdated();
      }
    } catch (error) {
      __DEV__ && console.error('Erreur lors de la mise à jour de la note:', error);
      // Restaurer l'ancienne valeur en cas d'erreur
      setUserRating(previousRating);
    } finally {
      setIsRatingUpdating(false);
    }
  };


  return (
    <ScrollView 
      ref={scrollRef}
      style={[styles.container, { backgroundColor: theme.background }]} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
      scrollEnabled={true}
      bounces={true}
    >
      {/* Header avec bouton retour */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Détails du lieu</Text>
        <View style={styles.backButton} />
      </View>

      {/* Image principale */}
      {place.googlePhotoUrl ? (
        <Image
          source={{ uri: place.googlePhotoUrl }}
          style={[styles.mainImage, { backgroundColor: theme.surface }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: theme.surface }]}>
          <Ionicons name="location" size={48} color={theme.icon} />
        </View>
      )}

      {/* Contenu */}
      <View style={styles.content}>
        {/* Nom et note */}
        <View style={styles.titleSection}>
          <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
          {/* Sous-catégorie (type) */}
          {place.type && (
            <View style={styles.typeContainer}>
              <Text style={[styles.typeText, { backgroundColor: theme.background, color: theme.text }]}>{place.type}</Text>
            </View>
          )}
          {rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <Text style={[styles.rating, { color: theme.text }]}>{rating.toFixed(1)}</Text>
              {userRatingsTotal != null && (
                <Text style={[styles.ratingCount, { color: theme.icon }]}>({userRatingsTotal})</Text>
              )}
            </View>
          )}
          {/* Ouvert / Fermé maintenant */}
          {openNow !== undefined && openNow !== null && (
            <View style={[styles.openNowBadge, openNow ? styles.openNowBadgeOpen : styles.openNowBadgeClosed]}>
              <Ionicons
                name={openNow ? 'time-outline' : 'close-circle-outline'}
                size={16}
                color={openNow ? '#0D7D4D' : '#8E8E93'}
              />
              <Text style={[styles.openNowText, openNow ? styles.openNowTextOpen : styles.openNowTextClosed]}>
                {openNow ? 'Ouvert maintenant' : 'Fermé'}
              </Text>
            </View>
          )}
        </View>

        {/* Note personnelle */}
        <View style={[styles.personalRatingSection, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          <Text style={[styles.personalRatingLabel, { color: theme.icon }]}>Ma note</Text>
          <PersonalRatingStars
            rating={userRating}
            onRatingPress={handleRatingPress}
            isUpdating={isRatingUpdating}
          />
        </View>

        {/* Horaires d'ouverture */}
        {openingHoursLines.length > 0 && (
          <PlaceInfoSection
            icon="time-outline"
            title="Horaires"
          >
            {openingHoursLines.map((line, index) => (
              <Text key={index} style={styles.openingHoursLine}>
                {line}
              </Text>
            ))}
          </PlaceInfoSection>
        )}

        {/* Adresse */}
        <PlaceInfoSection
          icon="location-outline"
          title="Adresse"
          actionLabel={place.lat && place.lon ? (Platform.OS === 'ios' ? 'Ouvrir dans Plans' : 'Ouvrir dans Maps') : undefined}
          actionIcon="map-outline"
          onActionPress={place.lat && place.lon ? handleOpenMap : undefined}
        >
          <Text style={[styles.address, { color: theme.icon }]}>{displayAddress}</Text>
        </PlaceInfoSection>

        {/* Téléphone */}
        {place.googlePhone && (
          <PlaceInfoSection
            icon="call-outline"
            title="Téléphone"
            actionLabel={place.googlePhone}
            onActionPress={handleCall}
          >
            <View />
          </PlaceInfoSection>
        )}

        {/* Site web */}
        {(place.googleWebsite || place.websiteUrl) && (
          <PlaceInfoSection
            icon="globe-outline"
            title="Site web"
          >
            <TouchableOpacity onPress={handleOpenWebsite} activeOpacity={0.7}>
              <Text style={styles.websiteUrl} numberOfLines={1}>
                {place.googleWebsite || place.websiteUrl}
              </Text>
            </TouchableOpacity>
          </PlaceInfoSection>
        )}

        {/* Notes */}
        {place.notes && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={theme.icon} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes</Text>
            </View>
            <Text style={[styles.notes, { color: theme.icon }]}>{place.notes}</Text>
          </View>
        )}

        {/* Informations supplémentaires */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={theme.icon} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Informations</Text>
          </View>
          
          {place.city && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Ville:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{place.city}</Text>
            </View>
          )}
          
          {place.country && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Pays:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{place.country}</Text>
            </View>
          )}

          {place.postcode && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.icon }]}>Code postal:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{place.postcode}</Text>
            </View>
          )}

        </View>

        {/* Vidéos associées */}
        {place.videos && place.videos.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Vidéos ({place.videos.length})</Text>
            {place.videos.map((video, index) => {
              const handleOpenVideo = () => {
                const validateUrl = (url: string): boolean => {
                  try {
                    const parsed = new URL(url);
                    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                  } catch {
                    return false;
                  }
                };
                
                if (video.canonicalUrl && validateUrl(video.canonicalUrl)) {
                  Linking.openURL(video.canonicalUrl);
                } else {
                  __DEV__ && console.warn('[SECURITY] Tentative d\'ouverture d\'URL invalide:', video.canonicalUrl);
                }
              };

              return (
                <TouchableOpacity
                  key={video.id}
                  onPress={handleOpenVideo}
                  style={[styles.videoItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.badge, video.provider === 'tiktok' ? styles.badgeTikTok : styles.badgeInstagram]}>
                    <Ionicons
                      name={video.provider === 'tiktok' ? 'musical-notes' : 'logo-instagram'}
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.badgeText}>
                      {video.provider === 'tiktok' ? 'TikTok' : 'Instagram'}
                    </Text>
                  </View>
                  {video.rawTitle && (
                    <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={2}>
                      {video.rawTitle}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={theme.border} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Liens */}
        {place.websiteUrl && (
          <View style={styles.section}>
            <TouchableOpacity onPress={handleOpenWebsite} style={[styles.linkButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="globe-outline" size={20} color="#007AFF" />
              <Text style={styles.linkButtonText}>Visiter le site web</Text>
              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
  },
  mainImage: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  titleSection: {
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  typeContainer: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 12,
  },
  openNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  openNowBadgeOpen: {
    backgroundColor: '#E8F5E9',
  },
  openNowBadgeClosed: {
    backgroundColor: '#F2F2F7',
  },
  openNowText: {
    fontSize: 14,
    fontWeight: '600',
  },
  openNowTextOpen: {
    color: '#0D7D4D',
  },
  openNowTextClosed: {
    color: '#8E8E93',
  },
  openingHoursLine: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 4,
  },
  personalRatingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  personalRatingLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  personalRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  websiteUrl: {
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
    marginBottom: 12,
    textDecorationLine: 'underline',
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 100,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTikTok: {
    backgroundColor: darkColor,
  },
  badgeInstagram: {
    backgroundColor: '#E4405F',
  },
  videoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
  },
  videoTitle: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});

