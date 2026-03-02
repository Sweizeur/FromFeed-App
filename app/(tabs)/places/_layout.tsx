import React, { useState, useCallback, createContext, useContext, useMemo } from 'react';
import { useColorScheme, TouchableOpacity, Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

type SearchContextValue = {
  searchText: string;
  setSearchText: (text: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearchText() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchText must be used inside places layout');
  return ctx;
}

export default function PlacesLayout() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const handleChangeText = useCallback(
    (e: { nativeEvent: { text: string } }) => {
      setSearchText(e.nativeEvent.text);
    },
    []
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
            style={{  }}
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
    <SearchContext.Provider value={{ searchText, setSearchText }}>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" />
      </Stack>
    </SearchContext.Provider>
  );
}
