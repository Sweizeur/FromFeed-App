import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
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

const CLIENT_CACHE_DURATION = 30 * 1000; // 30 secondes

// Cache client en mémoire pour éviter les requêtes multiples
let collectionsClientCache: {
  data: Collection[];
  timestamp: number;
} | null = null;
let isLoadingCollectionsRef = false;

interface CollectionsScreenProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function CollectionsScreen({ activeTab: propActiveTab, onTabChange: propOnTabChange }: CollectionsScreenProps = {} as CollectionsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Initialiser avec le cache client si disponible (évite l'effet de reload)
  const [collections, setCollections] = useState<Collection[]>(() => {
    if (collectionsClientCache && (Date.now() - collectionsClientCache.timestamp) < CLIENT_CACHE_DURATION) {
      return collectionsClientCache.data;
    }
    return [];
  });
  
  // Ne pas afficher le loader si on a déjà des données du cache
  const [loading, setLoading] = useState(() => {
    // Si on a des données du cache, ne pas afficher le loader
    return collections.length === 0;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateCollectionModalVisible, setIsCreateCollectionModalVisible] = useState(false);

  // Charger les données depuis l'API (fonction interne)
  const loadDataFromAPI = useCallback(async (showLoading = false) => {
    // Éviter les requêtes simultanées multiples
    if (isLoadingCollectionsRef) {
      console.log('[CollectionsScreen] Requête déjà en cours, skip...');
      // Utiliser le cache client si disponible
      if (collectionsClientCache) {
        setCollections(collectionsClientCache.data);
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    try {
      isLoadingCollectionsRef = true;
      if (showLoading) {
        setLoading(true);
      }
      const collectionsData = await getCollections();
      if (!collectionsData) {
        throw new Error('Impossible de charger les collections');
      }
      const collections = collectionsData.collections as Collection[];
      setCollections(collections);
      
      // Mettre à jour le cache client
      collectionsClientCache = {
        data: collections,
        timestamp: Date.now(),
      };
    } catch (error) {
      __DEV__ && console.error('[CollectionsScreen] Erreur lors du chargement:', error);
    } finally {
      isLoadingCollectionsRef = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Charger les données (avec gestion du cache)
  const loadData = useCallback(async (showLoading = false, skipCache = false) => {
    // Vérifier le cache client si on ne skip pas le cache
    if (!skipCache && collectionsClientCache) {
      const cacheAge = Date.now() - collectionsClientCache.timestamp;
      if (cacheAge < CLIENT_CACHE_DURATION) {
        console.log('[CollectionsScreen] Utilisation du cache client (âge:', Math.round(cacheAge / 1000), 's)');
        setCollections(collectionsClientCache.data);
        setLoading(false);
        setRefreshing(false);
        // Ne PAS recharger si le cache est encore valide (évite les requêtes inutiles)
        // On ne rechargera que si le cache est expiré ou proche de l'expiration
        return;
      }
    }

    // Pas de cache valide ou cache expiré, charger depuis l'API
    await loadDataFromAPI(showLoading);
  }, [loadDataFromAPI]);

  useEffect(() => {
    // Si on a déjà des données du cache, vérifier si on doit recharger
    if (collections.length > 0) {
      // Vérifier si le cache est encore valide
      if (collectionsClientCache && (Date.now() - collectionsClientCache.timestamp) < CLIENT_CACHE_DURATION) {
        // Cache encore valide, ne pas recharger
        return;
      }
      // Cache expiré, recharger silencieusement en arrière-plan
      loadData(false, false).catch(() => {});
    } else {
      // Pas de données, charger avec loader
      loadData(true, false);
    }
  }, [loadData, collections.length]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Skip le cache pour le pull-to-refresh manuel
    await loadData(false, true);
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={darkColor}
            />
          }
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

