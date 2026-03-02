import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Keyboard, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
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
  colorScheme?: 'light' | 'dark';
}

const surfaceColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#2C2E30' : '#FAFAFA');
const borderColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#3a3b3d' : '#F0F0F0');
const mutedColor = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#9BA1A6' : '#666');

export default function AIEmptyState({
  prompt,
  onPromptChange,
  onSubmit,
  isLoading,
  suggestions,
  onSuggestionPress,
  attachedFiles = [],
  onRemoveFile,
  colorScheme = 'light',
}: AIEmptyStateProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const textColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.text;
  const muted = mutedColor(colorScheme);
  const surface = surfaceColor(colorScheme);
  const border = borderColor(colorScheme);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const subHide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return (
    <View style={[styles.emptyStateContainer, keyboardVisible && styles.emptyStateContainerKeyboardOpen]}>
      <View style={styles.headerTextContainer}>
        <Text style={[styles.emptyStateTitle, { color: textColor }]}>Organisez. Découvrez. Planifiez.</Text>
        <Text style={[styles.emptyStateSubtitle, { color: muted }]}>
          Organisez vos journées, trouvez des restaurants, notez vos lieux préférés et créez des plannings personnalisés en quelques mots
        </Text>
      </View>

      <View style={[styles.bottomSection, keyboardVisible && styles.bottomSectionKeyboardOpen]}>
        <AIInput
          prompt={prompt}
          onPromptChange={onPromptChange}
          onSubmit={onSubmit}
          isLoading={isLoading}
          attachedFiles={attachedFiles}
          onRemoveFile={onRemoveFile}
          placeholder="Posez votre question..."
          colorScheme={colorScheme}
        />

        {!keyboardVisible && (
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, index) => {
              const truncatedSuggestion = suggestion.length > 20 
                ? suggestion.substring(0, 20) + '...' 
                : suggestion;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.suggestionChip, { backgroundColor: surface, borderColor: border }]}
                  onPress={() => onSuggestionPress(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.suggestionChipText, { color: muted }]} numberOfLines={1}>
                    {truncatedSuggestion}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        )}
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
  /** Quand le clavier est ouvert : pas de padding en bas pour que l'input soit au même niveau qu'en conversation */
  emptyStateContainerKeyboardOpen: {
    paddingBottom: 0,
  },
  headerTextContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 32,
  },
  emptyStateTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  bottomSectionKeyboardOpen: {
    paddingBottom: 0,
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
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});

