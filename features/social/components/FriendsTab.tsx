import React, { useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, darkColor } from '@/constants/theme';
import type { Friend } from '@/features/social/types';
import { MOCK_FRIENDS } from '@/features/social/mocks/friends';

interface FriendsTabProps {
  theme: typeof Colors.light;
}

function FriendCard({ friend, isDark, theme }: { friend: Friend; isDark: boolean; theme: typeof Colors.light }) {
  const cardBg = isDark ? '#252628' : theme.surface;
  const subtextColor = theme.icon;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: cardBg, borderColor: theme.border }]} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: friend.avatarColor }]}>
        <Text style={styles.avatarText}>{friend.avatar}</Text>
      </View>

      <View style={styles.cardContent}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{friend.name}</Text>
        <Text style={[styles.username, { color: subtextColor }]}>{friend.username}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="location" size={12} color={subtextColor} />
            <Text style={[styles.statText, { color: subtextColor }]}>{friend.placesCount} lieux</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="people" size={12} color={subtextColor} />
            <Text style={[styles.statText, { color: subtextColor }]}>{friend.mutualFriends} ami{friend.mutualFriends > 1 ? 's' : ''} en commun</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={isDark ? theme.icon : theme.border} />
    </TouchableOpacity>
  );
}

export default function FriendsTab({ theme }: FriendsTabProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const renderItem = useMemo(
    () =>
      ({ item }: { item: Friend }) => <FriendCard friend={item} isDark={isDark} theme={theme} />,
    [isDark, theme]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, { color: theme.text }]}>
          {MOCK_FRIENDS.length} ami{MOCK_FRIENDS.length > 1 ? 's' : ''}
        </Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.surface, borderColor: theme.border }]} activeOpacity={0.7}>
          <Ionicons name="person-add" size={16} color={theme.text} />
          <Text style={[styles.addButtonText, { color: theme.text }]}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={MOCK_FRIENDS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  username: {
    fontSize: 13,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
});
