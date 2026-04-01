import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/theme';
import type { LinkLoadStatus } from '@/features/places/context/AddingPlaceContext';

const HEADER_CONTENT_HEIGHT = 60;

interface LinkLoadBannerProps {
  status: LinkLoadStatus;
  successMessage?: string | null;
  errorMessage?: string | null;
  onDismiss?: () => void;
}

export default function LinkLoadBanner({
  status,
  successMessage,
  errorMessage,
  onDismiss,
}: LinkLoadBannerProps) {
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
    if (status === 'success' && onDismiss) {
      const t = setTimeout(onDismiss, 2200);
      return () => clearTimeout(t);
    }
  }, [status, onDismiss]);

  useEffect(() => {
    if (status === 'error' && onDismiss) {
      const t = setTimeout(onDismiss, 4800);
      return () => clearTimeout(t);
    }
  }, [status, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (status === 'idle') return null;

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const pillBg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(250,248,242,0.95)';
  const pillBorder = isDark ? 'rgba(255,255,255,0.12)' : theme.border;
  const errorBorder = isDark ? 'rgba(255,69,58,0.45)' : 'rgba(255,59,48,0.35)';

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          top,
          borderColor: isError ? errorBorder : pillBorder,
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
            borderColor: isError ? errorBorder : pillBorder,
          },
        ]}
      >
        <View style={[styles.row, isError && styles.rowError]}>
          {isSuccess ? (
            <>
              <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(52,199,89,0.25)' : 'rgba(52,199,89,0.2)' }]}>
                <Ionicons name="checkmark-circle" size={22} color="#34C759" />
              </View>
              <Text style={[styles.text, { color: theme.text }]} numberOfLines={2}>{successMessage || 'Lieu ajouté !'}</Text>
            </>
          ) : isError ? (
            <>
              <View style={[styles.iconWrap, styles.iconWrapTop, { backgroundColor: isDark ? 'rgba(255,69,58,0.22)' : 'rgba(255,59,48,0.15)' }]}>
                <Ionicons name="alert-circle" size={22} color="#FF3B30" />
              </View>
              <ScrollView
                style={styles.errorScroll}
                contentContainerStyle={styles.errorScrollContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.text, styles.errorText, { color: theme.text }]}>
                  {errorMessage || "L'ajout du lieu a échoué."}
                </Text>
              </ScrollView>
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
    zIndex: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 40,
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
  rowError: {
    alignItems: 'flex-start',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  errorText: {
    marginLeft: 0,
    flex: 0,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  errorScroll: {
    flex: 1,
    flexGrow: 1,
    maxHeight: 176,
    marginLeft: 12,
  },
  errorScrollContent: {
    flexGrow: 1,
    paddingBottom: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapTop: {
    marginTop: 1,
  },
  spinner: {
    marginRight: 4,
  },
});
