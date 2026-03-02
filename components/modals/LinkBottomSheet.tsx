import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, darkColor, darkColorWithAlpha } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { createLinkPreviewTask } from '@/lib/api';
import { LinkPreviewResponse } from '@/types/api';

interface LinkBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  linkInput: string;
  onLinkInputChange: (text: string) => void;
  /** Appelé quand une tâche est créée (job async). Le parent stocke taskId et poll getTaskStatus. */
  onTaskCreated?: (taskId: string) => void;
  onSaveLink?: (result: LinkPreviewResponse) => void;
  onError?: (error: Error) => void;
  onStartProcessing?: () => void;
}

export default function LinkBottomSheet({
  visible,
  onClose,
  linkInput,
  onLinkInputChange,
  onTaskCreated,
  onSaveLink,
  onError,
  onStartProcessing,
}: LinkBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && sheetHeight > 0) {
      // Animer vers l'état ouvert : partir de la position fermée
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
      keyboardOffset.value = 0;
    } else if (!visible && sheetHeight > 0) {
      // Animer vers l'état fermé
      translateY.value = withTiming(sheetHeight, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
      keyboardOffset.value = withTiming(0, { duration: 200 });
    }
  }, [visible, sheetHeight]);

  // Écouter les événements du clavier
  useEffect(() => {
    if (!visible) return;

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        keyboardOffset.value = withTiming(-e.endCoordinates.height, {
          duration: e.duration || 250,
        });
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardOffset.value = withTiming(0, { duration: 250 });
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY > 100 || event.velocityY > 500) {
        translateY.value = withSpring(sheetHeight, {
          damping: 20,
          stiffness: 300,
        });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + keyboardOffset.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View 
      style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} 
      pointerEvents={visible ? "box-none" : "none"}
    >
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: darkColorWithAlpha(0.4) },
            animatedOverlayStyle,
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Bottom Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.bottomSheet,
            { backgroundColor: theme.surface, shadowColor: isDark ? '#000' : darkColor },
            { paddingBottom: insets.bottom + 20 },
            animatedSheetStyle,
          ]}
          onLayout={(e) => {
            const height = e.nativeEvent.layout.height;
            if (height > 0 && height !== sheetHeight) {
              setSheetHeight(height);
              // Initialiser à la position fermée si le sheet n'est pas visible
              if (!visible) {
                translateY.value = height;
                opacity.value = 0;
              } else {
                // Si visible, animer depuis la position fermée vers ouverte
                translateY.value = height;
                translateY.value = withTiming(0, { duration: 300 });
                opacity.value = withTiming(1, { duration: 300 });
              }
            }
          }}
        >
          {/* Grabber */}
          <View style={[styles.bottomSheetGrabber, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Ajouter un lien</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.bottomSheetCloseButton, { backgroundColor: theme.background, borderColor: theme.border }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={theme.icon} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.bottomSheetContent}>
            {/* Overlay de chargement */}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.text} />
                  <Text style={[styles.loadingText, { color: theme.text }]}>Analyse du lien en cours...</Text>
                  <Text style={[styles.loadingSubtext, { color: theme.icon }]}>
                    Extraction des informations du lieu
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.bottomSheetInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons
                name="link-outline"
                size={20}
                color={theme.icon}
                style={styles.bottomSheetInputIcon}
              />
              <TextInput
                style={[styles.bottomSheetInput, { color: theme.text }]}
                placeholder="Collez votre lien TikTok, Instagram..."
                placeholderTextColor={theme.icon}
                value={linkInput}
                onChangeText={(text) => {
                  onLinkInputChange(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus={visible}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.bottomSheetButton,
                (!linkInput.trim() || isLoading) && styles.bottomSheetButtonDisabled,
              ]}
              onPress={async () => {
                if (!linkInput.trim() || isLoading) return;

                setIsLoading(true);
                if (onStartProcessing) onStartProcessing();

                try {
                  const response = await createLinkPreviewTask(linkInput.trim());
                  if (response?.taskId) {
                    if (onTaskCreated) onTaskCreated(response.taskId);
                    onClose();
                    setTimeout(() => onLinkInputChange(''), 300);
                  } else {
                    if (onError) onError(new Error('Impossible de lancer l\'analyse du lien.'));
                  }
                } catch (err: any) {
                  const errorMessage = err.message || 'Une erreur est survenue lors de l\'analyse du lien.';
                  if (onError) onError(new Error(errorMessage));
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={!linkInput.trim() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.bottomSheetButtonText,
                    (!linkInput.trim() || isLoading) && styles.bottomSheetButtonTextDisabled,
                  ]}
                >
                  Ajouter
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: darkColor,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 20,
    elevation: 15,
    maxHeight: '80%',
    zIndex: 1001,
  },
  bottomSheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  bottomSheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  bottomSheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  bottomSheetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  bottomSheetInputIcon: {
    marginRight: 12,
  },
  bottomSheetInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  bottomSheetButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  bottomSheetButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  bottomSheetButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  bottomSheetButtonTextDisabled: {
    color: '#999',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

