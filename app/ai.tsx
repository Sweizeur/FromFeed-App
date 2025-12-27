import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { getConversation, sendAIMessage, validateDraftPlan, rejectDraftPlan } from '@/lib/api';
import ConversationsModal from '@/components/modals/ConversationsModal';
import AIHeader from '@/components/ai/AIHeader';
import AIMessage from '@/components/ai/AIMessage';
import AILoadingIndicator from '@/components/ai/AILoadingIndicator';
import AIInput from '@/components/ai/AIInput';
import AIEmptyState from '@/components/ai/AIEmptyState';

const SUGGESTIONS = [
  "Crée un planning pour demain avec mes lieux préférés",
  "Organise ma journée de samedi avec des restaurants",
  "Trouve-moi les meilleurs restaurants près de moi",
  "Quels sont mes lieux les mieux notés ?",
];

const CONVERSATION_ID_KEY = '@fromfeed:current_conversation_id';
const getConversationMessagesKey = (conversationId: string) => `@fromfeed:conversation_messages_${conversationId}`;
const getConversationTitleKey = (conversationId: string) => `@fromfeed:conversation_title_${conversationId}`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  draftPlan?: {
    date: string;
    title: string | null;
    notes: string | null;
      activities: Array<{
        placeName: string;
        placeId: string;
        order: number;
        startTime?: string;
        endTime?: string;
        notes?: string;
      }>;
    isValidated?: boolean; // Indique si le plan a été validé
  };
}

// Fonction pour extraire le plan temporaire d'un message
function extractDraftPlan(content: string): { cleanContent: string; draftPlan?: any } {
  const draftPlanRegex = /<!-- DRAFT_PLAN:(.+?) -->/s;
  const match = content.match(draftPlanRegex);
  
  if (match && match[1]) {
    try {
      const draftPlan = JSON.parse(match[1]);
      // Préserver le flag isValidated s'il existe
      const cleanContent = content.replace(draftPlanRegex, '').trim();
      return { cleanContent: cleanContent, draftPlan };
    } catch (e) {
      console.error('[AIPage] Erreur lors du parsing du plan temporaire:', e);
    }
  }
  
  return { cleanContent: content };
}

