import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MarkerView } from '@rnmapbox/maps';
import type { PlaceSummary } from '@/features/places/types';

interface MapMarkersProps {
  places: PlaceSummary[];
  theme: { surface: string; border: string };
  onPlacePress: (place: PlaceSummary) => void;
}

const MARKER_BOX = 40;

const MapMarkers = React.memo(
  function MapMarkers({ places, theme, onPlacePress }: MapMarkersProps) {
    return (
      <>
        {places
          .filter((p) => p?.id && p.lat != null && p.lon != null)
          .map((place) => (
            <MarkerView
              key={place.id}
              coordinate={[place.lon!, place.lat!]}
              allowOverlap={false}
            >
              <Pressable onPress={() => onPlacePress(place)}>
                <View
                  style={[
                    styles.emojiBox,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={styles.emoji}>{place.markerEmoji ?? '📍'}</Text>
                </View>
              </Pressable>
            </MarkerView>
          ))}
      </>
    );
  },
  (prev, next) =>
    prev.places === next.places &&
    prev.theme.surface === next.theme.surface &&
    prev.theme.border === next.theme.border
);

export default MapMarkers;

const styles = StyleSheet.create({
  emojiBox: {
    width: MARKER_BOX,
    height: MARKER_BOX,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: MARKER_BOX / 2,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  emoji: {
    fontSize: 22,
    textAlign: 'center',
  },
});
