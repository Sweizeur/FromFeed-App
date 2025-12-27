import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkColor } from '@/constants/theme';

interface AttachedFile {
  id: string;
  name: string;
  uri?: string;
}

interface AIInputProps {
  prompt: string;
  onPromptChange: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  attachedFiles?: AttachedFile[];
  onRemoveFile?: (fileId: string) => void;
  placeholder?: string;
}

export default function AIInput({
  prompt,
  onPromptChange,
  onSubmit,
  isLoading,
  attachedFiles = [],
  onRemoveFile,
  placeholder = "Posez votre question...",
}: AIInputProps) {
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  return (
    <View style={styles.inputFormContainer}>
      {attachedFiles.length > 0 && (
        <View style={styles.attachedFilesContainer}>
          {attachedFiles.map((file) => (
            <View key={file.id} style={styles.fileBadge}>
              <Ionicons name="attach" size={12} color={darkColor} style={styles.fileBadgeIcon} />
              <Text style={styles.fileBadgeText} numberOfLines={1}>
                {file.name}
              </Text>
              {onRemoveFile && (
                <TouchableOpacity
                  onPress={() => onRemoveFile(file.id)}
                  style={styles.fileBadgeClose}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Ionicons name="close" size={12} color={darkColor} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
      
      <TextInput
        style={styles.inputTextArea}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={prompt}
        onChangeText={onPromptChange}
        multiline
        maxLength={500}
        textAlignVertical="top"
        editable={!isLoading}
        onSubmitEditing={onSubmit}
      />

      <View style={styles.inputActionsRow}>
        <View style={styles.inputActionsLeft}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setShowSettingsMenu(false);
              setShowActionsMenu(!showActionsMenu);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color={darkColor} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setShowActionsMenu(false);
              setShowSettingsMenu(!showSettingsMenu);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="options" size={16} color={darkColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputActionsRight}>
          <TouchableOpacity
            style={[
              styles.sendButtonNew,
              (!prompt.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={onSubmit}
            disabled={!prompt.trim() || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <Ionicons name="hourglass" size={16} color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu Actions Dropdown */}
      {showActionsMenu && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity
            style={styles.dropdownMenuItem}
            onPress={() => setShowActionsMenu(false)}
          >
            <Ionicons name="attach" size={16} color="#666" />
            <Text style={styles.dropdownMenuItemText}>Attach Files</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownMenuItem}
            onPress={() => setShowActionsMenu(false)}
          >
            <Ionicons name="link" size={16} color="#666" />
            <Text style={styles.dropdownMenuItemText}>Import from URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownMenuItem}
            onPress={() => setShowActionsMenu(false)}
          >
            <Ionicons name="clipboard-outline" size={16} color="#666" />
            <Text style={styles.dropdownMenuItemText}>Paste from Clipboard</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu Settings Dropdown */}
      {showSettingsMenu && (
        <View style={styles.dropdownMenu}>
          <View style={styles.dropdownMenuItem}>
            <Ionicons name="sparkles" size={16} color="#666" />
            <Text style={styles.dropdownMenuItemText}>Auto-complete</Text>
            <View style={styles.switchContainer}>
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ false: '#E5E5E5', true: darkColor }}
                thumbColor="#fff"
              />
            </View>
          </View>
          <View style={styles.dropdownMenuItem}>
            <Ionicons name="play-outline" size={16} color="#666" />
            <Text style={styles.dropdownMenuItemText}>Streaming</Text>
            <View style={styles.switchContainer}>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: '#E5E5E5', true: darkColor }}
                thumbColor="#fff"
              />
            </View>
          </View>
          <View style={styles.dropdownMenuItem}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.dropdownMenuItemText}>Show History</Text>
            <View style={styles.switchContainer}>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: '#E5E5E5', true: darkColor }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputFormContainer: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 8,
    backgroundColor: '#fff',
    gap: 8,
    flexShrink: 0,
    position: 'relative',
  },
  attachedFilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  fileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    maxWidth: 120,
    gap: 4,
  },
  fileBadgeIcon: {
    marginRight: 2,
  },
  fileBadgeText: {
    fontSize: 12,
    color: darkColor,
    flex: 1,
  },
  fileBadgeClose: {
    padding: 2,
  },
  inputTextArea: {
    minHeight: 48,
    maxHeight: 120,
    fontSize: 14,
    color: darkColor,
    padding: 0,
    textAlignVertical: 'top',
  },
  inputActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  inputActionsLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputActionsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  sendButtonNew: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: darkColor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  dropdownMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingVertical: 8,
    marginBottom: 8,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dropdownMenuItemText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  switchContainer: {
    marginLeft: 'auto',
  },
});

