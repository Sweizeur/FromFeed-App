import React, { useEffect } from 'react';
import { View, StyleSheet, Text, useColorScheme, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/theme';
import type { LinkLoadStatus } from '@/contexts/AddingPlaceContext';

const HEADER_CONTENT_HEIGHT = 60;

interface LinkLoadBannerProps {
  status: LinkLoadStatus;
  onSuccessDismiss?: () => void;
}

export default function LinkLoadBanner({ status, onSuccessDismiss }: LinkLoadBannerProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const top = insets.top + 8 + HEADER_CONTENT_HEIGHT + 8;
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (status === 'idle') {
      opacity.value = withTiming(0, { duration: 200 });
    } else {
      opacity.value = withTiming(1, { duration: 250 });
    }
  }, [status, opacity]);

  useEffect(() => {
    if (status === 'success' && onSuccessDismiss) {
      const t = setTimeout(onSuccessDismiss, 2200);
      return () => clearTimeout(t);
    }
  }, [status, onSuccessDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (status === 'idle') return null;

  const isSuccess = status === 'success';
  const pillBg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(250,248,242,0.95)';
  const pillBorder = isDark ? 'rgba(255,255,255,0.12)' : theme.border;

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          top,
          borderColor: pillBorder,
          shadowOpacity: isDark ? 0.2 : 0.12,
        },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={isDark ? 70 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blur,
          {
            backgroundColor: pillBg,
            borderColor: pillBorder,
          },
        ]}
      >
        <View style={styles.row}>
          {isSuccess ? (
            <>
              <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(52,199,89,0.25)' : 'rgba(52,199,89,0.2)' }]}>
                <Ionicons name="checkmark-circle" size={22} color="#34C759" />
              </View>
              <Text style={[styles.text, { color: theme.text }]}>Lieu ajouté !</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color={theme.tint} style={styles.spinner} />
              <Text style={[styles.text, { color: theme.text }]}>Analyse du lien en cours...</Text>
            </>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  blur: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 4,
  },
});
