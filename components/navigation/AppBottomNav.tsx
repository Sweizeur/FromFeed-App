import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import BottomNav from './BottomNav';

interface AppBottomNavProps {
  activeTab: string;
}

/**
 * Bottom nav avec navigation par onglets (map, search, collections, settings).
 * À utiliser sur les pages standalone (collections, groups, group-detail, settings).
 */
export default function AppBottomNav({ activeTab }: AppBottomNavProps) {
  const router = useRouter();

  const handleTabChange = (tab: string) => {
    if (tab === 'map') router.replace('/(tabs)/map');
    else if (tab === 'search') router.replace('/(tabs)/search');
    else if (tab === 'collections') router.replace('/(tabs)/collections');
    else if (tab === 'settings') router.replace('/(tabs)/settings');
  };

  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </View>
  );
}
