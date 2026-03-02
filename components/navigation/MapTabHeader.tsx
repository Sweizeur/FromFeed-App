import React from 'react';
import { View, StyleSheet, Text, Pressable, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';
import GlassButton from '@/components/ui/GlassButton';

interface MapTabHeaderProps {
  placesCount: number;
  onHelpPress?: () => void;
  onAddPress?: () => void;
  onProfilePress?: () => void;
}

function displayUsername(name: string | undefined, email: string): string {
  if (name?.trim()) {
    const first = name.trim().split(/\s+/)[0];
    if (first) return `@${first}`;
  }
  const at = email?.indexOf('@');
  if (at != null && at > 0) return `@${email.slice(0, at)}`;
  return '@user';
}

export default function MapTabHeader({
  placesCount,
  onHelpPress,
  onAddPress,
  onProfilePress,
}: MapTabHeaderProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { user } = useAuth();

  const username = user ? displayUsername(user.name, user.email) : '@user';
  const initial =
    user?.name?.trim().charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';

  const pillBg = isDark ? 'rgba(58,59,61,0.6)' : 'rgba(232,232,232,0.6)';

  return (
    <View
      style={[styles.outer, { paddingTop: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={isDark ? 70 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blur,
          {
            backgroundColor: isDark
              ? 'rgba(28,28,30,0.85)'
              : 'rgba(255,255,255,0.88)',
          },
        ]}
      >
        <View style={styles.row}>
          {/* Profile section */}
          <Pressable
            style={styles.profile}
            onPress={onProfilePress}
            accessibilityRole="button"
            accessibilityLabel="Profil"
          >
            <View
              style={[styles.avatarWrap, { backgroundColor: pillBg }]}
            >
              {user?.image ? (
                <Image source={{ uri: user.image }} style={styles.avatar} />
              ) : (
                <Text style={[styles.avatarInitial, { color: theme.text }]}>
                  {initial}
                </Text>
              )}
            </View>

            <View style={styles.textCol}>
              <Text
                style={[styles.username, { color: theme.text }]}
                numberOfLines={1}
              >
                {username}
              </Text>
              <Text style={[styles.placesCount, { color: theme.icon }]}>
                {placesCount} lieu{placesCount !== 1 ? 'x' : ''}
              </Text>
            </View>
          </Pressable>

          {/* Actions */}
          <View style={styles.actions}>
            <GlassButton
              icon="help-circle-outline"
              onPress={onHelpPress ?? (() => {})}
              accessibilityLabel="Aide"
              textColor={theme.text}
              backgroundColor={isDark ? '#3a3b3d' : '#e8e8e8'}
            />
            <GlassButton
              icon="add"
              onPress={onAddPress ?? (() => {})}
              accessibilityLabel="Ajouter un lieu"
              textColor={theme.text}
              backgroundColor={isDark ? '#3a3b3d' : '#e8e8e8'}
            />
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  blur: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
  },
  textCol: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
  },
  placesCount: {
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
});
