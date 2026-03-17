import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import type { TextStyle } from 'react-native';

interface AIHeaderProps {
  conversationTitle: string | null;
  titleAnimatedStyle: AnimatedStyle<TextStyle>;
  onShowConversations: () => void;
  hasMessages: boolean;
  onNewMessage: () => void;
  colorScheme?: 'light' | 'dark';
}

export default function AIHeader({
  conversationTitle,
  titleAnimatedStyle,
  onShowConversations,
  hasMessages,
  onNewMessage,
  colorScheme = 'light',
}: AIHeaderProps) {
  const theme = Colors[colorScheme];
  const icon = theme.text;
  const surface = theme.surface;
  const border = theme.border;
  const textColor = theme.text;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.background,
          borderBottomColor: border,
          shadowOpacity: colorScheme === 'dark' ? 0 : 0.06,
        },
      ]}
    >
      <View style={styles.headerLeft}>
        <Animated.Text 
          style={[styles.headerTitle, titleAnimatedStyle, { color: textColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {conversationTitle || 'Assistant IA'}
        </Animated.Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          onPress={onShowConversations}
          style={[styles.conversationsButton, { backgroundColor: surface, borderColor: border }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="time-outline" size={22} color={icon} />
        </TouchableOpacity>
        {hasMessages && (
          <TouchableOpacity
            onPress={onNewMessage}
            style={[styles.newMessageButton, { backgroundColor: surface, borderColor: border }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={22} color={icon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    flex: 1,
    maxWidth: '100%',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversationsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  newMessageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});

