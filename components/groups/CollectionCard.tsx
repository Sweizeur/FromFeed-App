import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Collection } from '@/types/groups';
import { darkColor } from '@/constants/theme';

interface CollectionCardProps {
  collection: Collection;
  onPress: () => void;
}

function CollectionCard({ collection, onPress }: CollectionCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
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
        <View style={styles.coverPlaceholder}>
          <Ionicons name="folder" size={32} color="#999" />
        </View>
      )}

      {/* Overlay pour le contenu */}
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {collection.name}
            </Text>
            {!collection.isPrivate && collection.sharedWithGroups.length > 0 && (
              <View style={styles.sharedBadge}>
                <Ionicons name="people" size={12} color="#fff" />
              </View>
            )}
            {collection.isPrivate && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={12} color="#666" />
              </View>
            )}
          </View>

          {collection.description && (
            <Text style={styles.description} numberOfLines={2}>
              {collection.description}
            </Text>
          )}

          <View style={styles.footer}>
            <View style={styles.placesInfo}>
              <Ionicons name="location" size={14} color="#666" />
              <Text style={styles.placesCount}>
                {collection.placesCount} lieu{collection.placesCount > 1 ? 'x' : ''}
              </Text>
            </View>
            {collection.sharedWithGroups.length > 0 && (
              <Text style={styles.sharedText}>
                Partagé avec {collection.sharedWithGroups.length} groupe{collection.sharedWithGroups.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Chevron */}
      <View style={styles.chevronContainer}>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
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
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
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
    color: darkColor,
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
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 13,
    color: '#666',
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
    color: darkColor,
  },
  sharedText: {
    fontSize: 11,
    color: '#999',
  },
  chevronContainer: {
    position: 'absolute',
    right: 12,
    top: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

export default React.memo(CollectionCard);