export default function AIPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ id: string; name: string; uri?: string }>>([]);
  const [showConversationsModal, setShowConversationsModal] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // Animation pour le titre
  const titleOpacity = useSharedValue(1);
  const titleScale = useSharedValue(1);

  // Charger le conversationId et le cache depuis AsyncStorage au montage
  useEffect(() => {
    const loadPersistedConversation = async () => {
      try {
        const savedConversationId = await AsyncStorage.getItem(CONVERSATION_ID_KEY);
        if (savedConversationId) {
          setConversationId(savedConversationId);
          
          // Charger immédiatement le cache des messages et du titre
          try {
            const cachedMessages = await AsyncStorage.getItem(getConversationMessagesKey(savedConversationId));
            if (cachedMessages) {
              const parsedMessages: Message[] = JSON.parse(cachedMessages);
              // Convertir les timestamps string en Date
              const messagesWithDates = parsedMessages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              }));
              setMessages(messagesWithDates);
            }
            
            const cachedTitle = await AsyncStorage.getItem(getConversationTitleKey(savedConversationId));
            if (cachedTitle) {
              setConversationTitle(cachedTitle);
            }
          } catch (cacheError) {
            console.error('[AIPage] Erreur lors du chargement du cache:', cacheError);
          }
        }
      } catch (error) {
        console.error('[AIPage] Erreur lors du chargement de la conversation:', error);
      }
    };
    loadPersistedConversation();
  }, []);

  // Charger les messages et le titre depuis l'API (en arrière-plan, après avoir affiché le cache)
  useEffect(() => {
    const loadConversationMessages = async () => {
      if (conversationId) {
        try {
          const result = await getConversation(conversationId);
          if (result.success && result.conversation) {
            // Mettre à jour les messages avec les données fraîches
            if (result.conversation.messages) {
              const formattedMessages: Message[] = result.conversation.messages.map((msg: any) => {
                const { cleanContent, draftPlan } = extractDraftPlan(msg.content);
                return {
                  id: msg.id || Date.now().toString() + Math.random(),
                  role: msg.role,
                  content: cleanContent,
                  timestamp: new Date(msg.createdAt || Date.now()),
                  draftPlan,
                };
              });
              setMessages(formattedMessages);
              
              // Sauvegarder dans le cache
              try {
                await AsyncStorage.setItem(
                  getConversationMessagesKey(conversationId),
                  JSON.stringify(formattedMessages)
                );
              } catch (cacheError) {
                console.error('[AIPage] Erreur lors de la sauvegarde du cache:', cacheError);
              }
            }
            
            // Mettre à jour le titre avec animation si différent
            if (result.conversation.title !== conversationTitle) {
              animateTitleChange(result.conversation.title);
              
              // Sauvegarder le titre dans le cache
              if (result.conversation.title) {
                try {
                  await AsyncStorage.setItem(
                    getConversationTitleKey(conversationId),
                    result.conversation.title
                  );
                } catch (cacheError) {
                  console.error('[AIPage] Erreur lors de la sauvegarde du titre:', cacheError);
                }
              }
            }
          }
        } catch (error) {
          console.error('[AIPage] Erreur lors du chargement des messages:', error);
        }
      } else {
        // Si pas de conversationId, réinitialiser les messages et le titre
        setMessages([]);
        animateTitleChange(null);
      }
    };
    
    // Attendre un peu pour laisser le cache s'afficher d'abord
    const timeoutId = setTimeout(() => {
      loadConversationMessages();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [conversationId]);

  // Fonction pour animer le changement de titre
  const animateTitleChange = (newTitle: string | null) => {
    // Animation de sortie
    titleOpacity.value = withSequence(
      withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) })
    );
    titleScale.value = withSequence(
      withTiming(0.9, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) })
    );
    
    // Changer le titre au milieu de l'animation
    setTimeout(() => {
      setConversationTitle(newTitle);
    }, 200);
  };

  const handleSelectConversation = async (selectedConversationId: string) => {
    // Charger immédiatement le cache avant de faire la requête API
    try {
      const cachedMessages = await AsyncStorage.getItem(getConversationMessagesKey(selectedConversationId));
      if (cachedMessages) {
        const parsedMessages: Message[] = JSON.parse(cachedMessages);
        const messagesWithDates = parsedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
      } else {
        setMessages([]);
      }
      
      const cachedTitle = await AsyncStorage.getItem(getConversationTitleKey(selectedConversationId));
      if (cachedTitle) {
        setConversationTitle(cachedTitle);
      } else {
        setConversationTitle(null);
      }
    } catch (cacheError) {
      console.error('[AIPage] Erreur lors du chargement du cache:', cacheError);
    }
    
    setConversationId(selectedConversationId);
    try {
      await AsyncStorage.setItem(CONVERSATION_ID_KEY, selectedConversationId);
      // Les données fraîches seront chargées par le useEffect qui surveille conversationId
    } catch (error) {
      console.error('[AIPage] Erreur lors de la sauvegarde du conversationId:', error);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    const userPrompt = prompt.trim();
    const currentConversationId = conversationId;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    };
    const messagesWithUser = [...messages, userMessage];
    setMessages(messagesWithUser);
    setPrompt('');
    setIsLoading(true);
    
    // Sauvegarder immédiatement le message utilisateur dans le cache
    if (currentConversationId) {
      try {
        await AsyncStorage.setItem(
          getConversationMessagesKey(currentConversationId),
          JSON.stringify(messagesWithUser)
        );
      } catch (cacheError) {
        console.error('[AIPage] Erreur lors de la sauvegarde du cache:', cacheError);
      }
    }

    try {
      const result = await sendAIMessage(userPrompt, currentConversationId);
      
      if (result?.conversationId) {
        const newConversationId = result.conversationId;
        setConversationId(newConversationId);
        try {
          await AsyncStorage.setItem(CONVERSATION_ID_KEY, newConversationId);
          
          // Vérifier périodiquement si un titre a été généré (polling toutes les 2 secondes, max 5 tentatives)
          let attempts = 0;
          const maxAttempts = 5;
          const checkTitle = setInterval(async () => {
            attempts++;
            try {
              const convResult = await getConversation(newConversationId);
              if (convResult.success && convResult.conversation?.title) {
                animateTitleChange(convResult.conversation.title);
                clearInterval(checkTitle);
              } else if (attempts >= maxAttempts) {
                clearInterval(checkTitle);
              }
            } catch (error) {
              console.error('[AIPage] Erreur lors de la vérification du titre:', error);
              if (attempts >= maxAttempts) {
                clearInterval(checkTitle);
              }
            }
          }, 2000);
        } catch (error) {
          console.error('[AIPage] Erreur lors de la sauvegarde du conversationId:', error);
        }
      }
      
      if (result?.response && result.response.trim().length > 0) {
        const { cleanContent, draftPlan } = extractDraftPlan(result.response);
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: cleanContent,
          timestamp: new Date(),
          draftPlan,
        };
        const finalConversationId = result.conversationId || currentConversationId;
        const updatedMessages = [...messagesWithUser, aiMessage];
        setMessages(updatedMessages);
        
        // Sauvegarder dans le cache
        if (finalConversationId) {
          try {
            await AsyncStorage.setItem(
              getConversationMessagesKey(finalConversationId),
              JSON.stringify(updatedMessages)
            );
          } catch (cacheError) {
            console.error('[AIPage] Erreur lors de la sauvegarde du cache:', cacheError);
          }
        }
      }
    } catch (error) {
      console.error('[AIPage] Erreur lors de la soumission:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Désolé, une erreur est survenue: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewMessage = async () => {
    const oldConversationId = conversationId;
    setMessages([]);
    setPrompt('');
    setConversationId(undefined);
    animateTitleChange(null);
    try {
      await AsyncStorage.removeItem(CONVERSATION_ID_KEY);
      // Nettoyer le cache de l'ancienne conversation
      if (oldConversationId) {
        await AsyncStorage.removeItem(getConversationMessagesKey(oldConversationId));
        await AsyncStorage.removeItem(getConversationTitleKey(oldConversationId));
      }
    } catch (error) {
      console.error('[AIPage] Erreur lors de la suppression du conversationId:', error);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setPrompt(suggestion);
  };

  const handleScrollToEndIfNeeded = React.useCallback(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    handleScrollToEndIfNeeded();
  }, [handleScrollToEndIfNeeded]);

  // Style animé pour le titre
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <AIHeader
          conversationTitle={conversationTitle}
          titleAnimatedStyle={titleAnimatedStyle}
          onShowConversations={() => setShowConversationsModal(true)}
          hasMessages={messages.length > 0}
          onNewMessage={handleNewMessage}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Interface de chat */}
          {(messages.length > 0 || isLoading) ? (
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatContainer}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {messages.map((message) => (
                <AIMessage
                  key={message.id}
                  message={message}
                  onValidateDraftPlan={async () => {
                    if (!conversationId) return;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === message.id
                          ? { 
                              ...msg, 
                              draftPlan: msg.draftPlan 
                                ? { ...msg.draftPlan, isValidated: true }
                                : undefined
                            }
                          : msg
                      )
                    );
                    try {
                      const result = await validateDraftPlan(conversationId, message.draftPlan!, message.id);
                      if (result.success && conversationId) {
                        try {
                          const updatedMessages = messages.map((msg) =>
                            msg.id === message.id
                              ? { 
                                  ...msg, 
                                  draftPlan: msg.draftPlan 
                                    ? { ...msg.draftPlan, isValidated: true }
                                    : undefined
                                }
                              : msg
                          );
                          await AsyncStorage.setItem(
                            getConversationMessagesKey(conversationId),
                            JSON.stringify(updatedMessages)
                          );
                        } catch (cacheError) {
                          console.error('[AIPage] Erreur lors de la sauvegarde du cache:', cacheError);
                        }
                      } else {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === message.id
                              ? { 
                                  ...msg, 
                                  draftPlan: msg.draftPlan 
                                    ? { ...msg.draftPlan, isValidated: false }
                                    : undefined
                                }
                              : msg
                          )
                        );
                      }
                    } catch (error) {
                      console.error('[AIPage] Erreur lors de la validation du plan:', error);
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === message.id
                            ? { 
                                ...msg, 
                                draftPlan: msg.draftPlan 
                                  ? { ...msg.draftPlan, isValidated: false }
                                  : undefined
                              }
                            : msg
                        )
                      );
                    }
                  }}
                  onRejectDraftPlan={async () => {
                    if (!conversationId) return;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === message.id
                          ? { 
                              ...msg, 
                              draftPlan: msg.draftPlan 
                                ? { ...msg.draftPlan, isValidated: true }
                                : undefined
                            }
                          : msg
                      )
                    );
                    try {
                      await rejectDraftPlan(conversationId, message.id);
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === message.id
                            ? { ...msg, draftPlan: undefined }
                            : msg
                        )
                      );
                    } catch (error) {
                      console.error('[AIPage] Erreur lors du rejet du plan:', error);
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === message.id
                            ? { 
                                ...msg, 
                                draftPlan: msg.draftPlan 
                                  ? { ...msg.draftPlan, isValidated: false }
                                  : undefined
                              }
                            : msg
                        )
                      );
                    }
                  }}
                />
              ))}

              {isLoading && <AILoadingIndicator />}
            </ScrollView>
          ) : (
            <AIEmptyState
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              suggestions={SUGGESTIONS}
              onSuggestionPress={handleSuggestionPress}
              attachedFiles={attachedFiles}
              onRemoveFile={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))}
            />
          )}

          {/* Input - Toujours visible si messages existent */}
          {messages.length > 0 && (
            <AIInput
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              attachedFiles={attachedFiles}
              onRemoveFile={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))}
              placeholder="Continuer la conversation..."
            />
          )}
        </View>

        {/* Modal des conversations */}
        <ConversationsModal
          visible={showConversationsModal}
          onClose={() => setShowConversationsModal(false)}
          onSelectConversation={handleSelectConversation}
          currentConversationId={conversationId}
          onCurrentConversationDeleted={() => {
            // Réinitialiser l'état pour revenir à l'empty state
            const deletedConversationId = conversationId;
            setMessages([]);
            setPrompt('');
            setConversationId(undefined);
            animateTitleChange(null);
            try {
              AsyncStorage.removeItem(CONVERSATION_ID_KEY);
              // Nettoyer le cache de la conversation supprimée
              if (deletedConversationId) {
                AsyncStorage.removeItem(getConversationMessagesKey(deletedConversationId));
                AsyncStorage.removeItem(getConversationTitleKey(deletedConversationId));
              }
            } catch (error) {
              console.error('[AIPage] Erreur lors de la suppression du conversationId:', error);
            }
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  chatContainer: {
    flex: 1,
    marginBottom: 16,
  },
  chatContent: {
    paddingBottom: 16,
    paddingRight: 8,
  },
});

