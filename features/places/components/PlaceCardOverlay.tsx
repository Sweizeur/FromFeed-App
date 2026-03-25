import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  ScrollView,
  Linking,
  Switch,
  type PanResponderInstance,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import type { Place, PlaceSummary } from '@/features/places/types';
import { COLLAPSED_CARD_HEIGHT } from '@/features/places/hooks/useCardAnimation';

const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
const COLLAPSED_SIDE_INSET = 16;

function getProviderInfo(provider?: string | null) {
  const n = provider?.toLowerCase();
  if (n === 'tiktok') return { icon: 'tiktok' as const, label: 'TikTok' };
  if (n === 'instagram' || n === 'insta') return { icon: 'instagram' as const, label: 'Instagram' };
  return null;
}

function normalizeHost(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
}

function openMaps(lat?: number | null, lon?: number | null, name?: string | null) {
  if (lat == null || lon == null) return;
  const label = encodeURIComponent(name || 'Lieu');
  const url = Platform.select({
    ios: `maps:0,0?q=${label}&ll=${lat},${lon}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  });
  if (url) void Linking.openURL(url);
}

function openDial(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits) void Linking.openURL(`tel:${digits}`);
}

function openWeb(url: string) {
  const trimmed = url.trim();
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  void Linking.openURL(href);
}

const HEART_NOTE = '#ff4d6d';

function pumpHeart(scale: Animated.Value) {
  scale.setValue(1);
  Animated.sequence([
    Animated.timing(scale, { toValue: 1.32, duration: 85, useNativeDriver: true }),
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }),
  ]).start();
}

/* ── Interactive heart rating (Ma note) ── */

function HeartRatingInput({
  value,
  onChange,
  disabled,
  accent,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  accent: string;
}) {
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  const handlePress = (i: number) => {
    if (disabled) return;
    const next = value === i ? 0 : i;
    if (next > value) {
      for (let j = value; j < next; j++) {
        const idx = j;
        setTimeout(() => pumpHeart(scales[idx]), (idx - value) * 55);
      }
    } else {
      pumpHeart(scales[i - 1]);
    }
    onChange(next);
  };

  return (
    <View style={s.heartInputRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          onPress={() => handlePress(i)}
          hitSlop={8}
        >
          <Animated.View style={{ transform: [{ scale: scales[i - 1] }] }}>
            <Ionicons
              name={i <= value ? 'heart' : 'heart-outline'}
              size={30}
              color={i <= value ? HEART_NOTE : accent}
            />
          </Animated.View>
        </Pressable>
      ))}
    </View>
  );
}

/* ── Quick-action pill ── */

function ActionPill({
  icon,
  label,
  onPress,
  color,
  bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
  bg: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.actionPill, { backgroundColor: bg }, pressed && { opacity: 0.65 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[s.actionPillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Props ── */

interface PlaceCardOverlayProps {
  place: PlaceSummary | null;
  placeDetails?: Place | null;
  cardAppearProgress: Animated.Value;
  cardExpansionProgress: Animated.Value;
  cardPanResponder: PanResponderInstance;
  toggleCardExpansion: () => void;
  expandedFullHeight: number;
  navbarClearance: number;
  isDark: boolean;
  theme: { text: string; icon: string; surface: string };
  onRatingChange?: (placeId: string, rating: number) => void;
  onTestedChange?: (placeId: string, isTested: boolean) => void;
}

export default function PlaceCardOverlay({
  place,
  placeDetails = null,
  cardAppearProgress,
  cardExpansionProgress,
  cardPanResponder,
  toggleCardExpansion,
  expandedFullHeight,
  navbarClearance,
  isDark,
  theme,
  onRatingChange,
  onTestedChange,
}: PlaceCardOverlayProps) {
  const providerInfo = useMemo(() => getProviderInfo(place?.provider), [place?.provider]);

  const cardAddress = useMemo(
    () =>
      place
        ? place.googleFormattedAddress?.trim() ||
          place.address?.trim() ||
          place.city?.trim() ||
          ''
        : '',
    [place],
  );

  const merged = useMemo(() => {
    if (!place) return null;
    const d = placeDetails?.id === place.id ? placeDetails : null;
    const googleWebsite = d?.googleWebsite ?? place.googleWebsite ?? null;
    const videoWebsite = place.websiteUrl?.trim() || null;
    const phone = (d?.googlePhone ?? place.googlePhone)?.trim() || null;
    const hours = (d?.googleOpeningHours ?? place.googleOpeningHours)?.trim() || null;
    const openNow = d?.googleOpenNow ?? place.googleOpenNow ?? null;
    const userRating = place.userRating ?? d?.userRating ?? null;
    const isTested = place.isTested ?? d?.isTested ?? false;
    const editorial = d?.googleEditorialSummary?.trim() || null;
    const types = (d?.types?.length ? d.types : place.types) ?? [];
    const lat = place.lat ?? d?.lat ?? null;
    const lon = place.lon ?? d?.lon ?? null;

    return {
      googleWebsite,
      videoWebsite,
      phone,
      hours,
      hoursLines: hours ? hours.split('\n').map((l) => l.trim()).filter(Boolean) : [],
      openNow,
      userRating: userRating ?? 0,
      isTested,
      editorial,
      types,
      lat,
      lon,
    };
  }, [place, placeDetails]);

  const [localRating, setLocalRating] = useState<number | null>(null);
  const [localTested, setLocalTested] = useState<boolean | null>(null);

  /** Sans ça, le switch / la note restent sur les valeurs du lieu précédent. */
  useEffect(() => {
    setLocalRating(null);
    setLocalTested(null);
  }, [place?.id]);

  const effectiveRating = localRating ?? merged?.userRating ?? 0;
  const effectiveTested = localTested ?? merged?.isTested ?? false;

  const handleRating = useCallback(
    (v: number) => {
      if (!place) return;
      setLocalRating(v);
      onRatingChange?.(place.id, v);
    },
    [place, onRatingChange],
  );

  const handleTestedToggle = useCallback(
    (v: boolean) => {
      if (!place) return;
      setLocalTested(v);
      onTestedChange?.(place.id, v);
    },
    [place, onTestedChange],
  );

  if (!place || !merged) return null;

  const textColor = isDark ? '#fff' : theme.text;
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : theme.icon;
  const separatorColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const pillBg = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)';
  const cardName = place.placeName?.trim() || place.rawTitle?.trim() || 'Lieu sélectionné';
  const googleRating = place.googleRating && place.googleRating > 0 ? place.googleRating : null;

  const p = cardExpansionProgress;

  /* ── Compact header (always visible) ── */
  const compactHeader = (
    <View {...cardPanResponder.panHandlers}>
      <View style={s.pillRow}>
        <Pressable onPress={toggleCardExpansion} hitSlop={8}>
          <View style={[s.pill, { backgroundColor: pillBg }]} />
        </Pressable>
      </View>
      <View style={s.compactRow}>
        <Pressable onPress={toggleCardExpansion} style={s.compactPressable}>
          <View style={s.thumbOuter}>
            {place.googlePhotoUrl ? (
              <Image source={{ uri: place.googlePhotoUrl }} style={s.thumbImg} resizeMode="cover" />
            ) : (
              <View style={[s.thumbFallback, { backgroundColor: isDark ? '#48494c' : theme.surface }]}>
                <Text style={s.thumbEmoji}>{place.markerEmoji ?? '📍'}</Text>
              </View>
            )}
          </View>
          <View style={s.compactInfo}>
            <Text style={[s.compactName, { color: textColor }]} numberOfLines={1}>
              {cardName}
            </Text>
            {cardAddress ? (
              <Text style={[s.compactAddr, { color: mutedColor }]} numberOfLines={2}>
                {cardAddress}
              </Text>
            ) : null}
            <View style={s.chips}>
              {googleRating ? (
                <View style={s.chipRow}>
                  <Ionicons name="star" size={11} color="#faad14" />
                  <Text style={[s.chipText, { color: textColor }]}>{googleRating.toFixed(1)}</Text>
                </View>
              ) : null}
              {effectiveRating > 0 ? (
                <View style={s.chipRow}>
                  <Ionicons name="heart" size={10} color="#ff6b9d" />
                  <Text style={[s.chipText, { color: mutedColor }]}>{effectiveRating}/5</Text>
                </View>
              ) : null}
              {providerInfo ? (
                <View style={s.chipRow}>
                  <FontAwesome5 name={providerInfo.icon} size={10} color={mutedColor} brand />
                  <Text style={[s.chipText, { color: mutedColor }]}>{providerInfo.label}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
        {/* Absolute: native Switch keeps full layout size when scaled — was clipped by card overflow */}
        <View style={s.compactTestedCorner} pointerEvents="box-none">
          <Text style={[s.compactTestedLabel, { color: mutedColor }]}>Testé</Text>
          <View style={s.compactSwitchScale}>
            <Switch
              value={effectiveTested}
              onValueChange={handleTestedToggle}
              trackColor={{ false: isDark ? '#39393D' : '#e0e0e0', true: '#34C759' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>
    </View>
  );

  /* ── Action buttons row ── */
  const actionBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const accentBlue = '#0a84ff';

  const actionsRow = (
    <View style={s.actionsRow}>
      {(merged.lat != null && merged.lon != null) && (
        <ActionPill
          icon="navigate-outline"
          label="Itinéraire"
          color={accentBlue}
          bg={actionBg}
          onPress={() => openMaps(merged.lat, merged.lon, cardName)}
        />
      )}
      {merged.phone && (
        <ActionPill
          icon="call-outline"
          label="Appeler"
          color={accentBlue}
          bg={actionBg}
          onPress={() => openDial(merged.phone!)}
        />
      )}
      {merged.googleWebsite && (
        <ActionPill
          icon="globe-outline"
          label="Site web"
          color={accentBlue}
          bg={actionBg}
          onPress={() => openWeb(merged.googleWebsite!)}
        />
      )}
      {merged.videoWebsite && (
        <ActionPill
          icon="play-circle-outline"
          label="Vidéo"
          color={accentBlue}
          bg={actionBg}
          onPress={() => openWeb(merged.videoWebsite!)}
        />
      )}
    </View>
  );

  /* ── Expanded details ── */
  const expandedDetails = (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.scrollContent, { paddingBottom: navbarClearance + 24 }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      bounces
    >
      {/* Hero image */}
      {place.googlePhotoUrl && (
        <View style={s.hero}>
          <Image source={{ uri: place.googlePhotoUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        </View>
      )}

      <View style={s.body}>
        {/* Title + category */}
        <Text style={[s.detailName, { color: textColor }]} numberOfLines={3}>
          {cardName}
        </Text>
        {place.category && (
          <Text style={[s.categoryText, { color: mutedColor }]}>{place.category}</Text>
        )}

        {/* Actions */}
        {actionsRow}

        <View style={[s.separator, { backgroundColor: separatorColor }]} />

        {/* Ma note */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: textColor }]}>Ma note</Text>
          <HeartRatingInput
            value={effectiveRating}
            onChange={handleRating}
            accent={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)'}
          />
        </View>

        <View style={[s.separator, { backgroundColor: separatorColor }]} />

        {/* Adresse */}
        {cardAddress ? (
          <Pressable style={s.infoRow} onPress={() => openMaps(merged.lat, merged.lon, cardName)}>
            <Ionicons name="location-outline" size={18} color={mutedColor} />
            <Text style={[s.infoText, { color: textColor }]} numberOfLines={4}>
              {cardAddress}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={mutedColor} />
          </Pressable>
        ) : null}

        {/* Horaires */}
        {(merged.openNow != null || merged.hoursLines.length > 0) && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <View style={s.section}>
              <View style={s.hoursHeaderRow}>
                <Ionicons name="time-outline" size={18} color={mutedColor} />
                <Text style={[s.sectionLabel, { color: textColor, flex: 1 }]}>Horaires</Text>
                {merged.openNow != null && (
                  <View style={[s.openBadge, { backgroundColor: merged.openNow ? (isDark ? 'rgba(52,199,89,0.2)' : 'rgba(52,199,89,0.12)') : (isDark ? 'rgba(255,59,48,0.18)' : 'rgba(255,59,48,0.1)') }]}>
                    <Text style={[s.openBadgeText, { color: merged.openNow ? '#34C759' : '#FF3B30' }]}>
                      {merged.openNow ? 'Ouvert' : 'Fermé'}
                    </Text>
                  </View>
                )}
              </View>
              {merged.hoursLines.map((line, i) => (
                <Text key={`h-${i}`} style={[s.hoursLine, { color: mutedColor }]}>{line}</Text>
              ))}
            </View>
          </>
        )}

        {/* Téléphone */}
        {merged.phone && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <Pressable style={s.infoRow} onPress={() => openDial(merged.phone!)}>
              <Ionicons name="call-outline" size={18} color={mutedColor} />
              <Text style={[s.infoText, { color: accentBlue }]}>{merged.phone}</Text>
              <Ionicons name="chevron-forward" size={14} color={mutedColor} />
            </Pressable>
          </>
        )}

        {/* Google rating */}
        {googleRating && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <View style={s.infoRow}>
              <Ionicons name="star" size={18} color="#faad14" />
              <Text style={[s.infoText, { color: textColor }]}>
                {googleRating.toFixed(1)} sur Google
                {place.googleUserRatingsTotal ? ` · ${place.googleUserRatingsTotal} avis` : ''}
              </Text>
            </View>
          </>
        )}

        {/* Sites web */}
        {merged.googleWebsite && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <Pressable style={s.infoRow} onPress={() => openWeb(merged.googleWebsite!)}>
              <Ionicons name="globe-outline" size={18} color={mutedColor} />
              <Text style={[s.infoText, { color: accentBlue }]} numberOfLines={1}>
                {normalizeHost(merged.googleWebsite)}
              </Text>
              <Ionicons name="open-outline" size={14} color={mutedColor} />
            </Pressable>
          </>
        )}
        {merged.videoWebsite && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <Pressable style={s.infoRow} onPress={() => openWeb(merged.videoWebsite!)}>
              <FontAwesome5 name={providerInfo?.icon ?? 'link'} size={15} color={mutedColor} brand={!!providerInfo} />
              <Text style={[s.infoText, { color: accentBlue }]} numberOfLines={1}>
                {normalizeHost(merged.videoWebsite)}
              </Text>
              <Ionicons name="open-outline" size={14} color={mutedColor} />
            </Pressable>
          </>
        )}

        {/* À propos */}
        {merged.editorial && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: textColor }]}>À propos</Text>
              <Text style={[s.bodyText, { color: mutedColor }]}>{merged.editorial}</Text>
            </View>
          </>
        )}

        {/* Notes perso */}
        {place.notes && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: textColor }]}>Notes</Text>
              <Text style={[s.bodyText, { color: mutedColor }]}>{place.notes}</Text>
            </View>
          </>
        )}

        {/* Types */}
        {merged.types.length > 0 && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: textColor }]}>Types</Text>
              <View style={s.typesWrap}>
                {merged.types.slice(0, 12).map((t) => (
                  <View
                    key={t}
                    style={[s.typeChip, { borderColor: separatorColor, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}
                  >
                    <Text style={[s.typeChipText, { color: mutedColor }]} numberOfLines={1}>
                      {t.replace(/_/g, ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Source */}
        {providerInfo && (
          <>
            <View style={[s.separator, { backgroundColor: separatorColor }]} />
            <View style={s.infoRow}>
              <FontAwesome5 name={providerInfo.icon} size={14} color={mutedColor} brand />
              <Text style={[s.infoText, { color: mutedColor }]}>Vu sur {providerInfo.label}</Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );

  /* ── Outer wrapper ── */
  const innerContent = (
    <View style={s.root}>
      {compactHeader}
      {expandedDetails}
    </View>
  );

  return (
    <Animated.View
      style={[
        w.cardWrap,
        {
          left: p.interpolate({ inputRange: [0, 1], outputRange: [COLLAPSED_SIDE_INSET, 0] }),
          right: p.interpolate({ inputRange: [0, 1], outputRange: [COLLAPSED_SIDE_INSET, 0] }),
          bottom: p.interpolate({ inputRange: [0, 1], outputRange: [navbarClearance, 0] }),
          height: p.interpolate({ inputRange: [0, 1], outputRange: [COLLAPSED_CARD_HEIGHT, expandedFullHeight] }),
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderBottomLeftRadius: p.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }),
          borderBottomRightRadius: p.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }),
        },
      ]}
    >
      {useLiquidGlass ? (
        <>
          <GlassView
            glassEffectStyle="regular"
            isInteractive={false}
            style={w.glassBg}
            pointerEvents="none"
          />
          <Animated.View style={[w.innerFade, { opacity: cardAppearProgress }]}>
            {innerContent}
          </Animated.View>
        </>
      ) : (
        <Animated.View style={[w.innerFade, { opacity: cardAppearProgress }]}>
          <View style={w.solid}>{innerContent}</View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/* ────────────────── Styles ────────────────── */

const w = StyleSheet.create({
  cardWrap: { position: 'absolute', zIndex: 1000, elevation: 1000, overflow: 'hidden' },
  glassBg: { ...StyleSheet.absoluteFillObject },
  innerFade: { flex: 1 },
  solid: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#2c2d30',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});

const s = StyleSheet.create({
  root: { flex: 1 },

  /* ── Header / Compact ── */
  pillRow: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  pill: { width: 36, height: 4, borderRadius: 2 },
  compactRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingRight: 10,
    paddingBottom: 14,
  },
  compactPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    paddingLeft: 4,
  },
  compactTestedCorner: {
    position: 'absolute',
    right: 10,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 2,
  },
  compactTestedLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  /** Scale wrapper: keeps hit target; transform still uses full RN layout size — absolute avoids card clip. */
  compactSwitchScale: {
    transform: [{ scaleX: 0.58 }, { scaleY: 0.58 }],
    marginRight: Platform.OS === 'ios' ? -10 : -6,
    marginBottom: Platform.OS === 'ios' ? -2 : 0,
  },
  thumbOuter: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 26 },
  /** paddingRight: text only — keeps thumb full width; stops 2nd address line / chips drawing under “Testé”+switch */
  compactInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
    minWidth: 0,
    paddingRight: 62,
  },
  compactName: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  compactAddr: { fontSize: 13, lineHeight: 17 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chipText: { fontSize: 12, fontWeight: '500', lineHeight: 16 },

  /* ── Scroll / Expanded ── */
  scroll: { flex: 1 },
  scrollContent: {},
  hero: { height: 200, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.08)' },
  body: { paddingHorizontal: 18, paddingTop: 14, gap: 0 },
  detailName: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  categoryText: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  /* ── Action pills ── */
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionPillText: { fontSize: 13, fontWeight: '600' },

  /* ── Separator ── */
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 14 },

  /* ── Section block ── */
  section: { gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '700' },

  /* ── Info row ── */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 28,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },

  /* ── Star input ── */
  heartInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  /* ── Hours ── */
  hoursHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  openBadgeText: { fontSize: 12, fontWeight: '600' },
  hoursLine: { fontSize: 13, lineHeight: 20, paddingLeft: 28 },

  /* ── Body text ── */
  bodyText: { fontSize: 14, lineHeight: 21 },

  /* ── Types ── */
  typesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeChipText: { fontSize: 12, lineHeight: 16 },
});
