import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { getConversation } from '@/lib/api';
import type { Plan, PlanActivity } from '@/types/api';
import { getPlaceDetails } from '@/lib/api';

const CONVERSATION_ID_KEY = '@fromfeed:current_conversation_id';
const getConversationMessagesKey = (id: string) => `@fromfeed:conversation_messages_${id}`;
const getConversationTitleKey = (id: string) => `@fromfeed:conversation_title_${id}`;

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  draftPlan?: DraftPlan;
}

export interface DraftPlan {
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
  isValidated?: boolean;
}

export function toDateOnly(dateStr: string): string {
  const part = dateStr.split('T')[0];
  return part && /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : dateStr;
}

export function draftPlanToPlan(draft: DraftPlan): Plan {
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

export async function enrichPlanWithPlaceDetails(plan: Plan): Promise<Plan> {
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
    activities: plan.activities.map((a) => ({
      ...a,
      place: detailsByPlaceId.get(a.placeId) ?? a.place,
    })),
  };
}

export function extractDraftPlan(content: string): { cleanContent: string; draftPlan?: DraftPlan } {
  const draftPlanRegex = /<!-- DRAFT_PLAN:(.+?) -->/s;
  const match = content.match(draftPlanRegex);

  if (match && match[1]) {
    try {
      const draftPlan: DraftPlan = JSON.parse(match[1]);
      const cleanContent = content.replace(draftPlanRegex, '').trim();
      return { cleanContent, draftPlan };
    } catch (e) {
      __DEV__ && console.error('[AIConversation] Erreur parsing draft plan:', e);
    }
  }

  return { cleanContent: content };
}

export function useAIConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const conversationTitleRef = useRef<string | null>(null);

  const titleOpacity = useSharedValue(1);
  const titleScale = useSharedValue(1);

  useEffect(() => {
    conversationTitleRef.current = conversationTitle;
  }, [conversationTitle]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const animateTitleChange = useCallback(
    (newTitle: string | null) => {
      titleOpacity.value = withSequence(
        withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) })
      );
      titleScale.value = withSequence(
        withTiming(0.9, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) })
      );
      setTimeout(() => setConversationTitle(newTitle), 200);
    },
    [titleOpacity, titleScale]
  );

  // Load persisted conversation on mount
  useEffect(() => {
    (async () => {
      try {
        const savedId = await AsyncStorage.getItem(CONVERSATION_ID_KEY);
        if (savedId) {
          setConversationId(savedId);
          try {
            const cached = await AsyncStorage.getItem(getConversationMessagesKey(savedId));
            if (cached) {
              const parsed: Message[] = JSON.parse(cached);
              setMessages(parsed.map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) })));
            }
            const cachedTitle = await AsyncStorage.getItem(getConversationTitleKey(savedId));
            if (cachedTitle) setConversationTitle(cachedTitle);
          } catch (e) {
            __DEV__ && console.error('[AIConversation] Cache load error:', e);
          }
        }
      } catch (e) {
        __DEV__ && console.error('[AIConversation] Load conversation error:', e);
      }
    })();
  }, []);

  // Fetch fresh messages from API after cache is displayed
  useEffect(() => {
    const loadFromApi = async () => {
      if (conversationId) {
        try {
          const result = await getConversation(conversationId);
          if (result?.success && result.conversation) {
            if (result.conversation.messages) {
              const formatted: Message[] = result.conversation.messages.map((msg) => {
                const { cleanContent, draftPlan } = extractDraftPlan(msg.content);
                return {
                  id: msg.id || Date.now().toString() + Math.random(),
                  role: msg.role,
                  content: cleanContent,
                  timestamp: new Date(msg.createdAt || Date.now()),
                  draftPlan,
                };
              });
              setMessages(formatted);
              try {
                await AsyncStorage.setItem(getConversationMessagesKey(conversationId), JSON.stringify(formatted));
              } catch {}
            }
            if (result.conversation.title !== conversationTitle) {
              animateTitleChange(result.conversation.title);
              if (result.conversation.title) {
                try {
                  await AsyncStorage.setItem(getConversationTitleKey(conversationId), result.conversation.title);
                } catch {}
              }
            }
          }
        } catch (e) {
          __DEV__ && console.error('[AIConversation] API load error:', e);
        }
      } else {
        setMessages([]);
        animateTitleChange(null);
      }
    };

    const timeoutId = setTimeout(loadFromApi, 100);
    return () => clearTimeout(timeoutId);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectConversation = useCallback(
    async (selectedId: string) => {
      try {
        const cached = await AsyncStorage.getItem(getConversationMessagesKey(selectedId));
        if (cached) {
          const parsed: Message[] = JSON.parse(cached);
          setMessages(parsed.map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) })));
        } else {
          setMessages([]);
        }
        const cachedTitle = await AsyncStorage.getItem(getConversationTitleKey(selectedId));
        setConversationTitle(cachedTitle || null);
      } catch {}

      setConversationId(selectedId);
      try {
        await AsyncStorage.setItem(CONVERSATION_ID_KEY, selectedId);
      } catch {}
    },
    []
  );

  const newConversation = useCallback(async () => {
    const oldId = conversationId;
    setMessages([]);
    setConversationId(undefined);
    animateTitleChange(null);
    try {
      await AsyncStorage.removeItem(CONVERSATION_ID_KEY);
      if (oldId) {
        await AsyncStorage.removeItem(getConversationMessagesKey(oldId));
        await AsyncStorage.removeItem(getConversationTitleKey(oldId));
      }
    } catch {}
  }, [conversationId, animateTitleChange]);

  const clearCurrentConversation = useCallback(async () => {
    const deletedId = conversationId;
    setMessages([]);
    setConversationId(undefined);
    animateTitleChange(null);
    try {
      await AsyncStorage.removeItem(CONVERSATION_ID_KEY);
      if (deletedId) {
        await AsyncStorage.removeItem(getConversationMessagesKey(deletedId));
        await AsyncStorage.removeItem(getConversationTitleKey(deletedId));
      }
    } catch {}
  }, [conversationId, animateTitleChange]);

  const cacheMessages = useCallback(
    async (msgs: Message[], convId?: string) => {
      const id = convId || conversationId;
      if (!id) return;
      try {
        await AsyncStorage.setItem(getConversationMessagesKey(id), JSON.stringify(msgs));
      } catch {}
    },
    [conversationId]
  );

  const persistConversationId = useCallback(async (newId: string) => {
    setConversationId(newId);
    try {
      await AsyncStorage.setItem(CONVERSATION_ID_KEY, newId);
    } catch {}
  }, []);

  return {
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
  };
}
