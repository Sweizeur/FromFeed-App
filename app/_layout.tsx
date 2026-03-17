import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { AddingPlaceProvider } from '@/features/places/context/AddingPlaceContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    const c = Colors[isDark ? 'dark' : 'light'];
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.tint,
        background: c.background,
        card: c.surface,
        text: c.text,
        border: c.border,
        notification: c.tint,
      },
    };
  }, [isDark]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <AuthProvider>
          <AddingPlaceProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="collections" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </AddingPlaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
