import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

interface AIHeaderProps {
  conversationTitle: string | null;
  titleAnimatedStyle: any;
  onShowConversations: () => void;
  hasMessages: boolean;
  onNewMessage: () => void;
  colorScheme?: 'light' | 'dark';
}

const iconColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? Colors.dark.text : Colors.light.text);
const surfaceColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#2C2E30' : '#F5F5F5');
const borderColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#3a3b3d' : '#EFEFEF');

export default function AIHeader({
  conversationTitle,
  titleAnimatedStyle,
  onShowConversations,
  hasMessages,
  onNewMessage,
  colorScheme = 'light',
}: AIHeaderProps) {
  const icon = iconColor(colorScheme);
  const surface = surfaceColor(colorScheme);
  const border = borderColor(colorScheme);
  const textColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.text;

  return (
    <View style={[styles.header, { borderBottomColor: border }]}>
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
          style={[styles.conversationsButton, { backgroundColor: surface }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="time-outline" size={22} color={icon} />
        </TouchableOpacity>
        {hasMessages && (
          <TouchableOpacity
            onPress={onNewMessage}
            style={[styles.newMessageButton, { backgroundColor: surface }]}
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
  },
  newMessageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

