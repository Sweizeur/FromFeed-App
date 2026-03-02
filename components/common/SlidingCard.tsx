import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useAnimatedReaction,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColor } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SlidingCardProps {
  /**
   * Hauteur du header (mesurée via onLayout ou passée manuellement)
   * Si non fournie, sera mesurée via onHeaderLayout
   */
  headerHeight?: number;
  /**
   * Hauteur du header blanc uniquement (pour le snap à 100% qui passe par-dessus le header vert)
   * Si non fournie, utilise headerHeight
   */
  headerWhiteHeight?: number;
  /**
   * Hauteur de la navbar en bas. La carte s'étend jusqu'en bas de l'écran (pas de trou) ;
   * le contenu a un paddingBottom égal pour ne pas être masqué par la navbar.
   * Par défaut: 0
   */
  bottomNavHeight?: number;
  /**
   * Callback appelé quand le header est mesuré
   */
  onHeaderLayout?: (height: number) => void;
  /**
   * Point d'ancrage initial ('min' | 'mid' | 'max')
   * La carte démarre en bas puis s'anime vers cette valeur (conservé pour compat)
   */
  initialSnap?: 'min' | 'mid' | 'max';
  /**
   * Index du point d'ancrage initial dans la liste des pourcentages visibles.
   * Si fourni, a priorité sur initialSnap.
   */
  initialSnapIndex?: number;
  /**
   * Position translateY initiale à restaurer (pour préserver la position entre les remontages)
   * Si fourni, a priorité sur initialSnap et initialSnapIndex.
   */
  restoreTranslateY?: number | null;
  /**
   * Activer la détection de fling (vitesse élevée)
   */
  enableFling?: boolean;
  /**
   * Seuil de vitesse pour le fling (px/s)
   * Par défaut: 300 (plus sensible, change facilement de snap)
   */
  velocityFlingThreshold?: number;
  /**
   * Liste des pourcentages de visibilité (0-100) pour les points d'ancrage.
   * Exemple: [100, 60, 20] => 3 snaps (plein écran, 60%, 20% visible).
   * L'ordre n'a pas d'importance, ils sont triés automatiquement.
   */
  snapPointsVisiblePercents?: number[];
  /**
   * Style personnalisé pour la carte
   */
  style?: any;
  /**
   * Afficher le grabber
   */
  grabber?: boolean;
  /**
   * Contenu de la carte
   */
  children?: React.ReactNode;
  /**
   * testID pour les tests
   */
  testID?: string;
  /**
   * Callback appelé quand la position de la carte change
   * Reçoit la position translateY actuelle et la hauteur de la carte
   */
  onPositionChange?: (translateY: number, cardHeight: number) => void;
  /**
   * Callback appelé quand la carte atteint un snap point (après l'animation)
   * Reçoit la position translateY du snap point atteint et la hauteur de la carte
   */
  onSnapPointReached?: (translateY: number, cardHeight: number) => void;
  /**
   * Ref du ScrollView interne pour gérer les gestes simultanés
   */
  scrollViewRef?: React.RefObject<any>;
}

export interface SlidingCardRef {
  /**
   * Anime la carte vers un snap point spécifique par pourcentage de visibilité
   * @param visiblePercent Pourcentage de visibilité (1-100)
   */
  animateToSnapPoint: (visiblePercent: number) => void;
}

