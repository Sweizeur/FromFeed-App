import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Place, PlaceSummary } from '@/types/api';
import PlacesList from './PlacesList';
import PlaceDetails from './PlaceDetails';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlaceTransitionProps {
  selectedPlace: Place | null;
  placesSummary: PlaceSummary[];
  placesListKey: string | number;
  onPlacePress: (place: Place | PlaceSummary) => void;
  onBack: () => void;
  scrollViewRef?: React.RefObject<any>;
  onRefreshPlaces?: (skipCache?: boolean) => Promise<void>;
  refreshingPlaces?: boolean;
  onRatingUpdated?: () => void | Promise<void>;
  onDeletePlaces?: (placeIds: string[]) => Promise<void>;
  onAddToCollection?: (placeId: string) => void;
  isAddingPlace?: boolean;
}

export default function PlaceTransition({
  selectedPlace,
  placesSummary,
  placesListKey,
  onPlacePress,
  onBack,
  scrollViewRef,
  onRefreshPlaces,
  refreshingPlaces = false,
  onRatingUpdated,
  onDeletePlaces,
  onAddToCollection,
  isAddingPlace = false,
}: PlaceTransitionProps) {
  // Position X pour l'animation de swipe
  const listTranslateX = useSharedValue(0);
  const detailsTranslateX = useSharedValue(SCREEN_WIDTH);
  const listOpacity = useSharedValue(1);
  const detailsOpacity = useSharedValue(0);

  // Garder une référence au dernier selectedPlace pour l'animation de sortie
  const previousPlaceRef = useRef<Place | null>(null);
  const [displayPlace, setDisplayPlace] = React.useState<Place | null>(null);

  useEffect(() => {
    if (selectedPlace) {
      // Nouveau lieu sélectionné : animation d'entrée
      setDisplayPlace(selectedPlace);
      previousPlaceRef.current = selectedPlace;
      
      // Animation d'entrée : PlacesList sort à gauche, PlaceDetails entre depuis la droite
      listTranslateX.value = withTiming(-SCREEN_WIDTH, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      listOpacity.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      
      detailsTranslateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      detailsOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    } else if (previousPlaceRef.current) {
      // Animation de sortie : PlaceDetails sort à droite, PlacesList entre depuis la gauche
      detailsTranslateX.value = withTiming(SCREEN_WIDTH, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      detailsOpacity.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      
      listTranslateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      listOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      
      // Nettoyer displayPlace après l'animation
      setTimeout(() => {
        setDisplayPlace(null);
        previousPlaceRef.current = null;
      }, 300);
    }
  }, [selectedPlace]);

  const listAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: listTranslateX.value }],
      opacity: listOpacity.value,
    };
  });

  const detailsAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: detailsTranslateX.value }],
      opacity: detailsOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      {/* PlacesList - toujours rendu mais animé */}
      <Animated.View style={[styles.content, listAnimatedStyle]}>
        <PlacesList
          key={placesListKey}
          placesSummary={placesSummary}
          onPlacePress={onPlacePress}
          onRefresh={onRefreshPlaces}
          refreshing={refreshingPlaces}
          onDeletePlaces={onDeletePlaces}
          onAddToCollection={onAddToCollection}
          isAddingPlace={isAddingPlace}
        />
      </Animated.View>

      {/* PlaceDetails - rendu si displayPlace existe (pour permettre l'animation de sortie) */}
      {displayPlace && (
        <Animated.View style={[styles.content, detailsAnimatedStyle]}>
          <PlaceDetails
            place={displayPlace}
            onBack={onBack}
            scrollViewRef={scrollViewRef}
            onRatingUpdated={onRatingUpdated}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
  },
});

