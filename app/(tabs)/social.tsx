import React, { useState } from 'react';
import { View, StyleSheet, Text, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Colors } from '@/constants/theme';
import CollectionsTab from '@/components/social/CollectionsTab';
import FriendsTab from '@/components/social/FriendsTab';

const TABS = ['Collections', 'Amis'];

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: theme.text }]}>Bibliothèque</Text>

      <View style={styles.pickerContainer}>
        <SegmentedControl
          values={TABS}
          selectedIndex={selectedTab}
          onChange={(e) => setSelectedTab(e.nativeEvent.selectedSegmentIndex)}
          appearance={isDark ? 'dark' : 'light'}
          backgroundColor={theme.surface}
          tintColor={isDark ? '#4B5563' : '#D4D4D8'}
        />
      </View>

      <View style={styles.content}>
        {selectedTab === 0 ? (
          <CollectionsTab theme={theme} />
        ) : (
          <FriendsTab theme={theme} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pickerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
  },
});
