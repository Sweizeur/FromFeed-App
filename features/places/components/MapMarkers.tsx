import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MarkerView } from '@rnmapbox/maps';
import type { PlaceSummary } from '@/features/places/types';

interface MapMarkersProps {
  places: PlaceSummary[];
  theme: { surface: string; border: string; tint?: string };
  onPlacePress: (place: PlaceSummary) => void;
  /** Lieu actuellement mis en avant (ex. fiche ouverte sur la carte) */
  selectedPlaceId?: string | null;
}

const MARKER_BOX = 40;
const MARKER_BOX_SELECTED = 46;

const MapMarkers = React.memo(
  function MapMarkers({ places, theme, onPlacePress, selectedPlaceId = null }: MapMarkersProps) {
    const tint = theme.tint ?? '#0a7ea4';

    return (
      <>
        {places
          .filter((p) => p?.id && p.lat != null && p.lon != null)
          .map((place) => {
            const selected = selectedPlaceId != null && place.id === selectedPlaceId;
            const boxSize = selected ? MARKER_BOX_SELECTED : MARKER_BOX;
            return (
              <MarkerView
                key={place.id}
                coordinate={[place.lon!, place.lat!]}
                allowOverlap={selected}
              >
                <Pressable onPress={() => onPlacePress(place)}>
                  <View
                    style={[
                      styles.emojiBox,
                      {
                        width: boxSize,
                        height: boxSize,
                        borderRadius: boxSize / 2,
                        backgroundColor: theme.surface,
                        borderColor: selected ? tint : theme.border,
                        borderWidth: selected ? 3 : 2,
                      },
                      selected && [
                        styles.emojiBoxSelected,
                        {
                          shadowColor: tint,
                        },
                      ],
                    ]}
                  >
                    <Text style={[styles.emoji, selected && styles.emojiSelected]}>
                      {place.markerEmoji ?? '📍'}
                    </Text>
                  </View>
                </Pressable>
              </MarkerView>
            );
          })}
      </>
    );
  },
  (prev, next) =>
    prev.places === next.places &&
    prev.theme.surface === next.theme.surface &&
    prev.theme.border === next.theme.border &&
    prev.theme.tint === next.theme.tint &&
    prev.selectedPlaceId === next.selectedPlaceId
);

export default MapMarkers;

const styles = StyleSheet.create({
  emojiBox: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  emojiBoxSelected: {
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  emoji: {
    fontSize: 22,
    textAlign: 'center',
  },
  emojiSelected: {
    fontSize: 24,
  },
});
