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

const TIKTOK_PLAY_MESSAGE = JSON.stringify({
  type: 'play',
  value: null,
  'x-tiktok-player': true,
});
const TIKTOK_PAUSE_MESSAGE = JSON.stringify({
  type: 'pause',
  value: null,
  'x-tiktok-player': true,
});

function TikTokEmbedBlock({
  video,
  isActive,
}: {
  video: PlaceVideoFeedItem;
  isActive: boolean;
}) {
  const webViewRef = React.useRef<WebView>(null);
  const hasLoadedRef = React.useRef(false);
  const isActiveRef = React.useRef(isActive);
  isActiveRef.current = isActive;
  // Embed Player officiel TikTok (player/v1) — autoplay seulement quand la carte est visible
  const embedUri = `https://www.tiktok.com/player/v1/${video.videoId}?loop=1&play_button=0`;

  const injectPlay = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `(function(){
        function setPlaysInline(){
          var v=document.querySelectorAll('video');
          for(var i=0;i<v.length;i++){
            v[i].setAttribute('playsinline','true');
            v[i].setAttribute('webkit-playsinline','true');
            v[i].playsInline=true;
          }
        }
        try {
          setPlaysInline();
          var m=${TIKTOK_PLAY_MESSAGE};
          window.postMessage(m,'*');
          setTimeout(setPlaysInline, 400);
        }catch(e){}
      })();true;`
    );
  }, []);

  const injectPause = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      `(function(){try{var m=${TIKTOK_PAUSE_MESSAGE};window.postMessage(m,'*');}catch(e){}})();true;`
    );
  }, []);

  const handleLoadEnd = useCallback(() => {
    hasLoadedRef.current = true;
    if (!isActiveRef.current) return;
    setTimeout(() => injectPlay(), 800);
  }, [injectPlay]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (isActive) {
      const t = setTimeout(() => injectPlay(), 300);
      return () => clearTimeout(t);
    } else {
      injectPause();
    }
  }, [isActive, injectPlay, injectPause]);

  return (
    <View style={styles.card}>
      <WebView
        ref={webViewRef}
        source={{ uri: embedUri }}
        originWhitelist={['*']}
        style={[styles.webview, { width: CARD_WIDTH - CARD_MARGIN * 2, height: EMBED_HEIGHT }]}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoadEnd={handleLoadEnd}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
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
  const [activeIndex, setActiveIndex] = useState(0);

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

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setActiveIndex((prev) => (index >= 0 && index < videos.length ? index : prev));
  }, [videos.length]);

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH}
      snapToAlignment="start"
      contentContainerStyle={styles.scrollContent}
      onMomentumScrollEnd={onScroll}
      onScroll={onScroll}
      scrollEventThrottle={100}
    >
      {videos.map((video, index) => (
        <View key={video.id} style={[styles.slide, { width: CARD_WIDTH }]}>
          <TikTokEmbedBlock video={video} isActive={index === activeIndex} />
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
