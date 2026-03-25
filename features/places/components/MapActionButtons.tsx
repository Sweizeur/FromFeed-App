import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';

const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

interface MapActionButtonsProps {
  followUser: boolean;
  onCenterUser: () => void;
  theme: { text: string; border: string };
  bottom: number;
}

export default function MapActionButtons({
  followUser,
  onCenterUser,
  theme,
  bottom,
}: MapActionButtonsProps) {
  const followLabel = followUser
    ? 'Ne plus suivre ma position'
    : 'Centrer et suivre ma position';

  return (
    <View style={[styles.container, { bottom }]} pointerEvents="box-none">
      {useLiquidGlass ? (
        <GlassView glassEffectStyle="regular" isInteractive style={styles.glassGroup}>
          <Pressable
            onPress={() => {}}
            accessibilityRole="button"
            accessibilityLabel="Filtre (bientot disponible)"
            style={styles.groupButton}
          >
            <Ionicons name="options-outline" size={18} color={theme.text} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            onPress={onCenterUser}
            accessibilityRole="button"
            accessibilityLabel={followLabel}
            style={styles.groupButton}
          >
            <Ionicons
              name={followUser ? 'navigate' : 'navigate-outline'}
              size={18}
              color={followUser ? '#0a7ea4' : theme.text}
            />
          </Pressable>
        </GlassView>
      ) : (
        <View style={styles.fallbackGroup}>
          <Pressable
            onPress={() => {}}
            accessibilityRole="button"
            accessibilityLabel="Filtre (bientot disponible)"
            style={styles.groupButton}
          >
            <Ionicons name="options-outline" size={18} color="#fff" />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <Pressable
            onPress={onCenterUser}
            accessibilityRole="button"
            accessibilityLabel={followLabel}
            style={styles.groupButton}
          >
            <Ionicons
              name={followUser ? 'navigate' : 'navigate-outline'}
              size={18}
              color={followUser ? '#0a7ea4' : '#fff'}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    elevation: 10,
    overflow: 'visible',
  },
  glassGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 44,
    borderRadius: 22,
    padding: 2,
    margin: -2,
    overflow: 'visible',
  },
  fallbackGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#3a3b3d',
    borderColor: '#3a3b3d',
  },
  groupButton: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  divider: {
    width: 20,
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
});
