import React, { useCallback, useMemo } from 'react';
import { useColorScheme, TouchableOpacity, Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { SearchContextProvider, useSearchText } from '@/features/places/context/SearchContext';

function PlacesLayoutInner() {
  const router = useRouter();
  const { setSearchText } = useSearchText();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const handleChangeText = useCallback(
    (e: { nativeEvent: { text: string } }) => {
      setSearchText(e.nativeEvent.text);
    },
    [setSearchText]
  );

  const handleBack = useCallback(() => {
    router.navigate('/(tabs)/map');
  }, [router]);

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      title: 'Mes Lieux',
      headerLargeTitle: false,
      headerLargeTitleStyle: { color: theme.text },
      headerTintColor: theme.text,
      headerStyle: { backgroundColor: theme.background },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: theme.background },
      headerLeft: () => (
        <View
          style={{
            height: 44,
            marginLeft: Platform.OS === 'ios' ? 4 : 8,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.text}
              style={{ marginLeft: 3, marginRight: 3, marginBottom: 9 }}
            />
          </TouchableOpacity>
        </View>
      ),
      headerSearchBarOptions: {
        placeholder: 'Vidéo, lieu, adresse...',
        barTintColor: theme.background,
        tintColor: theme.text,
        onChangeText: handleChangeText,
      },
    }),
    [theme, handleChangeText, handleBack]
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function PlacesLayout() {
  return (
    <SearchContextProvider>
      <PlacesLayoutInner />
    </SearchContextProvider>
  );
}
