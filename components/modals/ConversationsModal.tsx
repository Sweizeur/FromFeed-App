import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { getConversations, deleteConversation } from '@/lib/api';
import { darkColor, darkColorWithAlpha } from '@/constants/theme';

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface ConversationsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string; // ID de la conversation actuellement affichée
  onCurrentConversationDeleted?: () => void; // Callback quand la conversation actuelle est supprimée
  onRefresh?: () => void; // Callback pour rafraîchir la liste
}

export default function ConversationsModal({
  visible,
  onClose,
  onSelectConversation,
  onRefresh,
  currentConversationId,
  onCurrentConversationDeleted,
}: ConversationsModalProps) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(300);

  // Charger les conversations au montage et rafraîchir quand le modal s'ouvre
  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
      // Rafraîchir la liste quand le modal s'ouvre pour avoir les titres à jour
      loadConversations(true);
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(300, { duration: 300 });
    }
  }, [visible]);

  const loadConversations = async (forceRefresh = false) => {
    // Ne pas recharger si on a déjà des conversations et qu'on ne force pas le refresh
    if (!forceRefresh && conversations.length > 0) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await getConversations();
      if (result.success) {
        setConversations(result.conversations);
      }
    } catch (error) {
      console.error('[ConversationsModal] Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (conversationId: string, event: any) => {
    event.stopPropagation();
    setDeletingId(conversationId);
    try {
      await deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      
      // Si la conversation supprimée est la conversation actuelle, réinitialiser
      if (currentConversationId === conversationId && onCurrentConversationDeleted) {
        onCurrentConversationDeleted();
      }
      
      // Notifier le parent pour rafraîchir si nécessaire
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('[ConversationsModal] Erreur lors de la suppression:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelect = (conversationId: string) => {
    onSelectConversation(conversationId);
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) {
      return conversation.title;
    }
    // Si pas de titre, utiliser une date ou un titre par défaut
    const date = new Date(conversation.createdAt);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Conversation d\'aujourd\'hui';
    if (diffDays === 1) return 'Conversation d\'hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modal,
            { paddingBottom: insets.bottom + 20 },
            modalStyle,
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mes conversations</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={darkColor} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={darkColor} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Aucune conversation</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.conversationItem}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.conversationTitle} numberOfLines={1}>
                        {getConversationTitle(item)}
                      </Text>
                      <TouchableOpacity
                        onPress={(e) => handleDelete(item.id, e)}
                        style={styles.deleteButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {deletingId === item.id ? (
                          <ActivityIndicator size="small" color="#999" />
                        ) : (
                          <Ionicons name="trash-outline" size={18} color="#999" />
                        )}
                      </TouchableOpacity>
                    </View>
                    <View style={styles.conversationFooter}>
                      <Text style={styles.conversationMeta}>
                        {item._count.messages} message{item._count.messages > 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.conversationDate}>
                        {formatDate(item.updatedAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkColorWithAlpha(0.4),
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: darkColor,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: darkColor,
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  conversationItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: darkColor,
    flex: 1,
    marginRight: 12,
  },
  deleteButton: {
    padding: 4,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationMeta: {
    fontSize: 13,
    color: '#666',
  },
  conversationDate: {
    fontSize: 13,
    color: '#999',
  },
});

