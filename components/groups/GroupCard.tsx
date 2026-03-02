import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Group } from '@/types/groups';
import { Colors, darkColor } from '@/constants/theme';

interface GroupCardProps {
  group: Group;
  onPress: () => void;
}

function GroupCard({ group, onPress }: GroupCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const membersCount = group.members.length;
  const displayMembers = group.members.slice(0, 3);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: isDark ? '#000' : darkColor },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar du groupe ou icône */}
      <View style={styles.avatarContainer}>
        {group.avatar ? (
          <View style={[styles.avatar, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.avatarText, { color: theme.text }]}>{group.name.charAt(0).toUpperCase()}</Text>
          </View>
        ) : (
          <View style={[styles.avatarIcon, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="people" size={24} color={theme.text} />
          </View>
        )}
      </View>

      {/* Contenu */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {group.name}
          </Text>
          {group.sharedCollectionsCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{group.sharedCollectionsCount}</Text>
            </View>
          )}
        </View>

        {group.description && (
          <Text style={[styles.description, { color: theme.icon }]} numberOfLines={1}>
            {group.description}
          </Text>
        )}

        {/* Membres */}
        <View style={styles.membersContainer}>
          <View style={styles.membersAvatars}>
            {displayMembers.map((member, index) => (
              <View
                key={member.id}
                style={[
                  styles.memberAvatar,
                  index > 0 && styles.memberAvatarOverlap,
                  { zIndex: displayMembers.length - index },
                  { backgroundColor: theme.background, borderColor: theme.surface },
                ]}
              >
                <Text style={[styles.memberAvatarText, { color: theme.text }]}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {membersCount > 3 && (
              <View style={[styles.memberAvatar, styles.memberAvatarMore]}>
                <Text style={styles.memberAvatarMoreText}>+{membersCount - 3}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.membersText, { color: theme.icon }]}>
            {membersCount} membre{membersCount > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Chevron */}
      <View style={styles.chevronContainer}>
        <Ionicons name="chevron-forward" size={20} color={theme.border} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  avatarIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  badge: {
    backgroundColor: darkColor,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  description: {
    fontSize: 13,
    marginBottom: 8,
  },
  membersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  membersAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  memberAvatarOverlap: {
    marginLeft: -8,
  },
  memberAvatarMore: {
    backgroundColor: darkColor,
  },
  memberAvatarText: {
    fontSize: 10,
    fontWeight: '600',
  },
  memberAvatarMoreText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  membersText: {
    fontSize: 12,
  },
  chevronContainer: {
    justifyContent: 'center',
    marginLeft: 8,
  },
});

export default React.memo(GroupCard);