const SlidingCard = forwardRef<SlidingCardRef, SlidingCardProps>(function SlidingCard({
  headerHeight: propHeaderHeight,
  headerWhiteHeight: propHeaderWhiteHeight,
  bottomNavHeight = 0,
  onHeaderLayout,
  initialSnap = 'mid',
  initialSnapIndex,
  restoreTranslateY,
  enableFling = true,
  velocityFlingThreshold = 300,
  snapPointsVisiblePercents,
  style,
  grabber = true,
  children,
  testID = 'sliding-card',
  onPositionChange,
  onSnapPointReached,
  scrollViewRef: propScrollViewRef,
}, ref) {
  const insets = useSafeAreaInsets();
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = React.useState(0);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Calcul de la hauteur du header
  // Si headerHeight est fourni, on l'utilise tel quel (déjà mesuré avec insets si nécessaire)
  // Sinon, on utilise la mesure + insets.top
  const headerH = propHeaderHeight || measuredHeaderHeight;
  // Hauteur totale : si on a mesuré nous-mêmes, on ajoute insets.top
  // Si c'est fourni via prop, on suppose qu'il inclut déjà les insets
  const totalHeaderH = propHeaderHeight 
    ? headerH 
    : headerH + (headerH > 0 ? insets.top : 0);

  // Hauteur du header blanc uniquement (pour le snap à 100% qui passe par-dessus le vert)
  const headerWhiteH = propHeaderWhiteHeight 
    ? (propHeaderWhiteHeight + (propHeaderHeight ? 0 : insets.top))
    : totalHeaderH; // Par défaut, utilise totalHeaderH si non spécifié

  // Hauteur de la carte : pleine hauteur sous le header (carte jusqu'en bas = pas de trou au niveau de la nav)
  const cardH = SCREEN_HEIGHT - headerWhiteH;

  // Snap points (offset Y relatif à la position initiale top: headerWhiteH)
  // La carte commence à top: headerWhiteH et a une hauteur cardH
  // translateY est appliqué en plus de top.
  //
  // Pour chaque pourcentage de visibilité V (0-100), l'offset est :
  //   offset = (1 - V/100) * cardH
  //
  // Exemple avec [100, 60, 20] :
  //   - 100% visible => offset 0 (déjà sous le header blanc)
  //   - 60% visible  => offset 0.4 * cardH
  //   - 20% visible  => offset 0.8 * cardH
  const snapPoints = React.useMemo(() => {
    if (cardH <= 0 || headerWhiteH < 0) {
      // Valeurs par défaut si pas encore calculé
      return [0, SCREEN_HEIGHT * 0.4, SCREEN_HEIGHT * 0.8];
    }
    const basePercents =
      snapPointsVisiblePercents && snapPointsVisiblePercents.length > 0
        ? snapPointsVisiblePercents
        : [100, 90, 50, 25, 4]; // 100% = juste sous le header blanc

    // Clamp les pourcentages entre 1 et 100 et calculer les offsets,
    // puis trier les offsets du plus petit (plus haut) au plus grand (plus bas).
    const offsets = basePercents
      .map((p) => {
        const clamped = Math.max(1, Math.min(100, p));
        if (clamped === 100) {
          // Pour 100% visible : la carte est déjà positionnée sous le header blanc (top: headerWhiteH)
          // Donc l'offset est 0 (pas de déplacement)
          return 0;
        }
        const visibleRatio = clamped / 100;
        const hiddenRatio = 1 - visibleRatio;
        return hiddenRatio * cardH;
      })
      .sort((a, b) => a - b);

    return offsets;
  }, [cardH, headerWhiteH, snapPointsVisiblePercents]);

  // Utiliser le premier et dernier snap point (peu importe le nombre)
  const Ymax = snapPoints.length > 0 ? snapPoints[0] : 0; // Premier (le plus haut)
  const Ymin = snapPoints.length > 0 ? snapPoints[snapPoints.length - 1] : 0; // Dernier (le plus bas)

  // Position animée (offset Y)
  // Si restoreTranslateY est fourni, l'utiliser directement (restauration de position)
  // Sinon, démarrer en bas (Ymin)
  const initialY = restoreTranslateY !== undefined && restoreTranslateY !== null 
    ? restoreTranslateY 
    : (Ymin ?? 0);
  const translateY = useSharedValue(initialY);
  const context = useSharedValue({ y: 0 });
  // Position cible pour l'effet de suivi fluide pendant le drag
  const dragTargetY = useSharedValue(initialY);

  // Callback pour notifier les changements de position
  const notifyPositionChange = React.useCallback((y: number, height: number) => {
    if (onPositionChange) {
      onPositionChange(y, height);
    }
  }, [onPositionChange]);

  // Callback pour notifier qu'un snap point est atteint
  const notifySnapPointReached = React.useCallback((y: number, height: number) => {
    if (onSnapPointReached) {
      onSnapPointReached(y, height);
    }
  }, [onSnapPointReached]);

  // Trouver le snap point le plus proche
  const findNearestSnap = React.useCallback((currentY: number, points: number[]): number => {
    if (points.length === 0) return currentY;
    let nearest = points[0];
    let minDistance = Math.abs(currentY - points[0]);
    for (const point of points) {
      const distance = Math.abs(currentY - point);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }
    return nearest;
  }, []);

  // Exposer une méthode pour animer vers un snap point spécifique
  useImperativeHandle(ref, () => ({
    animateToSnapPoint: (visiblePercent: number) => {
      // Clamp le pourcentage entre 1 et 100
      const clamped = Math.max(1, Math.min(100, visiblePercent));
      
      // Calculer l'offset correspondant
      let targetY: number;
      if (clamped === 100) {
        targetY = 0; // 100% visible = offset 0
      } else {
        const visibleRatio = clamped / 100;
        const hiddenRatio = 1 - visibleRatio;
        targetY = hiddenRatio * cardH;
      }
      
      // Trouver le snap point le plus proche
      const nearestSnap = findNearestSnap(targetY, snapPoints);
      
      // Vérifier la position actuelle de la carte
      const currentY = translateY.value;
      
      // Ne déplacer que si la carte est actuellement en dessous du snap point cible
      // (translateY augmente quand la carte descend, donc currentY > nearestSnap signifie carte plus basse)
      if (currentY > nearestSnap) {
        // Animer vers ce snap point
        translateY.value = withTiming(nearestSnap, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) {
            runOnJS(notifySnapPointReached)(nearestSnap, cardH);
          }
        });
      }
      // Sinon, la carte est déjà au-dessus ou au niveau du snap point, on ne fait rien
    },
  }), [cardH, snapPoints, notifySnapPointReached, findNearestSnap]);

  // Réagir aux changements de position pour notifier le parent
  // Utiliser un throttling pour réduire les appels JS (améliore les FPS)
  // Initialiser avec la même valeur que translateY (sans utiliser .value pour éviter le warning)
  const lastNotifiedY = useSharedValue(initialY);
  useAnimatedReaction(
    () => translateY.value,
    (currentY: number) => {
      'worklet';
      // Throttle : notifier seulement si le changement est significatif (> 5px)
      const diff = Math.abs(currentY - lastNotifiedY.value);
      if (diff > 5) {
        lastNotifiedY.value = currentY;
        if (onPositionChange) {
          runOnJS(notifyPositionChange)(currentY, cardH);
        }
      }
    },
    [cardH, onPositionChange]
  );

  // Mesurer le header si nécessaire
  const handleHeaderLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    const totalHeight = height + insets.top;
    setMeasuredHeaderHeight(totalHeight);
    if (onHeaderLayout) {
      onHeaderLayout(totalHeight);
    }
  };

  // Initialisation : animation de Ymin vers le snap initial
  useEffect(() => {
    if (headerWhiteH > 0 && cardH > 0 && !isInitialized && snapPoints.length > 0) {
      let targetY: number;
      
      // Si restoreTranslateY est fourni, l'utiliser directement (pas d'animation)
      if (restoreTranslateY !== undefined && restoreTranslateY !== null) {
        // Valider et clamp le translateY restauré entre Ymax et Ymin
        targetY = Math.max(Ymax, Math.min(Ymin, restoreTranslateY));
        // Pas d'animation, positionner directement
        translateY.value = targetY;
        setIsInitialized(true);
        // Notifier que le snap point est atteint
        runOnJS(notifySnapPointReached)(targetY, cardH);
        return;
      }
      
      // Sinon, utiliser initialSnapIndex ou initialSnap
      // Déterminer l'index initial
      let index = 0;
      if (typeof initialSnapIndex === 'number') {
        index = Math.max(0, Math.min(snapPoints.length - 1, initialSnapIndex));
      } else {
        // Compatibilité avec initialSnap ('max' | 'mid' | 'min')
        if (initialSnap === 'max') index = 0;
        else if (initialSnap === 'min') index = snapPoints.length - 1;
        else {
          // 'mid' ou valeur par défaut -> milieu de la liste
          index = Math.floor(snapPoints.length / 2);
        }
      }
      targetY = snapPoints[index] ?? Ymin ?? 0;
      // Petit délai pour que le layout soit stable
      setTimeout(() => {
      translateY.value = withTiming(targetY, {
        duration: 400,
        easing: Easing.out(Easing.cubic), // Ralentissement progressif et fluide
      }, (finished) => {
        // Callback appelé quand l'animation est terminée
        if (finished) {
          runOnJS(notifySnapPointReached)(targetY, cardH);
        }
      });
        setIsInitialized(true);
      }, 100);
    }
  }, [headerWhiteH, cardH, initialSnap, initialSnapIndex, restoreTranslateY, snapPoints, Ymin, isInitialized, notifySnapPointReached]);

  // Trouver le snap suivant dans la direction de la vitesse
  const findNextSnap = React.useCallback((currentY: number, velocityY: number, points: number[]): number => {
    if (points.length === 0) return currentY;
    const sortedPoints = [...points].sort((a, b) => a - b);
    if (velocityY < 0) {
      // Glissement vers le haut : trouver le point au-dessus
      for (let i = sortedPoints.length - 1; i >= 0; i--) {
        if (sortedPoints[i] < currentY) {
          return sortedPoints[i];
        }
      }
      return sortedPoints[0]; // Ymax
    } else {
      // Glissement vers le bas : trouver le point en dessous
      for (let i = 0; i < sortedPoints.length; i++) {
        if (sortedPoints[i] > currentY) {
          return sortedPoints[i];
        }
      }
      return sortedPoints[sortedPoints.length - 1]; // Ymin
    }
  }, []);

  // Trouver le snap point en fonction de la vitesse (inertie)
  // Plus la vitesse est élevée, plus on saute de snap points
  // Cette fonction doit être un worklet pour être utilisée dans onEnd
  const findSnapByVelocity = (currentY: number, velocityY: number, points: number[]): number => {
    'worklet';
    if (points.length === 0) return currentY;
    const sortedPoints = [...points].sort((a, b) => a - b);
    
    // Trouver l'index du snap point le plus proche de la position actuelle
    let currentIndex = 0;
    let minDistance = Math.abs(currentY - sortedPoints[0]);
    for (let i = 1; i < sortedPoints.length; i++) {
      const distance = Math.abs(currentY - sortedPoints[i]);
      if (distance < minDistance) {
        minDistance = distance;
        currentIndex = i;
      }
    }
    
    // Calculer le nombre de snap points à sauter en fonction de la vitesse
    // Seuils de vitesse (px/s) pour sauter 1, 2, 3+ snap points
    const velocityThreshold1 = 500; // Vitesse pour sauter 1 snap point
    const velocityThreshold2 = 1000; // Vitesse pour sauter 2 snap points
    const velocityThreshold3 = 1500; // Vitesse pour sauter 3+ snap points
    
    const absVelocity = Math.abs(velocityY);
    let skipCount = 0;
    
    if (absVelocity >= velocityThreshold3) {
      skipCount = 3; // Sauter jusqu'à 3 snap points
    } else if (absVelocity >= velocityThreshold2) {
      skipCount = 2; // Sauter 2 snap points
    } else if (absVelocity >= velocityThreshold1) {
      skipCount = 1; // Sauter 1 snap point
    }
    
    // Calculer l'index cible en fonction de la direction et du nombre de sauts
    let targetIndex = currentIndex;
    
    if (velocityY < 0) {
      // Glissement vers le haut : aller vers les indices plus petits (snaps plus hauts)
      targetIndex = Math.max(0, currentIndex - skipCount - 1);
    } else {
      // Glissement vers le bas : aller vers les indices plus grands (snaps plus bas)
      targetIndex = Math.min(sortedPoints.length - 1, currentIndex + skipCount + 1);
    }
    
    return sortedPoints[targetIndex];
  };

  // Gesture handler pour le grabber uniquement
  // Le pan gesture ne s'active que depuis le grabber pour déplacer la carte
  // Le scroll du contenu fonctionne normalement sans être intercepté
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      // Annuler toute animation en cours et synchroniser
      dragTargetY.value = translateY.value;
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      'worklet';
      let newY = context.value.y + event.translationY;

      // Clamp strict entre Ymax (peut être négatif pour remonter au-dessus du header vert) et Ymin (dernier snap)
      if (newY < Ymax) {
        newY = Ymax;
      } else if (newY > Ymin) {
        newY = Ymin;
      }

      // Mettre à jour la cible avec un léger amortissement pour plus de fluidité
      dragTargetY.value = newY;
      
      // Suivre la cible directement pendant le drag (pas de spring pour plus de fluidité)
      // Le spring est seulement utilisé à la fin du geste
      translateY.value = dragTargetY.value;
    })
    .onEnd((event) => {
      'worklet';
      // Vérifier que les snap points sont valides
      if (snapPoints.length === 0 || cardH <= 0) {
        return;
      }

      const velocityY = event.velocityY || 0;
      const currentY = translateY.value;

      // Vérifier que currentY est valide
      if (isNaN(currentY) || !isFinite(currentY)) {
        return;
      }

      // Utiliser les snap points actuels
      const currentSnapPoints = snapPoints;
      const currentYmax = currentSnapPoints.length > 0 ? currentSnapPoints[0] : 0;
      const currentYmin = currentSnapPoints.length > 0 ? currentSnapPoints[currentSnapPoints.length - 1] : 0;

      let targetY: number = currentY; // Initialiser avec la position actuelle

      const sortedPoints = [...currentSnapPoints].sort((a, b) => a - b);
      const snapProximity = 0.15 * cardH; // Seuil de proximité (15% de la hauteur de la carte)

      // Si fling rapide détecté, utiliser l'inertie pour sauter des snap points
      if (enableFling && Math.abs(velocityY) > velocityFlingThreshold) {
        // Utiliser findSnapByVelocity pour calculer le snap point en fonction de la vitesse
        targetY = findSnapByVelocity(currentY, velocityY, currentSnapPoints);
      } else {
        // Pas de fling rapide : déterminer le snap selon la direction du mouvement
        // Si on a bougé dans une direction, aller vers le snap suivant dans cette direction
        // Sinon, aller vers le plus proche
        
        // Calculer la direction du mouvement (basé sur translationY si disponible)
        const translationY = event.translationY || 0;
        
        if (Math.abs(translationY) > 10) {
          // Mouvement significatif : aller vers le snap suivant dans la direction
          if (translationY < 0) {
            // Mouvement vers le haut
            for (let i = sortedPoints.length - 1; i >= 0; i--) {
              if (sortedPoints[i] < currentY) {
                targetY = sortedPoints[i];
                break;
              }
            }
            if (targetY === currentY) targetY = sortedPoints[0];
          } else {
            // Mouvement vers le bas
            for (let i = 0; i < sortedPoints.length; i++) {
              if (sortedPoints[i] > currentY) {
                targetY = sortedPoints[i];
                break;
              }
            }
            if (targetY === currentY) targetY = sortedPoints[sortedPoints.length - 1];
          }
        } else {
          // Mouvement minimal : aller vers le snap le plus proche
          let nearest = currentSnapPoints[0];
          let minDistance = Math.abs(currentY - currentSnapPoints[0]);
          for (const point of currentSnapPoints) {
            const distance = Math.abs(currentY - point);
            if (distance < minDistance) {
              minDistance = distance;
              nearest = point;
            }
          }
          targetY = nearest;
        }
      }

      // Vérifier que targetY est valide
      if (isNaN(targetY) || !isFinite(targetY)) {
        return;
      }

      // Clamp final (sécurité)
      if (targetY < currentYmax) targetY = currentYmax;
      if (targetY > currentYmin) targetY = currentYmin;

      // Ajuster la durée de l'animation en fonction de la distance à parcourir
      // Plus la distance est grande, plus l'animation est longue (mais avec une limite)
      const distance = Math.abs(targetY - currentY);
      const maxDistance = cardH;
      const normalizedDistance = Math.min(1, distance / maxDistance);
      const duration = 300 + (normalizedDistance * 200); // Entre 300ms et 500ms

      translateY.value = withTiming(targetY, {
        duration: duration,
        easing: Easing.out(Easing.cubic), // Ralentissement progressif et fluide
      }, (finished) => {
        // Callback appelé quand l'animation est terminée
        if (finished) {
          runOnJS(notifySnapPointReached)(targetY, cardH);
        }
      });
    });

  // Style animé pour la carte (optimisé avec 'worklet')
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateY: translateY.value }],
    };
  }, []);

  // Hauteur du contenu fixe (pas animée) pour éviter les re-layouts pendant le drag.
  // paddingBottom = bottomNavHeight pour que le contenu scrollable ne soit pas masqué par la navbar.
  const grabberHeight = grabber ? 25 : 0;
  const contentHeight = Math.max(0, cardH - grabberHeight);
  const contentStyle = React.useMemo(
    () => [styles.content, { height: contentHeight, paddingBottom: bottomNavHeight }],
    [contentHeight, bottomNavHeight]
  );

  // Ne pas rendre si le header n'est pas mesuré
  if (totalHeaderH === 0 && !propHeaderHeight) {
    return (
      <View
        onLayout={handleHeaderLayout}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 }}
      />
    );
  }

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.card,
        {
          height: cardH,
          top: headerWhiteH, // Positionner sous le header blanc uniquement
        },
        animatedStyle,
        style,
      ]}
    >
      {grabber && (
        <GestureDetector gesture={panGesture}>
          <View
            testID={`${testID}-grabber`}
            style={styles.grabber}
            accessibilityLabel="Drag handle"
          >
            <View style={styles.grabberHandle} />
          </View>
        </GestureDetector>
      )}
      <View style={contentStyle}>
        {children}
      </View>
    </Animated.View>
  );
});

export default SlidingCard;

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: darkColor,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    zIndex: 10, // Au-dessus de la popup (zIndex: 1) et de la map
    elevation: 5,
  },
  grabber: {
    width: '100%',
    height: 40, // Zone plus grande pour faciliter le drag
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  grabberHandle: {
    width: 48,
    height: 5,
    backgroundColor: darkColor,
    opacity: 0.15,
    borderRadius: 2.5,
  },
  content: {
    overflow: 'hidden', // Empêcher le débordement
  },
});

