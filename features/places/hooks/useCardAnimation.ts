import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Animated, PanResponder, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlaceSummary } from '@/features/places/types';

export const COLLAPSED_CARD_HEIGHT = 138;

/** Must match MapScreen PlaceFilters `top: insets.top + 78` — expanded card stops below the map header. */
const EXPANDED_CARD_TOP_OFFSET = 78;

export function useCardAnimation() {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navbarClearance = insets.bottom + 72;
  const expandedFullHeight = Math.max(
    200,
    screenHeight - insets.top - EXPANDED_CARD_TOP_OFFSET,
  );
  const heightRange = Math.max(1, expandedFullHeight - COLLAPSED_CARD_HEIGHT);

  const [selectedCardPlace, setSelectedCardPlace] = useState<PlaceSummary | null>(null);

  const cardAppearProgress = useRef(new Animated.Value(0)).current;
  const cardExpansionProgress = useRef(new Animated.Value(0)).current;
  const cardExpansionValue = useRef(0);
  const isCardExpanded = useRef(false);
  const gestureStartProgress = useRef(0);
  const lastKnownCardPlace = useRef<PlaceSummary | null>(null);
  const isDismissingRef = useRef(false);

  useEffect(() => {
    const id = cardExpansionProgress.addListener(({ value }) => {
      cardExpansionValue.current = value;
    });
    return () => cardExpansionProgress.removeListener(id);
  }, [cardExpansionProgress]);

  const dismissPlaceCardAnimated = useCallback(() => {
    if (!selectedCardPlace || isDismissingRef.current) return;
    isDismissingRef.current = true;
    isCardExpanded.current = false;
    cardAppearProgress.stopAnimation();
    cardExpansionProgress.stopAnimation();
    Animated.parallel([
      Animated.timing(cardAppearProgress, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(cardExpansionProgress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      isDismissingRef.current = false;
      if (finished) {
        setSelectedCardPlace(null);
        lastKnownCardPlace.current = null;
        cardExpansionValue.current = 0;
      }
    });
  }, [selectedCardPlace, cardAppearProgress, cardExpansionProgress]);

  const expandCard = useCallback(() => {
    isCardExpanded.current = true;
    Animated.spring(cardExpansionProgress, {
      toValue: 1,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [cardExpansionProgress]);

  const collapseCard = useCallback(() => {
    isCardExpanded.current = false;
    Animated.spring(cardExpansionProgress, {
      toValue: 0,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [cardExpansionProgress]);

  const cardPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          const isVertical = Math.abs(g.dy) > Math.abs(g.dx);
          if (!isCardExpanded.current && g.dy < -6 && isVertical) return true;
          if (isCardExpanded.current && g.dy > 6 && isVertical) return true;
          return false;
        },
        onPanResponderGrant: () => {
          cardExpansionProgress.stopAnimation();
          gestureStartProgress.current = cardExpansionValue.current;
        },
        onPanResponderMove: (_, g) => {
          const delta = -g.dy / heightRange;
          const next = Math.max(0, Math.min(1, gestureStartProgress.current + delta));
          cardExpansionProgress.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          if (-g.vy > 0.4 || cardExpansionValue.current > 0.4) {
            expandCard();
          } else {
            collapseCard();
          }
        },
        onPanResponderTerminate: () => collapseCard(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandCard, collapseCard, cardExpansionProgress, heightRange],
  );

  const toggleCardExpansion = useCallback(() => {
    if (isCardExpanded.current) collapseCard();
    else expandCard();
  }, [expandCard, collapseCard]);

  const showPlaceCard = useCallback(
    (place: PlaceSummary) => {
      isDismissingRef.current = false;
      isCardExpanded.current = false;
      cardExpansionProgress.stopAnimation();
      cardExpansionProgress.setValue(0);
      cardExpansionValue.current = 0;
      cardAppearProgress.stopAnimation();
      lastKnownCardPlace.current = place;
      setSelectedCardPlace(place);
      Animated.timing(cardAppearProgress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }).start();
    },
    [cardAppearProgress, cardExpansionProgress],
  );

  const cardPlace = selectedCardPlace ?? lastKnownCardPlace.current;

  return {
    selectedCardPlace,
    cardPlace,
    showPlaceCard,
    dismissPlaceCardAnimated,
    toggleCardExpansion,
    cardAppearProgress,
    cardExpansionProgress,
    cardPanResponder,
    expandedFullHeight,
    navbarClearance,
  };
}
