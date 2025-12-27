import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkColor } from '@/constants/theme';

interface PlaceInfoSectionProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  actionIcon?: string;
  onActionPress?: () => void;
}

export default function PlaceInfoSection({
  icon,
  title,
  children,
  actionLabel,
  actionIcon,
  onActionPress,
}: PlaceInfoSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={20} color="#666" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
      {actionLabel && onActionPress && (
        <TouchableOpacity onPress={onActionPress} style={styles.actionButton}>
          {actionIcon && (
            <Ionicons name={actionIcon as any} size={16} color="#007AFF" />
          )}
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: darkColor,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});

