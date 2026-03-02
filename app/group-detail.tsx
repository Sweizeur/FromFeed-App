import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomNav from '@/components/navigation/AppBottomNav';
import CollectionCard from '@/components/groups/CollectionCard';
import { getGroup } from '@/lib/api';
import type { Group, Collection } from '@/types/groups';
import { Colors, darkColor } from '@/constants/theme';

export default function GroupDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGroup = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await getGroup(id);
        setGroup(response.group as Group);
      } catch (error) {
        __DEV__ && console.error('[GroupDetail] Erreur lors du chargement:', error);
      } finally {
        setLoading(false);
      }
    };
    loadGroup();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>Groupe introuvable</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: theme.text }]}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Les collections partagées sont déjà dans group.sharedCollections
  const sharedCollections = (group as any).sharedCollections || [];

  const handleCollectionPress = (collectionId: string) => {
    router.push(`/collection-detail?id=${collectionId}`);
  };

  const handleShareGroup = () => {
    // TODO: Implémenter le partage
    console.log('Partager le groupe');
  };

  const handleManageMembers = () => {
    // TODO: Implémenter la gestion des membres
    console.log('Gérer les membres');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {group.name}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareGroup}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        {group.description && (
          <View style={[styles.descriptionContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.description, { color: theme.icon }]}>{group.description}</Text>
          </View>
        )}

        {/* Membres */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Membres</Text>
            <TouchableOpacity
              onPress={handleManageMembers}
              activeOpacity={0.7}
            >
              <Text style={[styles.sectionAction, { color: theme.text }]}>Gérer</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.membersList}>
            {group.members.map((member) => (
              <View key={member.id} style={[styles.memberItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.memberAvatar, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.memberAvatarText, { color: theme.text }]}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: theme.text }]}>
                    {member.name}
                    {member.isOwner && (
                      <Text style={[styles.ownerBadge, { color: theme.icon }]}> • Propriétaire</Text>
                    )}
                  </Text>
                  <Text style={[styles.memberEmail, { color: theme.icon }]}>{member.email}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Collections partagées */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Collections partagées ({sharedCollections.length})
            </Text>
          </View>
          {sharedCollections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-outline" size={48} color={theme.border} />
              <Text style={[styles.emptyStateText, { color: theme.text }]}>Aucune collection partagée</Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.icon }]}>
                Les collections partagées avec ce groupe apparaîtront ici
              </Text>
            </View>
          ) : (
            sharedCollections.map((collection: any) => (
              <CollectionCard
                key={collection.id}
                collection={{
                  id: collection.id,
                  name: collection.name,
                  description: collection.description,
                  createdBy: '',
                  createdAt: collection.createdAt,
                  placesCount: collection.placesCount,
                  sharedWithGroups: [group.id],
                  isPrivate: collection.isPrivate,
                  coverImage: collection.coverImage,
                }}
                onPress={() => handleCollectionPress(collection.id)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <AppBottomNav activeTab="groups" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  shareButton: {
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  descriptionContainer: {
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '500',
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ownerBadge: {
    fontSize: 14,
    fontWeight: '400',
  },
  memberEmail: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

