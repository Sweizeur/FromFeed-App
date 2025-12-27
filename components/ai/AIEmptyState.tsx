import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { darkColor } from '@/constants/theme';
import AIInput from './AIInput';

interface AttachedFile {
  id: string;
  name: string;
  uri?: string;
}

interface AIEmptyStateProps {
  prompt: string;
  onPromptChange: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  suggestions: string[];
  onSuggestionPress: (suggestion: string) => void;
  attachedFiles?: AttachedFile[];
  onRemoveFile?: (fileId: string) => void;
}

export default function AIEmptyState({
  prompt,
  onPromptChange,
  onSubmit,
  isLoading,
  suggestions,
  onSuggestionPress,
  attachedFiles = [],
  onRemoveFile,
}: AIEmptyStateProps) {
  return (
    <View style={styles.emptyStateContainer}>
      <View style={styles.headerTextContainer}>
        <Text style={styles.emptyStateTitle}>Demandez. Créez. Explorez.</Text>
        <Text style={styles.emptyStateSubtitle}>
          Créez des plans personnalisés simplement en décrivant ce que vous voulez
        </Text>
      </View>

      <View style={styles.bottomSection}>
        <AIInput
          prompt={prompt}
          onPromptChange={onPromptChange}
          onSubmit={onSubmit}
          isLoading={isLoading}
          attachedFiles={attachedFiles}
          onRemoveFile={onRemoveFile}
          placeholder="Posez votre question..."
        />

        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, index) => {
              const truncatedSuggestion = suggestion.length > 20 
                ? suggestion.substring(0, 20) + '...' 
                : suggestion;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => onSuggestionPress(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionChipText} numberOfLines={1}>
                    {truncatedSuggestion}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    width: '100%',
  },
  headerTextContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 32,
  },
  emptyStateTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: darkColor,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  suggestionsSection: {
    width: '100%',
    paddingTop: 0,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  suggestionChip: {
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  suggestionChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});

