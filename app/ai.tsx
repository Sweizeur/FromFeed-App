import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { getConversation, getPlaceDetails } from '@/lib/api';
import { exportPlanToCalendar } from '@/lib/calendar-export';
import type { Plan, PlanActivity } from '@/types/api';
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

function toDateOnly(dateStr: string): string {
  const part = dateStr.split('T')[0];
  return part && /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : dateStr;
}

function draftPlanToPlan(draft: {
  date: string;
  title: string | null;
  notes: string | null;
  activities: Array<{ placeName: string; placeId: string; order: number; startTime?: string; endTime?: string; notes?: string }>;
}): Plan {
  const date = toDateOnly(draft.date);
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}`,
    userId: '',
    date,
    title: draft.title ?? null,
    notes: draft.notes ?? null,
    activities: draft.activities.map((a, i) => ({
      id: `draft-activity-${i}`,
      planId: `draft-${Date.now()}`,
      placeId: a.placeId,
      order: a.order,
      startTime: a.startTime ?? null,
      endTime: a.endTime ?? null,
      notes: a.notes ?? null,
      place: {
        id: a.placeId,
        lat: 0,
        lon: 0,
        placeName: a.placeName,
        rawTitle: a.placeName,
        provider: 'draft',
        canonicalUrl: '',
      },
      createdAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enrichit le plan avec les détails des lieux (adresse, lat/lon, tél, URL) pour l'export calendrier. */
async function enrichPlanWithPlaceDetails(plan: Plan): Promise<Plan> {
  const placeIds = [...new Set(plan.activities.map((a) => a.placeId).filter((id) => UUID_REGEX.test(id)))];
  const detailsByPlaceId = new Map<string, PlanActivity['place']>();
  await Promise.all(
    placeIds.map(async (placeId) => {
      const res = await getPlaceDetails(placeId);
      const p = res?.place;
      if (p) {
        detailsByPlaceId.set(placeId, {
          id: p.id,
          lat: p.lat ?? 0,
          lon: p.lon ?? 0,
          placeName: p.placeName ?? p.rawTitle ?? null,
          rawTitle: p.rawTitle ?? p.placeName ?? null,
          googleFormattedAddress: p.googleFormattedAddress ?? null,
          address: p.address ?? null,
          city: p.city ?? null,
          googlePhone: p.googlePhone ?? null,
          websiteUrl: p.websiteUrl ?? p.googleWebsite ?? null,
          provider: p.provider ?? 'draft',
          canonicalUrl: p.canonicalUrl ?? '',
        });
      }
    })
  );
  return {
    ...plan,
    activities: plan.activities.map((a) => {
      const details = detailsByPlaceId.get(a.placeId);
      return {
        ...a,
        place: details ?? a.place,
      };
    }),
  };
}

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
      __DEV__ && console.error('[AIPage] Erreur lors du parsing du plan temporaire:', e);
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
            __DEV__ && console.error('[AIPage] Erreur lors du chargement du cache:', cacheError);
          }
        }
      } catch (error) {
        __DEV__ && console.error('[AIPage] Erreur lors du chargement de la conversation:', error);
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
                __DEV__ && console.error('[AIPage] Erreur lors de la sauvegarde du cache:', cacheError);
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
                  __DEV__ && console.error('[AIPage] Erreur lors de la sauvegarde du titre:', cacheError);
                }
              }
            }
          }
        } catch (error) {
          __DEV__ && console.error('[AIPage] Erreur lors du chargement des messages:', error);
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
      __DEV__ && console.error('[AIPage] Erreur lors du chargement du cache:', cacheError);
    }
    
    setConversationId(selectedConversationId);
    try {
      await AsyncStorage.setItem(CONVERSATION_ID_KEY, selectedConversationId);
      // Les données fraîches seront chargées par le useEffect qui surveille conversationId
    } catch (error) {
      __DEV__ && console.error('[AIPage] Erreur lors de la sauvegarde du conversationId:', error);
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
    setIsLoading(true); // Désactiver l'input pendant le streaming
    
    // Sauvegarder immédiatement le message utilisateur dans le cache
    if (currentConversationId) {
      try {
        await AsyncStorage.setItem(
          getConversationMessagesKey(currentConversationId),
          JSON.stringify(messagesWithUser)
        );
      } catch (cacheError) {
        __DEV__ && console.error('[AIPage] Erreur lors de la sauvegarde du cache:', cacheError);
      }
    }

    // Créer un message assistant vide qui sera mis à jour en temps réel
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages([...messagesWithUser, aiMessage]);

    try {
      const { sendAIMessageStreaming } = await import('@/lib/api');
      
      let accumulatedContent = '';
      
      await sendAIMessageStreaming(
        userPrompt,
        currentConversationId,
        // onChunk: Mettre à jour le message en temps réel
        (chunk: string) => {
          accumulatedContent += chunk;
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            );
            // Scroll automatique vers le bas quand un nouveau chunk arrive
            setTimeout(() => {
              if (scrollViewRef.current) {
                scrollViewRef.current.scrollToEnd({ animated: true });
              }
            }, 50);
            return updated;
          });
        },
        // onComplete: Finaliser le message avec le draft plan si présent
        async (fullResponse: string, newConversationId: string) => {
          const { cleanContent, draftPlan } = extractDraftPlan(fullResponse);
          
          setConversationId(newConversationId);
          try {
            await AsyncStorage.setItem(CONVERSATION_ID_KEY, newConversationId);
            
            // Vérifier périodiquement si un titre a été généré
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
                __DEV__ && console.error('[AIPage] Erreur lors de la vérification du titre:', error);
                if (attempts >= maxAttempts) {
                  clearInterval(checkTitle);
                }
              }
            }, 2000);
          } catch (error) {
            __DEV__ && console.error('[AIPage] Erreur lors de la sauvegarde du conversationId:', error);
          }
          
          // Mettre à jour le message final avec le draft plan
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: cleanContent, draftPlan }
                : msg
            );
            
            // Sauvegarder dans le cache
            if (newConversationId) {
              AsyncStorage.setItem(
                getConversationMessagesKey(newConversationId),
                JSON.stringify(updated)
              ).catch((cacheError) => {
                __DEV__ && console.error('[AIPage] Erreur lors de la sauvegarde du cache:', cacheError);
              });
            }
            
            return updated;
          });
          
          setIsLoading(false); // Réactiver l'input quand c'est terminé
        },
        // onError: Afficher un message d'erreur
        (error: Error) => {
          __DEV__ && console.error('[AIPage] Erreur lors du streaming:', error);
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: `Désolé, une erreur est survenue: ${error.message}`,
                  }
                : msg
            );
            return updated;
          });
          setIsLoading(false); // Réactiver l'input même en cas d'erreur
        }
      );
    } catch (error) {
      __DEV__ && console.error('[AIPage] Erreur lors de la soumission:', error);
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: `Désolé, une erreur est survenue: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
              }
            : msg
        );
        return updated;
      });
      setIsLoading(false); // Réactiver l'input en cas d'erreur
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
      __DEV__ && console.error('[AIPage] Erreur lors de la suppression du conversationId:', error);
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
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const showLoader =
                  isLoading &&
                  isLastMessage &&
                  message.role === 'assistant' &&
                  message.content === '';
                if (showLoader) {
                  return <AILoadingIndicator key={message.id} />;
                }
                return (
                <AIMessage
                  key={message.id}
                  message={message}
                  onAddToCalendar={async (draftPlan) => {
                    const plan = draftPlanToPlan(draftPlan);
                    const planWithDetails = await enrichPlanWithPlaceDetails(plan);
                    const result = await exportPlanToCalendar(planWithDetails);
                    if (result.success) {
                      const msg =
                        result.added === 0 && result.skipped > 0
                          ? `${result.skipped} événement(s) déjà présent(s) dans le calendrier.`
                          : `${result.added} événement(s) ajouté(s) au calendrier.` +
                            (result.skipped > 0 ? ` ${result.skipped} déjà présent(s).` : '');
                      Alert.alert('Calendrier', msg);
                    } else {
                      Alert.alert('Erreur', result.error);
                    }
                  }}
                />
              );
              })}

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
              __DEV__ && console.error('[AIPage] Erreur lors de la suppression du conversationId:', error);
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

