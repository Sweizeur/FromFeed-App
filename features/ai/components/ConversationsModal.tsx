import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useConversationsList, useDeleteConversation } from '@/features/ai/hooks/useConversations';
import { Colors, darkColor, darkColorWithAlpha } from '@/constants/theme';

interface ConversationsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  onCurrentConversationDeleted?: () => void;
  onRefresh?: () => void;
  colorScheme?: 'light' | 'dark';
}

const modalBg = (scheme: 'light' | 'dark') => (scheme === 'dark' ? Colors.dark.background : '#fff');
const surfaceColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#2C2E30' : '#FAFAFA');
const borderColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#3a3b3d' : '#EFEFEF');
const mutedColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#9BA1A6' : '#666');
const emptyIconColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#5a5d62' : '#CCC');

export default function ConversationsModal({
  visible,
  onClose,
  onSelectConversation,
  onRefresh,
  currentConversationId,
  onCurrentConversationDeleted,
  colorScheme = 'light',
}: ConversationsModalProps) {
  const insets = useSafeAreaInsets();
  const modalBgColor = modalBg(colorScheme);
  const surface = surfaceColor(colorScheme);
  const border = borderColor(colorScheme);
  const muted = mutedColor(colorScheme);
  const textColor = colorScheme === 'dark' ? Colors.dark.text : darkColor;
  const emptyIcon = emptyIconColor(colorScheme);

  const { data: conversations = [], refetch } = useConversationsList();
  const deleteMutation = useDeleteConversation();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(300);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
      refetch();
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(300, { duration: 300 });
    }
  }, [visible]);

  const handleDelete = (conversationId: string, event: { stopPropagation: () => void }) => {
    event.stopPropagation();

    if (currentConversationId === conversationId && onCurrentConversationDeleted) {
      onCurrentConversationDeleted();
    }

    deleteMutation.mutate(conversationId, {
      onSuccess: () => onRefresh?.(),
    });
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
            { paddingBottom: insets.bottom + 20, backgroundColor: modalBgColor },
            modalStyle,
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: border }]}>
            <Text style={[styles.headerTitle, { color: textColor }]}>Mes conversations</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: surface }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={emptyIcon} />
              <Text style={[styles.emptyText, { color: muted }]}>Aucune conversation</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.conversationItem, { backgroundColor: surface, borderColor: border }]}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={[styles.conversationTitle, { color: textColor }]} numberOfLines={1}>
                        {getConversationTitle(item)}
                      </Text>
                      <TouchableOpacity
                        onPress={(e) => handleDelete(item.id, e)}
                        style={styles.deleteButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={muted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.conversationFooter}>
                      <Text style={[styles.conversationMeta, { color: muted }]}>
                        {item._count.messages} message{item._count.messages > 1 ? 's' : ''}
                      </Text>
                      <Text style={[styles.conversationDate, { color: muted }]}>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    shadowColor: '#000',
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  conversationItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
  },
  conversationDate: {
    fontSize: 13,
  },
});

