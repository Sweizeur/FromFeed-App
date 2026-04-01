import React from 'react';
import { Platform, View, StyleSheet, Text, Pressable, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { GlassView } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/useAuthStore';
import { Colors } from '@/constants/theme';

interface MapTabHeaderProps {
  placesCount: number;
  onHelpPress?: () => void;
  onAddPress?: () => void;
  onProfilePress?: () => void;
  onPlacesPress?: () => void;
}

function formatUsername(username: string | undefined): string {
  if (username) return username;
  return 'User#0000';
}

export default function MapTabHeader({
  placesCount,
  onHelpPress,
  onAddPress,
  onProfilePress,
  onPlacesPress,
}: MapTabHeaderProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { user } = useAuth();

  const username = user ? formatUsername(user.username) : 'User#0000';
  const initial =
    user?.name?.trim().charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';

  return (
    <View
      style={[
        styles.outer,
        {
          paddingTop: insets.top + 8,
          shadowOpacity: isDark ? 0.2 : 0.12,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.headerShell} pointerEvents="box-none">
        <GlassView
          glassEffectStyle="regular"
          tintColor={isDark ? 'rgba(23, 23, 24, 0.95)' : 'rgba(245, 243, 236, 0.95)'}
          isInteractive
          style={[
            styles.glassHeader,
          ]}
        >
          <View style={styles.row}>
            <Pressable
              style={styles.profile}
              onPress={onProfilePress}
              accessibilityRole="button"
              accessibilityLabel="Profil"
            >
              <View style={[styles.avatarWrap]}>
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
                <Pressable onPress={onPlacesPress} hitSlop={4}>
                  <Text style={[styles.placesCount, { color: theme.icon }]}>
                    {placesCount} lieu{placesCount !== 1 ? 'x' : ''}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </GlassView>

        <View style={styles.actionsOverlay} pointerEvents="box-none">
          <GlassView
            glassEffectStyle="regular"
            tintColor={isDark ? 'rgba(20,20,20,0.55)' : 'rgba(245, 243, 236, 0.95)'}
            isInteractive
            style={styles.glassActionsBar}
          >
            <Pressable
              onPress={onHelpPress ?? (() => {})}
              accessibilityRole="button"
              accessibilityLabel="Aide"
              style={styles.glassActionPressable}
            >
              <Ionicons name="help-circle-outline" size={20} color={theme.text} />
            </Pressable>
            <View style={[styles.glassActionDivider, { backgroundColor: theme.border }]} />
            <Pressable
              onPress={onAddPress ?? (() => {})}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un lieu"
              style={styles.glassActionPressable}
            >
              <Ionicons name="add" size={20} color={theme.text} />
            </Pressable>
          </GlassView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  glassHeader: {
    borderRadius: 14,
    overflow: 'visible',
    margin: -2,
    padding: 2,
  },
  headerShell: {
    position: 'relative',
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'visible',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 56,
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
  glassActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    margin: -2,
    padding: 4,
    overflow: 'visible',
  },
  actionsOverlay: {
    position: 'absolute',
    right: 12,
    top: 10,
    bottom: 10,
    justifyContent: 'center',
    overflow: 'visible',
  },
  glassActionPressable: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  glassActionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    opacity: 0.3,
  },
});
