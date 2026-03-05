import React, { useCallback } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, useColorScheme, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MenuView } from '@react-native-menu/menu';
import { Colors, darkColor } from '@/constants/theme';
import { useCollectionsStore, type CollectionItem } from '@/stores/useCollectionsStore';

interface CollectionsTabProps {
  theme: typeof Colors.light;
}

function CollectionCard({
  collection,
  isDark,
  theme,
  onPress,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  collection: CollectionItem;
  isDark: boolean;
  theme: typeof Colors.light;
  onPress: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const cardBg = isDark ? '#252628' : theme.surface;
  const subtextColor = theme.icon;
  const tagBg = isDark ? '#3C3E40' : theme.background;

  const nameMatch = collection.name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*(.*)$/u);
  const emoji = nameMatch ? nameMatch[1] : '📁';
  const displayName = nameMatch ? nameMatch[2] : collection.name;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: theme.border }]}>
      <TouchableOpacity
        style={styles.cardPressable}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={[styles.emojiContainer, { backgroundColor: isDark ? '#3C3E40' : theme.background }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
          </View>
          {collection.description ? (
            <Text style={[styles.description, { color: subtextColor }]} numberOfLines={1}>{collection.description}</Text>
          ) : null}
          <View style={styles.footer}>
            <View style={[styles.tag, { backgroundColor: tagBg }]}>
              <Ionicons name="location" size={12} color={subtextColor} />
              <Text style={[styles.tagText, { color: theme.text }]}>
                {collection.placesCount} lieu{collection.placesCount !== 1 ? 'x' : ''}
              </Text>
            </View>
            {collection.sharedWithGroups.length > 0 && (
              <View style={[styles.tag, { backgroundColor: tagBg }]}>
                <Ionicons name="people" size={12} color={subtextColor} />
                <Text style={[styles.tagText, { color: theme.text }]}>
                  {collection.sharedWithGroups.length}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <MenuView
        shouldOpenOnLongPress={false}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event === 'edit') onEdit();
          else if (nativeEvent.event === 'duplicate') onDuplicate();
          else if (nativeEvent.event === 'delete') onDelete();
        }}
        actions={[
          { id: 'edit', title: 'Modifier', image: 'pencil' },
          { id: 'duplicate', title: 'Dupliquer', image: 'doc.on.doc' },
          { id: 'delete', title: 'Supprimer', image: 'trash', attributes: { destructive: true } },
        ]}
      >
        <View style={styles.menuBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.icon} />
        </View>
      </MenuView>
    </View>
  );
}

export default function CollectionsTab({ theme }: CollectionsTabProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const {
    collections,
    loading,
    refreshing,
    refresh,
    optimisticDelete,
    optimisticDuplicate,
  } = useCollectionsStore();

  const handleCollectionPress = useCallback((id: string) => {
    router.push({ pathname: '/collection-detail', params: { id } });
  }, [router]);

  const handleDeleteCollection = useCallback((collection: CollectionItem) => {
    const nameMatch = collection.name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*(.*)$/u);
    const displayName = nameMatch ? nameMatch[2] : collection.name;

    Alert.alert(
      'Supprimer la collection',
      `Êtes-vous sûr de vouloir supprimer "${displayName}" ? Les lieux ne seront pas supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => optimisticDelete(collection),
        },
      ]
    );
  }, [optimisticDelete]);

  const handleDuplicateCollection = useCallback((collection: CollectionItem) => {
    optimisticDuplicate(collection);
  }, [optimisticDuplicate]);

  const handleEditCollection = useCallback((collection: CollectionItem) => {
    router.push({ pathname: '/edit-collection', params: { id: collection.id } });
  }, [router]);

  const handleCreatePress = useCallback(() => {
    router.push('/create-collection');
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: CollectionItem }) => (
      <CollectionCard
        collection={item}
        isDark={isDark}
        theme={theme}
        onPress={() => handleCollectionPress(item.id)}
        onEdit={() => handleEditCollection(item)}
        onDuplicate={() => handleDuplicateCollection(item)}
        onDelete={() => handleDeleteCollection(item)}
      />
    ),
    [isDark, theme, handleCollectionPress, handleEditCollection, handleDuplicateCollection, handleDeleteCollection]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, { color: theme.text }]}>
          {collections.length} collection{collections.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          activeOpacity={0.7}
          onPress={handleCreatePress}
        >
          <Ionicons name="add" size={18} color={theme.text} />
          <Text style={[styles.addButtonText, { color: theme.text }]}>Créer</Text>
        </TouchableOpacity>
      </View>

      {collections.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="folder-open-outline" size={56} color={isDark ? '#555' : '#CCC'} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucune collection</Text>
          <Text style={[styles.emptySubtitle, { color: theme.icon }]}>
            Créez votre première collection pour organiser vos lieux
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={handleCreatePress}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Créer une collection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
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
    gap: 4,
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
  cardPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  description: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: darkColor,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
