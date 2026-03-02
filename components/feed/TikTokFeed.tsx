import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Pressable,
  Linking,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Path } from 'react-native-svg';
import { getPlaceVideosFeed, linkPlace, deletePlace, getAllPlacesSummary } from '@/lib/api';
import type { PlaceVideoFeedItem } from '@/types/api';
import { darkColor } from '@/constants/theme';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/common/Toast';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH;
const CARD_MARGIN = 8;
const CARD_GAP_MIN = 16; // espace minimum entre chaque carte
const CAPTION_HEIGHT = 100;
const HEART_SAVED_COLOR = '#B18BBD'; // mauve (like CSS hover)
const HEART_ICON_SIZE = 22;
// Cœur outline (contour avec trou) – non sauvegardé
const HEART_OUTLINE_PATH =
  'M8.752,15.625h0L1.383,8.162a4.824,4.824,0,0,1,0-6.762,4.679,4.679,0,0,1,6.674,0l.694.7.694-.7a4.678,4.678,0,0,1,6.675,0,4.825,4.825,0,0,1,0,6.762L8.752,15.624ZM4.72,1.25A3.442,3.442,0,0,0,2.277,2.275a3.562,3.562,0,0,0,0,5l6.475,6.556,6.475-6.556a3.563,3.563,0,0,0,0-5A3.443,3.443,0,0,0,12.786,1.25h-.01a3.415,3.415,0,0,0-2.443,1.038L8.752,3.9,7.164,2.275A3.442,3.442,0,0,0,4.72,1.25Z';
// Cœur plein – sauvegardé
const HEART_FILLED_PATH =
  'M8.752,15.625h0L1.383,8.162a4.824,4.824,0,0,1,0-6.762,4.679,4.679,0,0,1,6.674,0l.694.7.694-.7a4.678,4.678,0,0,1,6.675,0,4.825,4.825,0,0,1,0,6.762L8.752,15.624Z';
const DEFAULT_EMBED_HEIGHT = Math.min(580, Math.round(SCREEN_HEIGHT * 0.72));
const DEFAULT_CARD_HEIGHT = DEFAULT_EMBED_HEIGHT + CAPTION_HEIGHT;

interface TikTokFeedProps {
  selectedCategory?: string | null;
  selectedType?: string | null;
  /** false quand l'utilisateur quitte l'onglet Feed → on met en pause la vidéo */
  tabFocused?: boolean;
  /** Recherche côté serveur : titre vidéo, nom du lieu, adresse, description */
  searchQuery?: string;
  /** Hauteur disponible pour le feed (entre header et footer). Si fourni, les cartes ont cette hauteur fixe. */
  contentHeight?: number;
  /** Hauteur de la zone du feed (viewport du ScrollView). Utilisé pour calculer l'espace entre cartes. */
  feedAreaHeight?: number;
}

// Objets pour postMessage TikTok (injectés tels quels : pas de JSON.parse, sinon "[object Object]")
const TIKTOK_PLAY_OBJ = { type: 'play', value: null, 'x-tiktok-player': true };
const TIKTOK_PAUSE_OBJ = { type: 'pause', value: null, 'x-tiktok-player': true };

