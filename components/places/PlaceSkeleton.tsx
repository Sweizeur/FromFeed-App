import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { darkColor } from '@/constants/theme';

interface PlaceSkeletonProps {
  url?: string; // URL du lien en cours de traitement (optionnel, pour affichage)
}

const PlaceSkeleton = React.memo(function PlaceSkeleton({ url }: PlaceSkeletonProps) {
  const shimmerOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Animation de shimmer (effet de brillance)
    shimmerOpacity.value = withRepeat(
      withTiming(0.7, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Image placeholder avec animation */}
      <Animated.View style={[styles.imagePlaceholder, shimmerStyle]}>
        <View style={styles.imageSkeleton} />
      </Animated.View>

      {/* Contenu */}
      <View style={styles.content}>
        {/* Nom avec animation */}
        <View style={styles.header}>
          <Animated.View style={[styles.nameSkeleton, shimmerStyle]} />
          <Animated.View style={[styles.ratingSkeleton, shimmerStyle]} />
        </View>

        {/* Adresse avec animation */}
        <Animated.View style={[styles.addressSkeleton, shimmerStyle]} />

        {/* Badge avec animation */}
        <Animated.View style={[styles.badgeSkeleton, shimmerStyle]} />

        {/* URL en cours de traitement (si fournie) */}
        {url && (
          <View style={styles.urlContainer}>
            <Animated.View style={[styles.urlSkeleton, shimmerStyle]} />
          </View>
        )}
      </View>

      {/* Icône droite */}
      <View style={styles.rightIconContainer}>
        <Animated.View style={[styles.chevronSkeleton, shimmerStyle]} />
      </View>
    </View>
  );
});

export default PlaceSkeleton;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  imageSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
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
    marginBottom: 8,
  },
  nameSkeleton: {
    width: '60%',
    height: 18,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  ratingSkeleton: {
    width: 40,
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  addressSkeleton: {
    width: '80%',
    height: 14,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeSkeleton: {
    width: 60,
    height: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    marginTop: 4,
  },
  urlContainer: {
    marginTop: 8,
  },
  urlSkeleton: {
    width: '90%',
    height: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
  },
  rightIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  chevronSkeleton: {
    width: 20,
    height: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
  },
});
