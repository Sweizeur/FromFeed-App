import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { getConversation } from '@/lib/api';
import { exportPlanToCalendar } from '@/lib/services/calendar-export';
import ConversationsModal from '@/features/ai/components/ConversationsModal';
import AIHeader from '@/features/ai/components/AIHeader';
import AIMessage from '@/features/ai/components/AIMessage';
import AILoadingIndicator from '@/features/ai/components/AILoadingIndicator';
import AIInput from '@/features/ai/components/AIInput';
import AIEmptyState from '@/features/ai/components/AIEmptyState';
import {
  useAIConversation,
  extractDraftPlan,
  draftPlanToPlan,
  enrichPlanWithPlaceDetails,
  type Message,
  type DraftPlan,
} from '@/features/ai/hooks/useAIConversation';

const SUGGESTIONS = [
  'Crée un planning pour demain avec mes lieux préférés',
  'Organise ma journée de samedi avec des restaurants',
  'Trouve-moi les meilleurs restaurants près de moi',
  'Quels sont mes lieux les mieux notés ?',
];

const TAB_BAR_MIN_HEIGHT = 49;

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const contentPaddingBottom = 16 + Math.max(insets.bottom, TAB_BAR_MIN_HEIGHT);

  const {
    messages,
    setMessages,
    conversationId,
    conversationTitle,
    conversationTitleRef,
    titleAnimatedStyle,
    animateTitleChange,
    selectConversation,
    newConversation,
    clearCurrentConversation,
    cacheMessages,
    persistConversationId,
  } = useAIConversation();

  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; uri?: string }[]>([]);
  const [showConversationsModal, setShowConversationsModal] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

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

    if (currentConversationId) {
      await cacheMessages(messagesWithUser, currentConversationId);
    }

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
        (chunk: string) => {
          accumulatedContent += chunk;
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg
            );
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
            return updated;
          });
        },
        async (fullResponse: string, newConversationId: string) => {
          const { cleanContent, draftPlan } = extractDraftPlan(fullResponse);

          await persistConversationId(newConversationId);

          let attempts = 0;
          const checkTitle = setInterval(async () => {
            attempts++;
            try {
              const convResult = await getConversation(newConversationId);
              if (convResult?.success && convResult.conversation?.title) {
                if (convResult.conversation.title !== conversationTitleRef.current) {
                  animateTitleChange(convResult.conversation.title);
                }
                clearInterval(checkTitle);
              } else if (attempts >= 5) {
                clearInterval(checkTitle);
              }
            } catch {
              if (attempts >= 5) clearInterval(checkTitle);
            }
          }, 2000);

          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: cleanContent, draftPlan } : msg
            );
            cacheMessages(updated, newConversationId);
            return updated;
          });

          setIsLoading(false);
        },
        (error: Error) => {
          __DEV__ && console.error('[AIScreen] Streaming error:', error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: `Désolé, une erreur est survenue: ${error.message}` }
                : msg
            )
          );
          setIsLoading(false);
        }
      );
    } catch (error) {
      __DEV__ && console.error('[AIScreen] Submit error:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: `Désolé, une erreur est survenue: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`,
              }
            : msg
        )
      );
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => setPrompt(suggestion);

  const handleScrollToEndIfNeeded = React.useCallback(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  useEffect(() => {
    handleScrollToEndIfNeeded();
  }, [handleScrollToEndIfNeeded]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -24 : 0}
      >
        <AIHeader
          conversationTitle={conversationTitle}
          titleAnimatedStyle={titleAnimatedStyle}
          onShowConversations={() => setShowConversationsModal(true)}
          hasMessages={messages.length > 0}
          onNewMessage={newConversation}
          colorScheme={colorScheme ?? 'light'}
        />

        <View style={[styles.content, { paddingBottom: contentPaddingBottom }]}>
          {messages.length > 0 || isLoading ? (
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatContainer}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const showLoader = isLoading && isLastMessage && message.role === 'assistant' && message.content === '';
                if (showLoader) {
                  return <AILoadingIndicator key={message.id} colorScheme={colorScheme ?? 'light'} />;
                }
                return (
                  <AIMessage
                    key={message.id}
                    message={message}
                    colorScheme={colorScheme ?? 'light'}
                    onAddToCalendar={async (dp: DraftPlan) => {
                      const plan = draftPlanToPlan(dp);
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
              onRemoveFile={(fileId) => setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))}
              colorScheme={colorScheme ?? 'light'}
            />
          )}

          {messages.length > 0 && (
            <AIInput
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              attachedFiles={attachedFiles}
              onRemoveFile={(fileId) => setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))}
              placeholder="Continuer la conversation..."
              colorScheme={colorScheme ?? 'light'}
            />
          )}
        </View>

        <ConversationsModal
          visible={showConversationsModal}
          onClose={() => setShowConversationsModal(false)}
          onSelectConversation={selectConversation}
          currentConversationId={conversationId}
          colorScheme={colorScheme ?? 'light'}
          onCurrentConversationDeleted={clearCurrentConversation}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 16 },
  chatContainer: { flex: 1, marginBottom: 16 },
  chatContent: { paddingTop: 16, paddingBottom: 16, paddingRight: 8 },
});
