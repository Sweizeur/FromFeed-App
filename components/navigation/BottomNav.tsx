import React from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, darkColor } from '@/constants/theme';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const displayActiveTab = activeTab;

  return (
    <View
      style={[
        styles.bottomNav,
        { paddingBottom: insets.bottom, backgroundColor: theme.background, borderTopColor: theme.border },
      ]}
    >
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('search')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="search-outline"
          size={24}
          color={displayActiveTab === 'search' ? theme.text : theme.icon}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('map')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="map-outline"
          size={24}
          color={displayActiveTab === 'map' ? theme.text : theme.icon}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('collections')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="folder-outline"
          size={24}
          color={displayActiveTab === 'collections' ? theme.text : theme.icon}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('settings')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="settings-outline"
          size={24}
          color={displayActiveTab === 'settings' ? theme.text : theme.icon}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    shadowColor: darkColor,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});

