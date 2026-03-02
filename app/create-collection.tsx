import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  Switch,
  useColorScheme,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, darkColor, darkColorWithAlpha } from '@/constants/theme';
import { getAllPlacesSummary } from '@/lib/api';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import EmojiPicker from 'rn-emoji-keyboard';
import type { EmojiType } from 'rn-emoji-keyboard';
import type { PlaceSummary } from '@/types/api';

type Step = 'info' | 'places';

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

export default function CreateCollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  const { optimisticCreate } = useCollectionsStore();

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🍽️');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharedFriendIds, setSharedFriendIds] = useState<string[]>([]);

  const toggleFriend = useCallback((id: string) => {
    setSharedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);

  useEffect(() => {
    if (step === 'places' && places.length === 0) {
      const load = async () => {
        setLoadingPlaces(true);
        try {
          const res = await getAllPlacesSummary();
          setPlaces(res?.places ?? []);
        } catch { /* silent */ } finally {
          setLoadingPlaces(false);
        }
      };
      load();
    }
  }, [step, places.length]);

  const handleNext = () => setStep('places');
  const handleBack = () => {
    if (step === 'places') {
      setStep('info');
    } else {
      router.back();
    }
  };

  const togglePlace = useCallback((id: string) => {
    setSelectedPlaceIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await optimisticCreate({
        name: `${selectedEmoji} ${name.trim()}`,
        description: description.trim() || undefined,
        isPrivate,
        placeIds: selectedPlaceIds.length > 0 ? selectedPlaceIds : undefined,
      });
      router.back();
    } catch (err) {
      __DEV__ && console.error('[CreateCollection] Error:', err);
    } finally {
      setSaving(false);
    }
  };

  const inputBg = isDark ? '#252628' : '#F5F5F5';
  const inputBorder = isDark ? '#3C3E40' : '#E8E8E8';
  const subtextColor = isDark ? theme.icon : '#666';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {step === 'info' ? 'Nouvelle collection' : 'Ajouter des lieux'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 'info' ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Emoji + Name */}
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

            {/* Description */}
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
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Public/Private */}
            <View style={[styles.toggleRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <View style={styles.toggleInfo}>
                <Ionicons name={isPrivate ? 'lock-closed' : 'globe-outline'} size={20} color={theme.text} />
                <View style={styles.toggleTextContainer}>
                  <Text style={[styles.toggleTitle, { color: theme.text }]}>{isPrivate ? 'Privée' : 'Publique'}</Text>
                  <Text style={[styles.toggleSubtitle, { color: subtextColor }]}>
                    {isPrivate ? 'Visible uniquement par vous' : 'Visible par vos amis'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: '#E0E0E0', true: isDark ? theme.text : darkColor }}
                thumbColor="#fff"
              />
            </View>

            {/* Friends section - visible when public */}
            {!isPrivate && (
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
            )}

            {/* Next button */}
            <TouchableOpacity
              style={[styles.primaryBtn, !name.trim() && styles.primaryBtnDisabled]}
              onPress={handleNext}
              disabled={!name.trim()}
            >
              <Text style={styles.primaryBtnText}>Ajouter des lieux</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleCreate}
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Text style={[styles.skipBtnText, { color: !name.trim() ? subtextColor : theme.text }]}>
                  Créer sans ajouter de lieux
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {loadingPlaces ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.text} />
                  <Text style={[styles.loadingText, { color: subtextColor }]}>Chargement des lieux...</Text>
                </View>
              ) : places.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="location-outline" size={48} color={isDark ? '#555' : '#CCC'} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>Aucun lieu sauvegardé</Text>
                  <Text style={[styles.emptySubtitle, { color: subtextColor }]}>
                    Ajoutez des lieux depuis la carte d'abord
                  </Text>
                </View>
              ) : (
                <View style={styles.placesList}>
                  {selectedPlaceIds.length > 0 && (
                    <Text style={[styles.selectionCount, { color: theme.text }]}>
                      {selectedPlaceIds.length} lieu{selectedPlaceIds.length > 1 ? 'x' : ''} sélectionné{selectedPlaceIds.length > 1 ? 's' : ''}
                    </Text>
                  )}
                  {places.map((place) => {
                    const selected = selectedPlaceIds.includes(place.id);
                    return (
                      <TouchableOpacity
                        key={place.id}
                        style={[
                          styles.placeItem,
                          { backgroundColor: selected ? (isDark ? '#2A2D30' : '#EDF4FF') : inputBg, borderColor: selected ? (isDark ? '#4A8CFF' : '#A8C8FF') : inputBorder },
                        ]}
                        onPress={() => togglePlace(place.id)}
                      >
                        <View style={styles.placeItemRow}>
                          {place.googlePhotoUrl ? (
                            <Image source={{ uri: place.googlePhotoUrl }} style={styles.placeImg} />
                          ) : (
                            <View style={[styles.placeImgPlaceholder, selected && { backgroundColor: isDark ? '#3A3D42' : '#D6E4FF' }]}>
                              <Ionicons name="location" size={18} color={selected ? (isDark ? '#6AA3FF' : '#3B7DDD') : subtextColor} />
                            </View>
                          )}
                          <View style={styles.placeTextContainer}>
                            <Text style={[styles.placeName, { color: theme.text }]} numberOfLines={1}>
                              {place.placeName || place.rawTitle || 'Lieu sans nom'}
                            </Text>
                            <Text style={[styles.placeAddress, { color: subtextColor }]} numberOfLines={1}>
                              {place.googleFormattedAddress || place.address || place.city || ''}
                            </Text>
                          </View>
                        </View>
                        {selected ? <Ionicons name="checkmark-circle" size={20} color={isDark ? '#4A8CFF' : '#3B7DDD'} /> : <Ionicons name="add-circle-outline" size={20} color={subtextColor} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Bottom bar */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, backgroundColor: theme.background, borderTopColor: isDark ? '#2C2E30' : '#EFEFEF' }]}>
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 0 }, saving && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={saving || !name.trim()}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {selectedPlaceIds.length > 0
                      ? `Créer avec ${selectedPlaceIds.length} lieu${selectedPlaceIds.length > 1 ? 'x' : ''}`
                      : 'Créer la collection'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 20,
  },
  labelOptional: {
    fontWeight: '400',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  nameCol: {
    flex: 1,
  },
  emojiBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBoxText: {
    fontSize: 24,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 14,
  },
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
  friendsSectionTextCol: {
    flex: 1,
  },
  friendsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendsSectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  friendsScrollView: {
    marginTop: 14,
    marginHorizontal: -4,
  },
  friendsScroll: {
    gap: 14,
    paddingHorizontal: 4,
  },
  friendChip: {
    alignItems: 'center',
    width: 56,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarSelected: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  friendAvatarText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  friendChipName: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 5,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
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
  primaryBtnDisabled: {
    backgroundColor: '#CCC',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  placesList: {
    gap: 8,
    paddingBottom: 20,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  placeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  placeImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  placeImgPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeTextContainer: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 12,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
