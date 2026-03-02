import React, { useState, useEffect } from 'react';
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
  ScrollView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, darkColor, darkColorWithAlpha } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { createGroup } from '@/lib/api';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateGroupModal({
  visible,
  onClose,
  onSuccess,
}: CreateGroupModalProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [shouldRender, setShouldRender] = useState(false);

  // Gérer le rendu du composant
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && sheetHeight > 0) {
      // Ne pas animer si déjà à la position ouverte
      if (translateY.value !== 0) {
        translateY.value = withTiming(0, { duration: 300 });
        opacity.value = withTiming(1, { duration: 300 });
      }
      keyboardOffset.value = 0;
    } else if (!visible && sheetHeight > 0) {
      translateY.value = withTiming(sheetHeight, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }, () => {
        runOnJS(setShouldRender)(false);
      });
      keyboardOffset.value = withTiming(0, { duration: 200 });
    }
  }, [visible, sheetHeight]);

  // Réinitialiser le formulaire quand on ferme
  useEffect(() => {
    if (!visible) {
      setName('');
    }
  }, [visible]);

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
        if (sheetHeight > 0) {
          translateY.value = withSpring(sheetHeight, {
            damping: 20,
            stiffness: 300,
          });
          opacity.value = withTiming(0, { duration: 200 });
          runOnJS(onClose)();
        } else {
          runOnJS(onClose)();
        }
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value + keyboardOffset.value },
    ],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      setIsLoading(true);
      await createGroup({
        name: name.trim(),
      });
      onSuccess();
      onClose();
    } catch (error) {
      __DEV__ && console.error('[CreateGroupModal] Erreur:', error);
      // TODO: Afficher un toast d'erreur
    } finally {
      setIsLoading(false);
    }
  };

  if (!shouldRender && !visible) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
      pointerEvents={visible ? 'box-none' : 'none'}
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
              const wasInitialMount = sheetHeight === 0;
              setSheetHeight(height);
              if (!visible) {
                translateY.value = height;
                opacity.value = 0;
              } else if (wasInitialMount) {
                // Seulement animer lors du montage initial
                translateY.value = height;
                translateY.value = withTiming(0, { duration: 300 });
                opacity.value = withTiming(1, { duration: 300 });
              }
              // Sinon, le useEffect gérera l'animation
            }
          }}
        >
          {/* Grabber */}
          <View style={[styles.bottomSheetGrabber, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Créer un groupe</Text>
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
            {/* Nom du groupe */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Nom du groupe</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Ex: Ma copine, Les potes..."
                placeholderTextColor={theme.icon}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <Text style={[styles.hintText, { color: theme.icon }]}>
              Vous pourrez ajouter des membres et personnaliser le groupe après la création
            </Text>

            {/* Bouton de soumission */}
            <TouchableOpacity
              style={[styles.submitButton, !name.trim() && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!name.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Créer</Text>
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
    maxHeight: '90%',
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
    paddingTop: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 16,
  },
  emailInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  emailInput: {
    flex: 1,
  },
  addEmailButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emailList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  emailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  emailTagText: {
    fontSize: 13,
  },
  removeEmailButton: {
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: darkColor,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
});

