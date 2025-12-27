import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '@/components/navigation/BottomNav';
import CollectionCard from '@/components/groups/CollectionCard';
import CreateCollectionModal from '@/components/groups/CreateCollectionModal';
import { getCollections } from '@/lib/api';
import type { Collection } from '@/types/groups';
import { darkColor } from '@/constants/theme';

interface CollectionsScreenProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function CollectionsScreen({ activeTab: propActiveTab, onTabChange: propOnTabChange }: CollectionsScreenProps = {} as CollectionsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateCollectionModalVisible, setIsCreateCollectionModalVisible] = useState(false);

  // Charger les données
  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const collectionsData = await getCollections();
      setCollections(collectionsData.collections as Collection[]);
    } catch (error) {
      console.error('[CollectionsScreen] Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
  }, [loadData]);

  const handleCollectionPress = useCallback((collectionId: string) => {
    router.push(`/collection-detail?id=${collectionId}`);
  }, [router]);

  const handleCreateCollection = useCallback(() => {
    setIsCreateCollectionModalVisible(true);
  }, []);

  const handleCollectionCreated = useCallback(() => {
    loadData(false);
  }, [loadData]);

  return (
    <SafeAreaView style={[styles.container, propActiveTab ? { flex: 1 } : { paddingTop: insets.top, flex: 1 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes Collections</Text>
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
          {/* Bouton créer une collection */}
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
            collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onPress={() => handleCollectionPress(collection.id)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Bottom Navigation - seulement si CollectionsScreen est utilisé comme page standalone */}
      {!propActiveTab && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <BottomNav
            activeTab="collections"
            onTabChange={(tab) => {
              if (tab === 'home') router.push('/home');
              else if (tab === 'plans') router.push('/plans');
              else if (tab === 'collections') router.push('/collections');
              else if (tab === 'settings') router.push('/settings');
            }}
          />
        </View>
      )}

      {/* Modal */}
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: darkColor,
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
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

