import React, { useState, Suspense, lazy } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import MapHeader from '@/components/navigation/MapHeader';
import { usePlaces } from '@/hooks/usePlaces';
import { darkColor } from '@/constants/theme';

const TikTokFeed = lazy(() => import('@/components/feed/TikTokFeed'));

class TikTokFeedErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Pour afficher les TikToks dans l'app, reconstruisez le binaire natif :
          </Text>
          <Text style={styles.errorHint}>npx expo run:ios</Text>
          <Text style={styles.errorSub}>(ou run:android)</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { placesSummary } = usePlaces();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <MapHeader
        onAddLinkPress={() => {}}
        places={placesSummary}
        selectedCategory={selectedCategory}
        selectedType={selectedType}
        onCategoryChange={setSelectedCategory}
        onTypeChange={setSelectedType}
        hideAIButton
        hideNotificationButton
        hideAddButton
        forceShowFilters
      />
      <TikTokFeedErrorBoundary>
        <Suspense
          fallback={
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={darkColor} />
              <Text style={styles.hint}>Chargement du fil...</Text>
            </View>
          }
        >
          <TikTokFeed
            selectedCategory={selectedCategory}
            selectedType={selectedType}
            tabFocused={isFocused}
          />
        </Suspense>
      </TikTokFeedErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: darkColor,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});
