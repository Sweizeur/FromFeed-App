import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Collection } from '@/types/groups';
import { Colors, darkColor } from '@/constants/theme';

interface CollectionCardProps {
  collection: Collection;
  onPress: () => void;
}

function CollectionCard({ collection, onPress }: CollectionCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const overlayBg = isDark ? 'rgba(28,28,30,0.88)' : 'rgba(250,248,242,0.96)';
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: isDark ? '#000' : darkColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Image de couverture ou placeholder */}
      {collection.coverImage ? (
        <Image
          source={{ uri: collection.coverImage }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: theme.background }]}>
          <Ionicons name="folder" size={32} color={theme.icon} />
        </View>
      )}

      {/* Overlay pour le contenu */}
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {collection.name}
            </Text>
            {!collection.isPrivate && collection.sharedWithGroups.length > 0 && (
              <View style={styles.sharedBadge}>
                <Ionicons name="people" size={12} color="#fff" />
              </View>
            )}
            {collection.isPrivate && (
              <View style={[styles.privateBadge, { backgroundColor: theme.background }]}>
                <Ionicons name="lock-closed" size={12} color={theme.icon} />
              </View>
            )}
          </View>

          {collection.description && (
            <Text style={[styles.description, { color: theme.icon }]} numberOfLines={2}>
              {collection.description}
            </Text>
          )}

          <View style={styles.footer}>
            <View style={styles.placesInfo}>
              <Ionicons name="location" size={14} color={theme.icon} />
              <Text style={[styles.placesCount, { color: theme.text }]}>
                {collection.placesCount} lieu{collection.placesCount > 1 ? 'x' : ''}
              </Text>
            </View>
            {collection.sharedWithGroups.length > 0 && (
              <Text style={[styles.sharedText, { color: theme.icon }]}>
                Partagé avec {collection.sharedWithGroups.length} groupe{collection.sharedWithGroups.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
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
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 120,
    position: 'relative',
  },
  coverImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: darkColor,
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
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  sharedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: darkColor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privateBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 13,
    marginBottom: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  placesCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  sharedText: {
    fontSize: 11,
  },
  chevronContainer: {
    position: 'absolute',
    right: 12,
    top: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

export default React.memo(CollectionCard);

