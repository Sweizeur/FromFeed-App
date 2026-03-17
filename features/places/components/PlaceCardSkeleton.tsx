import React, { useEffect } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Colors, darkColor } from '@/constants/theme';

/**
 * Composant Skeleton pour afficher un placeholder pendant le chargement d'un lieu
 */
export default function PlaceCardSkeleton() {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 1], [0.3, 0.7]);
    return {
      opacity,
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, shadowColor: isDark ? '#000' : darkColor }]}>
      {/* Image skeleton */}
      <Animated.View style={[styles.imageSkeleton, { backgroundColor: theme.border }, shimmerStyle]} />

      {/* Contenu skeleton */}
      <View style={styles.content}>
        <View style={styles.header}>
          {/* Nom skeleton */}
          <Animated.View style={[styles.nameSkeleton, { backgroundColor: theme.border }, shimmerStyle]} />
          {/* Rating skeleton */}
          <Animated.View style={[styles.ratingSkeleton, { backgroundColor: theme.border }, shimmerStyle]} />
        </View>

        {/* Adresse skeleton */}
        <Animated.View style={[styles.addressSkeleton, { backgroundColor: theme.border }, shimmerStyle]} />

        {/* Providers skeleton */}
        <View style={styles.providersContainer}>
          <Animated.View style={[styles.providerSkeleton, { backgroundColor: theme.border }, shimmerStyle]} />
          <Animated.View style={[styles.providerSkeleton, { backgroundColor: theme.border }, shimmerStyle]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    overflow: 'hidden',
    minHeight: 120,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imageSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameSkeleton: {
    width: '60%',
    height: 18,
    borderRadius: 4,
  },
  ratingSkeleton: {
    width: 40,
    height: 16,
    borderRadius: 4,
  },
  addressSkeleton: {
    width: '80%',
    height: 14,
    borderRadius: 4,
    marginBottom: 8,
  },
  providersContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  providerSkeleton: {
    width: 50,
    height: 20,
    borderRadius: 10,
  },
});
