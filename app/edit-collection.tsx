import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ScrollView,
  TextInput,
  useColorScheme,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, darkColor, darkColorWithAlpha } from '@/constants/theme';
import { getCollection } from '@/lib/api';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import EmojiPicker from 'rn-emoji-keyboard';
import type { EmojiType } from 'rn-emoji-keyboard';

interface MockFriend {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarColor: string;
}

const MOCK_FRIENDS: MockFriend[] = [
  { id: '1', name: 'Marie Dupont', username: '@marie.dpt', avatar: 'MD', avatarColor: '#5856D6' },
  { id: '2', name: 'Lucas Martin', username: '@lucas_m', avatar: 'LM', avatarColor: '#FF9500' },
  { id: '3', name: 'Chloé Bernard', username: '@chloe.b', avatar: 'CB', avatarColor: '#FF2D55' },
  { id: '4', name: 'Thomas Petit', username: '@tom_petit', avatar: 'TP', avatarColor: '#34C759' },
  { id: '5', name: 'Emma Leroy', username: '@emma.leroy', avatar: 'EL', avatarColor: '#007AFF' },
];

export default function EditCollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📁');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const { optimisticUpdate } = useCollectionsStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharedFriendIds, setSharedFriendIds] = useState<string[]>([]);

  const toggleFriend = useCallback((friendId: string) => {
    setSharedFriendIds((prev) =>
      prev.includes(friendId) ? prev.filter((f) => f !== friendId) : [...prev, friendId]
    );
  }, []);

  const inputBg = isDark ? '#252628' : '#F5F5F5';
  const inputBorder = isDark ? '#3C3E40' : '#E8E8E8';
  const subtextColor = isDark ? theme.icon : '#666';

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await getCollection(id);
        const col = res.collection;
        const match = col.name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*(.*)$/u);
        setSelectedEmoji(match ? match[1] : '📁');
        setName(match ? match[2] : col.name);
        setDescription(col.description ?? '');
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSave = useCallback(() => {
    if (!id || !name.trim()) return;
    optimisticUpdate(id, {
      name: `${selectedEmoji} ${name.trim()}`,
      description: description.trim() || undefined,
      isPrivate: sharedFriendIds.length === 0,
    });
    router.back();
  }, [id, selectedEmoji, name, description, sharedFriendIds.length, router, optimisticUpdate]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Modifier la collection</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.nameRow}>
            <View>
              <Text style={[styles.label, { color: theme.text }]}>Emoji</Text>
              <TouchableOpacity
                style={[styles.emojiBox, { backgroundColor: inputBg, borderColor: inputBorder }]}
                onPress={() => setEmojiPickerOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.emojiBoxText}>{selectedEmoji}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.nameCol}>
              <Text style={[styles.label, { color: theme.text }]}>Nom</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text }]}
                placeholder="Ex: Restos favoris"
                placeholderTextColor={subtextColor}
                value={name}
                onChangeText={setName}
                autoCapitalize="sentences"
                returnKeyType="next"
              />
            </View>
          </View>

          <Text style={[styles.label, { color: theme.text }]}>
            Description <Text style={[styles.labelOptional, { color: subtextColor }]}>(optionnel)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.text }]}
            placeholder="Une petite description..."
            placeholderTextColor={subtextColor}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <View style={[styles.friendsSection, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <View style={styles.friendsSectionHeader}>
                <Ionicons name="people" size={20} color={theme.text} />
                <View style={styles.friendsSectionTextCol}>
                  <Text style={[styles.friendsSectionTitle, { color: theme.text }]}>Partager avec</Text>
                  <Text style={[styles.friendsSectionSubtitle, { color: subtextColor }]}>
                    {sharedFriendIds.length > 0 ? `${sharedFriendIds.length} ami${sharedFriendIds.length > 1 ? 's' : ''} sélectionné${sharedFriendIds.length > 1 ? 's' : ''}` : 'Aucun ami sélectionné'}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.friendsScroll}
                style={styles.friendsScrollView}
              >
                {MOCK_FRIENDS.map((friend) => {
                  const added = sharedFriendIds.includes(friend.id);
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={styles.friendChip}
                      onPress={() => toggleFriend(friend.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.friendAvatar, { backgroundColor: friend.avatarColor }, added && styles.friendAvatarSelected]}>
                        {added ? (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        ) : (
                          <Text style={styles.friendAvatarText}>{friend.avatar}</Text>
                        )}
                      </View>
                      <Text style={[styles.friendChipName, { color: theme.text }]} numberOfLines={1}>{friend.name.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !name.trim() && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <EmojiPicker
        onEmojiSelected={(emoji: EmojiType) => setSelectedEmoji(emoji.emoji)}
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        theme={{
          backdrop: darkColorWithAlpha(0.4),
          knob: isDark ? '#555' : '#E0E0E0',
          container: isDark ? '#1C1D1E' : '#fff',
          header: isDark ? theme.text : darkColor,
          category: {
            icon: isDark ? theme.icon : '#666',
            iconActive: isDark ? theme.text : darkColor,
            container: isDark ? '#1C1D1E' : '#fff',
            containerActive: isDark ? '#333' : '#F0F0F0',
          },
          search: {
            text: isDark ? theme.text : darkColor,
            placeholder: isDark ? theme.icon : '#999',
            icon: isDark ? theme.icon : '#999',
            background: isDark ? '#252628' : '#F5F5F5',
          },
        }}
        enableSearchBar
        categoryPosition="top"
        enableRecentlyUsed
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  labelOptional: { fontWeight: '400' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  nameCol: { flex: 1 },
  emojiBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBoxText: { fontSize: 24 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  inputMultiline: { minHeight: 80, paddingTop: 14 },
  friendsSection: {
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
  },
  friendsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendsSectionTextCol: { flex: 1 },
  friendsSectionTitle: { fontSize: 16, fontWeight: '600' },
  friendsSectionSubtitle: { fontSize: 13, marginTop: 2 },
  friendsScrollView: { marginTop: 14, marginHorizontal: -4 },
  friendsScroll: { gap: 14, paddingHorizontal: 4 },
  friendChip: { alignItems: 'center', width: 56 },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarSelected: { borderWidth: 2, borderColor: '#34C759' },
  friendAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  friendChipName: { fontSize: 11, fontWeight: '500', marginTop: 5, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: darkColor,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
  },
  primaryBtnDisabled: { backgroundColor: '#CCC' },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
