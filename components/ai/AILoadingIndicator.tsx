import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
const surfaceColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#2C2E30' : '#F5F5F5');
const mutedColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#9BA1A6' : '#666');

interface AILoadingIndicatorProps {
  colorScheme?: 'light' | 'dark';
}

export default function AILoadingIndicator({ colorScheme = 'light' }: AILoadingIndicatorProps) {
  const surface = surfaceColor(colorScheme);
  const muted = mutedColor(colorScheme);

  return (
    <View style={styles.aiMessageContainer}>
      <View style={[styles.aiMessageBubbleLoading, { backgroundColor: surface }]}>
        <ActivityIndicator size="small" color={muted} />
        <Text style={[styles.aiMessageText, { color: muted }]}>Réflexion en cours...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aiMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  aiMessageBubbleLoading: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiMessageText: {
    fontSize: 15,
    lineHeight: 20,
  },
});

