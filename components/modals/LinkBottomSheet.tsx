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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColor, darkColorWithAlpha } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { analyzeLink } from '@/lib/api';
import { LinkPreviewResponse } from '@/types/api';

interface LinkBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  linkInput: string;
  onLinkInputChange: (text: string) => void;
  onSaveLink?: (result: LinkPreviewResponse) => void;
  onError?: (error: Error) => void;
  onStartProcessing?: () => void; // Callback appelé avant le début du traitement
}

export default function LinkBottomSheet({
  visible,
  onClose,
  linkInput,
  onLinkInputChange,
  onSaveLink,
  onError,
  onStartProcessing,
}: LinkBottomSheetProps) {
  const insets = useSafeAreaInsets();
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
          <View style={styles.bottomSheetGrabber} />

          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>Ajouter un lien</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.bottomSheetCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.bottomSheetContent}>
            {/* Overlay de chargement */}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#1A1A1A" />
                  <Text style={styles.loadingText}>Analyse du lien en cours...</Text>
                  <Text style={styles.loadingSubtext}>
                    Extraction des informations du lieu
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.bottomSheetInputContainer}>
              <Ionicons
                name="link-outline"
                size={20}
                color="#999"
                style={styles.bottomSheetInputIcon}
              />
              <TextInput
                style={styles.bottomSheetInput}
                placeholder="Collez votre lien TikTok, Instagram..."
                placeholderTextColor="#999"
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
                
                // Notifier le parent que le traitement commence (pour afficher le skeleton)
                if (onStartProcessing) {
                  onStartProcessing();
                }

                try {
                  const result = await analyzeLink(linkInput.trim());

                  // Vérifier si c'est une réponse de traitement asynchrone
                  if (result && 'processing' in result && result.processing === true) {
                    // Le traitement est en cours en arrière-plan
                    // Appeler le callback avec le statut de traitement
                    if (onSaveLink) {
                      onSaveLink({ processing: true, message: result.message });
                    }

                    // Fermer le bottom sheet
                    onClose();
                    // Réinitialiser l'input après un court délai
                    setTimeout(() => {
                      onLinkInputChange('');
                    }, 300);
                    setIsLoading(false);
                    return;
                  }

                  // Ancien format de réponse (pour compatibilité)
                  // Vérifier si aucune information utile n'a été récupérée
                  const hasNoLLMInfo = !result.llm || 
                    (result.llm.confidence === 'low' && 
                     !result.llm.placeName && 
                     !result.llm.address && 
                     !result.llm.city &&
                     !result.llm.country);
                  
                  const hasNoEnrichment = !result.osm && !result.google;
                  
                  // Si pas d'info LLM ET pas d'enrichissement, on considère qu'il n'y a rien
                  if (hasNoLLMInfo && hasNoEnrichment) {
                    const errorMessage = 'Impossible d\'extraire des informations de ce lien. Veuillez vérifier que le lien est valide et contient des informations sur un lieu, puis réessayer.';
                    if (onError) {
                      onError(new Error(errorMessage));
                    }
                    setIsLoading(false);
                    return;
                  }

                  // Appeler le callback avec le résultat (asynchrone)
                  if (onSaveLink) {
                    // Ne pas attendre la fin du traitement pour fermer le modal
                    // Le skeleton restera affiché jusqu'à la fin du traitement
                    onSaveLink(result).catch((err) => {
                      // L'erreur sera gérée dans onError si nécessaire
                      console.error('[LinkBottomSheet] Erreur dans onSaveLink:', err);
                    });
                  }

                  // Fermer le bottom sheet immédiatement (le skeleton reste affiché)
                  onClose();
                  // Réinitialiser l'input après un court délai
                  setTimeout(() => {
                    onLinkInputChange('');
                  }, 300);
                } catch (err: any) {
                  const errorMessage = err.message || 'Une erreur est survenue lors de l\'analyse du lien.';
                  
                  // Appeler le callback d'erreur si fourni (affichera le toast)
                  if (onError) {
                    onError(new Error(errorMessage));
                  }
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
    backgroundColor: '#fff',
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
    backgroundColor: '#E0E0E0',
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
    color: darkColor,
    letterSpacing: -0.5,
  },
  bottomSheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  bottomSheetInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  bottomSheetInputIcon: {
    marginRight: 12,
  },
  bottomSheetInput: {
    flex: 1,
    fontSize: 16,
    color: darkColor,
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
    color: '#1A1A1A',
    marginTop: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

