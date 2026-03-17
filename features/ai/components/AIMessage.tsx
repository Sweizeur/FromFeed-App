import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Colors, darkColor } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import DraftPlanCard from './DraftPlanCard';
import MarkdownText from './MarkdownText';

const userBubbleColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#3a3b3d' : darkColor);

interface DraftPlanActivity {
  placeName: string;
  placeId: string;
  order: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

interface DraftPlan {
  date: string;
  title: string | null;
  notes: string | null;
  activities: DraftPlanActivity[];
  isValidated?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  draftPlan?: DraftPlan;
}

interface AIMessageProps {
  message: Message;
  onAddToCalendar: (draftPlan: DraftPlan) => void | Promise<void>;
  colorScheme?: 'light' | 'dark';
}

export default function AIMessage({ message, onAddToCalendar, colorScheme = 'light' }: AIMessageProps) {
  const isUser = message.role === 'user';
  const theme = Colors[colorScheme];
  const surface = theme.surface;
  const userBubble = userBubbleColor(colorScheme);
  const aiTextColor = theme.text;
  const muted = theme.icon;

  return (
    <View
      style={
        isUser
          ? styles.userMessageContainer
          : styles.aiMessageContainer
      }
    >
      {!isUser && (
        <View style={styles.aiMessageLabelRow}>
          <IconSymbol name="sparkles" size={12} color={muted} style={styles.aiMessageLabelIcon} />
          <Text style={[styles.aiMessageLabel, { color: muted }]} numberOfLines={1}>
            Assistant FromFeed
          </Text>
        </View>
      )}
      <View
        style={[
          isUser ? styles.userMessageBubble : styles.aiMessageBubble,
          isUser
            ? { backgroundColor: userBubble }
            : {
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: theme.border,
              },
        ]}
      >
        {message.content && (
          <MarkdownText
            text={message.content}
            style={[
              isUser ? styles.userMessageText : styles.aiMessageText,
              !isUser && { color: aiTextColor },
            ]}
          />
        )}
        
        {message.draftPlan && (
          <DraftPlanCard
            draftPlan={message.draftPlan}
            onAddToCalendar={onAddToCalendar}
            colorScheme={colorScheme}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  aiMessageContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  aiMessageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  aiMessageLabelIcon: {
    width: 12,
    height: 12,
  },
  aiMessageLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  userMessageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomRightRadius: 4,
  },
  aiMessageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 4,
  },
  userMessageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  aiMessageText: {
    fontSize: 15,
    lineHeight: 20,
  },
});

