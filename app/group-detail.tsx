import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '@/components/navigation/BottomNav';
import CollectionCard from '@/components/groups/CollectionCard';
import { getGroup } from '@/lib/api';
import type { Group, Collection } from '@/types/groups';
import { darkColor } from '@/constants/theme';

export default function GroupDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={darkColor} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Groupe introuvable</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={darkColor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareGroup}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={24} color={darkColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        {group.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>{group.description}</Text>
          </View>
        )}

        {/* Membres */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Membres</Text>
            <TouchableOpacity
              onPress={handleManageMembers}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionAction}>Gérer</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.membersList}>
            {group.members.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.name}
                    {member.isOwner && (
                      <Text style={styles.ownerBadge}> • Propriétaire</Text>
                    )}
                  </Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Collections partagées */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Collections partagées ({sharedCollections.length})
            </Text>
          </View>
          {sharedCollections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-outline" size={48} color="#CCC" />
              <Text style={styles.emptyStateText}>Aucune collection partagée</Text>
              <Text style={styles.emptyStateSubtext}>
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
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <BottomNav
          activeTab="groups"
          onTabChange={(tab) => {
            if (tab === 'home') router.push('/home');
            else if (tab === 'plans') router.push('/plans');
            else if (tab === 'groups') router.push('/groups');
            else if (tab === 'settings') router.push('/settings');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
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
    color: darkColor,
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
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
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
    color: darkColor,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '500',
    color: darkColor,
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: darkColor,
    marginBottom: 4,
  },
  ownerBadge: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  memberEmail: {
    fontSize: 13,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: darkColor,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#666',
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
    color: darkColor,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: darkColor,
    textDecorationLine: 'underline',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