function TikTokEmbedBlock({
  video,
  isActive,
  onAddPlace,
  onRemovePlace,
  embedHeight,
  isSaved,
}: {
  video: PlaceVideoFeedItem;
  isActive: boolean;
  onAddPlace?: (placeId: string) => Promise<void>;
  onRemovePlace?: (placeId: string) => Promise<void>;
  embedHeight: number;
  isSaved: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const heartFadeAnim = useRef(new Animated.Value(isSaved ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(heartFadeAnim, {
      toValue: isSaved ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isSaved, heartFadeAnim]);
  const handlePressIn = useCallback(() => {
    Animated.timing(pressScaleAnim, { toValue: 1.2, duration: 120, useNativeDriver: true }).start();
  }, [pressScaleAnim]);
  const handlePressOut = useCallback(() => {
    Animated.timing(pressScaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  }, [pressScaleAnim]);
  const combinedScale = useMemo(
    () => Animated.multiply(scaleAnim, pressScaleAnim),
    [scaleAnim, pressScaleAnim]
  );
  const webViewRef = React.useRef<WebView>(null);
  const hasLoadedRef = React.useRef(false);
  const isActiveRef = React.useRef(isActive);
  isActiveRef.current = isActive;
  const isTikTok = video.provider !== 'instagram';
  // TikTok : pas d'autoplay dans l'URL, play via injectPlay(). Instagram : embed officiel.
  const embedUri = isTikTok
    ? `https://www.tiktok.com/player/v1/${video.videoId}?loop=1&controls=1`
    : `https://www.instagram.com/reel/${video.videoId}/embed/`;

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
    if (!isTikTok) return; // Instagram embed gère seul la lecture
    if (isActiveRef.current) {
      setTimeout(() => injectPlay(), 600);
      setTimeout(() => injectPlay(), 1400);
    } else {
      setTimeout(() => injectPause(), 200);
    }
  }, [isTikTok, injectPlay, injectPause]);

  useEffect(() => {
    if (!isTikTok || !hasLoadedRef.current) return;
    if (isActive) {
      const t1 = setTimeout(() => injectPlay(), 600);
      const t2 = setTimeout(() => injectPlay(), 1400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      injectPause();
    }
  }, [isTikTok, isActive, injectPlay, injectPause]);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const url = request.url;
    const isHttp = url.startsWith('http://') || url.startsWith('https://');
    const openInApp =
      url.includes('onelink.me') ||
      url.includes('snssdk1233') ||
      url.startsWith('tiktok://') ||
      url.startsWith('snssdk1233://') ||
      url.startsWith('instagram://');
    if (isHttp && !openInApp) {
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
        style={[styles.webview, { width: CARD_WIDTH - CARD_MARGIN * 2, height: embedHeight }]}
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
      <View style={styles.caption}>
        <View style={styles.captionTextBlock}>
          {(video.rawTitle || video.placeName) && (
            <>
              <Text style={styles.captionTitle} numberOfLines={2}>
                {video.rawTitle || video.placeName}
              </Text>
              {video.placeName && video.rawTitle && video.placeName !== video.rawTitle && (
                <Text style={styles.captionPlaceName} numberOfLines={1}>
                  {video.placeName}
                </Text>
              )}
            </>
          )}
        </View>
        {onAddPlace && (
          <View style={styles.addToPlacesButtonWrap}>
            <Animated.View style={{ transform: [{ scale: combinedScale }] }}>
              <Pressable
                style={[styles.addToPlacesButton, isSaved && styles.addToPlacesButtonSaved]}
                onPress={isSaved ? () => onRemovePlace?.(video.placeId) : () => onAddPlace?.(video.placeId)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
              >
                <View style={styles.heartSvgWrap}>
                  <Animated.View
                    style={[
                      styles.heartSvgLayer,
                      {
                        opacity: heartFadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        }),
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Svg
                      width={HEART_ICON_SIZE}
                      height={HEART_ICON_SIZE}
                      viewBox="0 0 17.503 15.625"
                      style={styles.heartIcon}
                    >
                      <Path fill={darkColor} d={HEART_OUTLINE_PATH} />
                    </Svg>
                  </Animated.View>
                  <Animated.View
                    style={[styles.heartSvgLayer, { opacity: heartFadeAnim }]}
                    pointerEvents="none"
                  >
                    <Svg
                      width={HEART_ICON_SIZE}
                      height={HEART_ICON_SIZE}
                      viewBox="0 0 17.503 15.625"
                      style={styles.heartIcon}
                    >
                      <Path fill={HEART_SAVED_COLOR} d={HEART_FILLED_PATH} />
                    </Svg>
                  </Animated.View>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TikTokFeed({ selectedCategory, selectedType, tabFocused = true, searchQuery = '', contentHeight, feedAreaHeight }: TikTokFeedProps) {
  const [videos, setVideos] = useState<PlaceVideoFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());
  const { toast, showError, hideToast } = useToast();

  const { cardHeight, embedHeight, cardGap } = useMemo(() => {
    if (contentHeight != null && contentHeight > CAPTION_HEIGHT) {
      const ch = contentHeight;
      const eh = ch - CAPTION_HEIGHT;
      // Espace entre cartes = au moins ce qu'il faut pour que la carte suivante ne soit pas visible
      const gap =
        feedAreaHeight != null && feedAreaHeight > ch
          ? Math.max(CARD_GAP_MIN, feedAreaHeight - ch)
          : CARD_GAP_MIN;
      return {
        cardHeight: ch,
        embedHeight: eh,
        cardGap: gap,
      };
    }
    return {
      cardHeight: DEFAULT_CARD_HEIGHT,
      embedHeight: DEFAULT_EMBED_HEIGHT,
      cardGap: CARD_GAP_MIN,
    };
  }, [contentHeight, feedAreaHeight]);

  const handleAddPlace = useCallback(async (placeId: string) => {
    setSavedPlaceIds((prev) => new Set(prev).add(placeId));
    const result = await linkPlace(placeId);
    if (result?.success) {
      // Pas de toast de succès
    } else {
      setSavedPlaceIds((prev) => {
        const next = new Set(prev);
        next.delete(placeId);
        return next;
      });
      showError('Le lieu n\'a pas pu être ajouté, réessaie plus tard.');
    }
  }, [showError]);

  const handleRemovePlace = useCallback(async (placeId: string) => {
    setSavedPlaceIds((prev) => {
      const next = new Set(prev);
      next.delete(placeId);
      return next;
    });
    const result = await deletePlace(placeId);
    if (result?.message) {
      // Pas de toast de succès
    } else {
      setSavedPlaceIds((prev) => new Set(prev).add(placeId));
      showError('Le lieu n\'a pas pu être retiré, réessaie plus tard.');
    }
  }, [showError]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [feedResult, placesResult] = await Promise.all([
      getPlaceVideosFeed({
        category: selectedCategory || undefined,
        type: selectedType || undefined,
        limit: 30,
        q: searchQuery.trim() || undefined,
      }),
      getAllPlacesSummary(),
    ]);
    if (feedResult?.videos) {
      setVideos(feedResult.videos);
    } else {
      setError('Impossible de charger le fil');
    }
    if (placesResult?.places) {
      setSavedPlaceIds(new Set(placesResult.places.map((p) => p.id)));
    }
    setLoading(false);
  }, [selectedCategory, selectedType, searchQuery]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={darkColor} />
        <Text style={styles.hint}>Chargement des vidéos...</Text>
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
        <Text style={styles.emptyText}>
          {searchQuery.trim() ? `Aucun résultat pour « ${searchQuery.trim()} »` : 'Aucune vidéo pour ce filtre'}
        </Text>
        <Text style={styles.hint}>
          {searchQuery.trim() ? 'Essaie avec le titre de la vidéo, le nom du lieu ou l\'adresse.' : 'Ajoute des lieux depuis des liens TikTok pour les voir ici.'}
        </Text>
      </View>
    );
  }

  const slideStep = cardHeight + cardGap;

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / slideStep);
    setActiveIndex((prev) => (index >= 0 && index < videos.length ? index : prev));
  }, [videos.length, slideStep]);

  return (
    <>
      <ScrollView
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={slideStep}
        snapToAlignment="start"
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        {videos.map((video, index) => (
          <View key={video.id} style={[styles.slide, { width: CARD_WIDTH, height: cardHeight, marginBottom: cardGap }]}>
            <TikTokEmbedBlock
              video={video}
              isActive={tabFocused && index === activeIndex}
              onAddPlace={handleAddPlace}
              onRemovePlace={handleRemovePlace}
              embedHeight={embedHeight}
              isSaved={savedPlaceIds.has(video.placeId)}
            />
          </View>
        ))}
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  captionTextBlock: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  captionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: darkColor,
    marginBottom: 2,
  },
  captionPlaceName: {
    fontSize: 13,
    color: '#666',
  },
  addToPlacesButtonWrap: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  addToPlacesButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToPlacesButtonSaved: {
    backgroundColor: 'transparent',
  },
  heartSvgWrap: {
    width: HEART_ICON_SIZE,
    height: HEART_ICON_SIZE,
    position: 'relative',
  },
  heartSvgLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  heartIcon: {
    opacity: 1,
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
