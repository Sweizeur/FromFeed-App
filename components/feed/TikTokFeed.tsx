import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getPlaceVideosFeed } from '@/lib/api';
import type { PlaceVideoFeedItem } from '@/types/api';
import { darkColor } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH;
const CARD_MARGIN = 8;
const EMBED_HEIGHT = Math.min(580, Math.round(SCREEN_HEIGHT * 0.72));

interface TikTokFeedProps {
  selectedCategory: string | null;
  selectedType: string | null;
}

function TikTokEmbedBlock({ video }: { video: PlaceVideoFeedItem }) {
  const embedUri = `https://www.tiktok.com/embed/v2/${video.videoId}`;

  return (
    <View style={styles.card}>
      <WebView
        source={{ uri: embedUri }}
        originWhitelist={['*']}
        style={[styles.webview, { width: CARD_WIDTH - CARD_MARGIN * 2, height: EMBED_HEIGHT }]}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={darkColor} />
          </View>
        )}
      />
      {(video.placeName || video.rawTitle) && (
        <View style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={2}>
            {video.placeName || video.rawTitle}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TikTokFeed({ selectedCategory, selectedType }: TikTokFeedProps) {
  const [videos, setVideos] = useState<PlaceVideoFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getPlaceVideosFeed({
      category: selectedCategory || undefined,
      type: selectedType || undefined,
      limit: 30,
    });
    if (result?.videos) {
      setVideos(result.videos);
    } else {
      setError('Impossible de charger le fil');
    }
    setLoading(false);
  }, [selectedCategory, selectedType]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={darkColor} />
        <Text style={styles.hint}>Chargement des TikToks...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => loadFeed()}>
          <Text style={styles.hint}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Aucune vidéo pour ce filtre</Text>
        <Text style={styles.hint}>Ajoute des lieux depuis des liens TikTok pour les voir ici.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH}
      snapToAlignment="start"
      contentContainerStyle={styles.scrollContent}
    >
      {videos.map((video) => (
        <View key={video.id} style={[styles.slide, { width: CARD_WIDTH }]}>
          <TikTokEmbedBlock video={video} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  slide: {
    paddingHorizontal: CARD_MARGIN,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  webview: {
    backgroundColor: '#000',
    borderRadius: 12,
  },
  loadingCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  caption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 16,
  },
  captionText: {
    fontSize: 14,
    color: darkColor,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: darkColor,
  },
  emptyText: {
    fontSize: 16,
    color: darkColor,
    textAlign: 'center',
  },
});
