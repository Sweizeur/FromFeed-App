import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import BottomNav from './BottomNav';

interface AppBottomNavProps {
  activeTab: string;
}

/**
 * Bottom nav avec navigation par onglets (map, search, plans, collections, settings).
 * À utiliser sur les pages standalone (collections, groups, group-detail, settings).
 */
export default function AppBottomNav({ activeTab }: AppBottomNavProps) {
  const router = useRouter();

  const handleTabChange = (tab: string) => {
    if (tab === 'map' || tab === 'search') router.push('/map');
    else if (tab === 'plans') router.push('/plans');
    else if (tab === 'collections') router.push('/collections');
    else if (tab === 'settings') router.push('/settings');
  };

  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </View>
  );
}
