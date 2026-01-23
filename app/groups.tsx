import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '@/components/navigation/BottomNav';
import GroupCard from '@/components/groups/GroupCard';
import CollectionCard from '@/components/groups/CollectionCard';
import CreateGroupModal from '@/components/groups/CreateGroupModal';
import CreateCollectionModal from '@/components/groups/CreateCollectionModal';
import { getGroups, getCollections } from '@/lib/api';
import type { Group, Collection } from '@/types/groups';
import { darkColor } from '@/constants/theme';

interface GroupsScreenProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function GroupsScreen({ activeTab: propActiveTab, onTabChange: propOnTabChange }: GroupsScreenProps = {} as GroupsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // État interne pour basculer entre "Groupes" et "Collections" dans cet écran
  const [internalSubTab, setInternalSubTab] = useState<'groups' | 'collections'>('groups');
  const [groups, setGroups] = useState<Group[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateGroupModalVisible, setIsCreateGroupModalVisible] = useState(false);
  const [isCreateCollectionModalVisible, setIsCreateCollectionModalVisible] = useState(false);

  // Charger les données
  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [groupsData, collectionsData] = await Promise.all([
        getGroups(),
        getCollections(),
      ]);
      setGroups(groupsData.groups as Group[]);
      setCollections(collectionsData.collections as Collection[]);
    } catch (error) {
      __DEV__ && console.error('[GroupsScreen] Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true); // Afficher le loader seulement au premier chargement
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false); // Pas de loader lors du refresh
  }, [loadData]);

  const handleGroupPress = useCallback((groupId: string) => {
    router.push(`/group-detail?id=${groupId}`);
  }, [router]);

  const handleCollectionPress = useCallback((collectionId: string) => {
    router.push(`/collection-detail?id=${collectionId}`);
  }, [router]);

  const handleCreateGroup = useCallback(() => {
    setIsCreateGroupModalVisible(true);
  }, []);

  const handleCreateCollection = useCallback(() => {
    setIsCreateCollectionModalVisible(true);
  }, []);

  const handleGroupCreated = useCallback(() => {
    loadData(false); // Recharger sans afficher le loader
  }, [loadData]);

  const handleCollectionCreated = useCallback(() => {
    loadData(false); // Recharger sans afficher le loader
  }, [loadData]);

  // Mémoriser les listes de cartes pour éviter les re-renders inutiles
  const groupsList = useMemo(
    () =>
      groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          onPress={() => handleGroupPress(group.id)}
        />
      )),
    [groups, handleGroupPress]
  );

  const collectionsList = useMemo(
    () =>
      collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onPress={() => handleCollectionPress(collection.id)}
        />
      )),
    [collections, handleCollectionPress]
  );

  return (
    <SafeAreaView style={[styles.container, propActiveTab ? { flex: 1 } : { paddingTop: insets.top, flex: 1 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Groupes & Collections</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, internalSubTab === 'groups' && styles.tabActive]}
          onPress={() => setInternalSubTab('groups')}
        >
          <Text style={[styles.tabText, internalSubTab === 'groups' && styles.tabTextActive]}>
            Groupes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, internalSubTab === 'collections' && styles.tabActive]}
          onPress={() => setInternalSubTab('collections')}
        >
          <Text style={[styles.tabText, internalSubTab === 'collections' && styles.tabTextActive]}>
            Collections
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={darkColor} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        >
          {internalSubTab === 'groups' && (
            <>
              {/* Bouton créer un groupe - plus visible et simple */}
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateGroup}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={28} color="#fff" />
                <Text style={styles.createButtonText}>Nouveau groupe</Text>
              </TouchableOpacity>

              {/* Liste des groupes */}
              {groups.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyStateText}>Aucun groupe pour le moment</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Créez un groupe pour partager vos collections avec vos amis
                  </Text>
                </View>
              ) : (
                groupsList
              )}
            </>
          )}

          {internalSubTab === 'collections' && (
            <>
              {/* Bouton créer une collection - plus visible et simple */}
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateCollection}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={28} color="#fff" />
                <Text style={styles.createButtonText}>Nouvelle collection</Text>
              </TouchableOpacity>

              {/* Liste des collections */}
              {collections.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="folder-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyStateText}>Aucune collection pour le moment</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Créez une collection pour organiser vos lieux
                  </Text>
                </View>
              ) : (
                collectionsList
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Bottom Navigation - seulement si GroupsScreen est utilisé comme page standalone */}
      {!propActiveTab && (
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
      )}

      {/* Modals - toujours rendus mais avec pointerEvents conditionnel */}
      <CreateGroupModal
        visible={isCreateGroupModalVisible}
        onClose={() => setIsCreateGroupModalVisible(false)}
        onSuccess={handleGroupCreated}
      />
      <CreateCollectionModal
        visible={isCreateCollectionModalVisible}
        onClose={() => setIsCreateCollectionModalVisible(false)}
        onSuccess={handleCollectionCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: darkColor,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  tab: {
    paddingBottom: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: darkColor,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: darkColor,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkColor,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 10,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

