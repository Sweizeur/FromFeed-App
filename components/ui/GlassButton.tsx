import React from 'react';
import { Platform, Pressable, Text, View, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';

const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export interface GlassButtonProps {
  /** Texte du bouton. Omit ou '' pour bouton icône seule */
  label?: string;
  onPress: () => void;
  /** État sélectionné / accent (style rempli) */
  active?: boolean;
  /** Icône Ionicons à gauche du label, ou seule si pas de label */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Taille de l'icône */
  iconSize?: number;
  /** Pour l'accessibilité quand le bouton est icône seule */
  accessibilityLabel?: string;
  /** Style du conteneur (ex. pour les filtres en ligne) */
  style?: ViewStyle;
  /** Couleur du texte (thème) */
  textColor?: string;
  /** Couleur quand active (thème) */
  activeTextColor?: string;
  /** Couleur d'accent quand active (tint) */
  activeTint?: string;
  /** Fond du bouton en fallback (non-glass), pour dark mode */
  backgroundColor?: string;
  /** Bordure en fallback */
  borderColor?: string;
  /** Variante plus petite (sous-filtres, types) */
  compact?: boolean;
  /** Force un fond plein (pas de glass), pour garder une couleur constante (ex. bouton localisation) */
  forceSolid?: boolean;
}

export default function GlassButton({
  label = '',
  onPress,
  active = false,
  icon,
  iconSize = 18,
  style,
  textColor = '#11181C',
  activeTextColor = '#fff',
  activeTint = '#1A1A1A',
  backgroundColor,
  borderColor,
  compact = false,
  forceSolid = false,
  accessibilityLabel: a11yLabel,
}: GlassButtonProps) {
  const iconOnly = !label && !!icon;
  const useGlassEffect = useGlass && !forceSolid;
  const paddingH = iconOnly ? 12 : compact ? 12 : 18;
  const paddingV = iconOnly ? 12 : compact ? 6 : 8;
  const borderRadius = compact || iconOnly ? 12 : 20;
  const fontSize = compact ? 12 : 14;

  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={iconSize}
          color={active ? activeTextColor : textColor}
          style={iconOnly ? undefined : styles.icon}
        />
      ) : null}
      {label ? (
        <Text
          style={[
            styles.label,
            { fontSize, color: active ? activeTextColor : textColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </>
  );

  const a11y = a11yLabel ?? (iconOnly ? undefined : label) ?? undefined;

  if (useGlassEffect) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.wrapper, style]}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={active ? activeTint : undefined}
          style={[
            styles.glass,
            {
              paddingHorizontal: paddingH,
              paddingVertical: paddingV,
              borderRadius,
            },
          ]}
        >
          {content}
        </GlassView>
      </Pressable>
    );
  }

  const fallbackBg = backgroundColor ?? (active ? activeTint : '#F3F3F3');
  const fallbackBorder = borderColor ?? (active ? activeTint : '#E0E0E0');
  const effectiveBg = forceSolid && backgroundColor !== undefined ? backgroundColor : fallbackBg;
  const effectiveBorder = forceSolid && borderColor !== undefined ? borderColor : fallbackBorder;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fallback,
        {
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius,
          backgroundColor: active ? activeTint : effectiveBg,
          borderWidth: 1,
          borderColor: active ? activeTint : effectiveBorder,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontWeight: '600',
  },
});
