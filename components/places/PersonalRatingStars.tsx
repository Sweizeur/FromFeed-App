import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkColor } from '@/constants/theme';

interface PersonalRatingStarsProps {
  rating: number | null;
  onRatingPress: (rating: number) => void;
  isUpdating?: boolean;
}

export default function PersonalRatingStars({ rating, onRatingPress, isUpdating = false }: PersonalRatingStarsProps) {
  const stars = [];
  const maxStars = 5;

  for (let i = 1; i <= maxStars; i++) {
    const isFilled = rating !== null && i <= rating;

    stars.push(
      <TouchableOpacity
        key={i}
        onPress={() => onRatingPress(i)}
        disabled={isUpdating}
        style={styles.starButton}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Ionicons name={isFilled ? 'star' : 'star-outline'} size={18} color={isFilled ? darkColor : '#CCC'} />
      </TouchableOpacity>
    );
  }

  return <View style={styles.container}>{stars}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starButton: {
    padding: 2,
  },
});

