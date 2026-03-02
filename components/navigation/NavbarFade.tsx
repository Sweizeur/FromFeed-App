import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Hauteur native de la barre d’onglets (iOS / Android) */
const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 52 });
/** Part de la hauteur d’écran pour le fondu (responsive) */
const FADE_EXTRA_RATIO = 0.02;

const GRADIENT_COLORS = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,1)',
  'rgba(255,255,255,1)',
  'rgba(255,255,255,1)',
] as const;

/**
 * Bande en bas d'écran : fondu transparent → blanc pour une transition fluide
 * vers la navbar. À placer en dernier dans chaque écran d'onglet (position absolute).
 */
export default function NavbarFade() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const fadeExtra = Math.round(windowHeight * FADE_EXTRA_RATIO);
  const height = TAB_BAR_HEIGHT + insets.bottom + fadeExtra;

  return (
    <View
      style={[styles.wrap, { height }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={GRADIENT_COLORS}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
});
