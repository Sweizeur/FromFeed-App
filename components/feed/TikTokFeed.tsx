import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getPlaceVideosFeed } from '@/lib/api';
import type { PlaceVideoFeedItem } from '@/types/api';
import { darkColor } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH;
const CARD_MARGIN = 8;
const EMBED_HEIGHT = Math.min(580, Math.round(SCREEN_HEIGHT * 0.72));
const CAPTION_HEIGHT = 72; // zone titre sous la vidéo
const CARD_HEIGHT = EMBED_HEIGHT + CAPTION_HEIGHT;

interface TikTokFeedProps {
  selectedCategory?: string | null;
  selectedType?: string | null;
  /** false quand l'utilisateur quitte l'onglet Feed → on met en pause la vidéo */
  tabFocused?: boolean;
}

// Objets pour postMessage TikTok (injectés tels quels : pas de JSON.parse, sinon "[object Object]")
const TIKTOK_PLAY_OBJ = { type: 'play', value: null, 'x-tiktok-player': true };
const TIKTOK_PAUSE_OBJ = { type: 'pause', value: null, 'x-tiktok-player': true };

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
  // Pas d'autoplay dans l'URL : seule la carte visible reçoit play via injectPlay()
  const embedUri = `https://www.tiktok.com/player/v1/${video.videoId}?loop=1&controls=1`;

  const injectPlay = useCallback(() => {
    const obj = JSON.stringify(TIKTOK_PLAY_OBJ);
    webViewRef.current?.injectJavaScript(
      `(function(){
        var obj = ${obj};
        function run(){
          try {
            var iframes = document.querySelectorAll('iframe');
            for (var i = 0; i < iframes.length; i++) {
              if (iframes[i].contentWindow) iframes[i].contentWindow.postMessage(obj, '*');
            }
            if (typeof window.dispatchEvent === 'function') {
              window.dispatchEvent(new MessageEvent('message', { data: obj }));
            }
            window.postMessage(obj, '*');
            var v = document.querySelector('video');
            if (v) {
              v.setAttribute('playsinline', 'true');
              v.setAttribute('webkit-playsinline', 'true');
              if (v.play) v.play().catch(function(){});
            }
          }catch(e){}
        }
        run();
        setTimeout(run, 400);
      })();true;`
    );
  }, []);

  const injectPause = useCallback(() => {
    const obj = JSON.stringify(TIKTOK_PAUSE_OBJ);
    webViewRef.current?.injectJavaScript(
      `(function(){
        var obj = ${obj};
        try {
          var iframes = document.querySelectorAll('iframe');
          for (var i = 0; i < iframes.length; i++) {
            if (iframes[i].contentWindow) iframes[i].contentWindow.postMessage(obj, '*');
          }
          if (typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new MessageEvent('message', { data: obj }));
          }
          window.postMessage(obj, '*');
          var v = document.querySelector('video');
          if (v && v.pause) v.pause();
        }catch(e){}
      })();true;`
    );
  }, []);

  const handleLoadEnd = useCallback(() => {
    hasLoadedRef.current = true;
    if (isActiveRef.current) {
      setTimeout(() => injectPlay(), 600);
      setTimeout(() => injectPlay(), 1400);
    } else {
      setTimeout(() => injectPause(), 200);
    }
  }, [injectPlay, injectPause]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (isActive) {
      const t = setTimeout(() => injectPlay(), 300);
      return () => clearTimeout(t);
    } else {
      injectPause();
    }
  }, [isActive, injectPlay, injectPause]);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const url = request.url;
    const isHttp = url.startsWith('http://') || url.startsWith('https://');
    const isTikTokRedirect =
      url.includes('onelink.me') ||
      url.includes('snssdk1233') ||
      url.startsWith('tiktok://') ||
      url.startsWith('snssdk1233://');
    if (isHttp && !isTikTokRedirect) {
      return true;
    }
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
    }).catch(() => {});
    return false;
  }, []);

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
        onShouldStartLoadWithRequest={handleShouldStartLoad}
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

export default function TikTokFeed({ selectedCategory, selectedType, tabFocused = true }: TikTokFeedProps) {
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

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / CARD_HEIGHT);
    setActiveIndex((prev) => (index >= 0 && index < videos.length ? index : prev));
  }, [videos.length]);

  return (
    <ScrollView
      pagingEnabled
      showsVerticalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_HEIGHT}
      snapToAlignment="start"
      contentContainerStyle={styles.scrollContent}
      onMomentumScrollEnd={onScroll}
      onScroll={onScroll}
      scrollEventThrottle={100}
    >
      {videos.map((video, index) => (
        <View key={video.id} style={[styles.slide, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
          <TikTokEmbedBlock video={video} isActive={tabFocused && index === activeIndex} />
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
    justifyContent: 'flex-start',
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
