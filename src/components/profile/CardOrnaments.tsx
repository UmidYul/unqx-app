import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import {
  getPetSlots,
  getVisibleProfilePets,
  normalizeProfileAvatarFrame,
  normalizeProfileEmojiBackgroundPack,
} from '@/design/cardExtras';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { CardThemeSpec, ProfileCardAvatarFrame, ProfileCardEmojiBackgroundPack, ProfileCardPet } from '@/types';

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  return {
    r: Number.parseInt(match[1].slice(0, 2), 16),
    g: Number.parseInt(match[1].slice(2, 4), 16),
    b: Number.parseInt(match[1].slice(4, 6), 16),
  };
}

function withAlpha(value: string, alpha: number): string {
  const rgb = hexToRgb(value);
  if (!rgb) return value;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function framePalette(theme: CardThemeSpec) {
  return {
    primary: theme.accentColor,
    secondary: theme.roleColor,
    accent: theme.nameColor,
    glow: withAlpha(theme.accentColor, 0.72),
    subtle: withAlpha(theme.surfaceBg, 0.44),
    white: '#ffffff',
    metal: '#d7dbe3',
    metalDeep: '#8d98a8',
  };
}

function EmojiGlyph({ pack, color }: { pack: ProfileCardEmojiBackgroundPack; color: string }): React.JSX.Element | null {
  switch (pack) {
    case 'ghosts':
      return (
        <>
          <Path d='M10 34c0-8.8 6.8-15.6 15.5-15.6 8.8 0 16 6.8 16 15.6v13.8c0 2.3-1.9 4.2-4.2 4.2-1.9 0-3.5-.9-4.8-2.5-1.2 1.6-2.8 2.5-4.8 2.5-2 0-3.8-.9-5-2.5-1.2 1.6-2.9 2.5-4.8 2.5-2.3 0-4.1-1.9-4.1-4.2Z' fill={color} opacity={0.9} />
          <Circle cx='23' cy='36' r='1.4' fill='#4b5563' />
          <Circle cx='31' cy='36' r='1.4' fill='#4b5563' />
        </>
      );
    case 'stars':
      return (
        <>
          <Path d='M24 10 28.3 19.1 38 20.4 30.8 27.1 32.6 36.7 24 31.8 15.4 36.7 17.2 27.1 10 20.4 19.7 19.1Z' fill={color} />
          <Circle cx='11.4' cy='11.6' r='2.3' fill={color} opacity={0.56} />
          <Circle cx='39' cy='13.8' r='1.6' fill={color} opacity={0.44} />
        </>
      );
    case 'lightning':
      return <Path d='M26.5 8 15 28h8l-3 14 13-18h-8.2Z' fill={color} />;
    case 'crowns':
      return (
        <>
          <Path d='m10 37 3.2-16 8.4 5.4L24 14l2.4 12.4 8.4-5.4L38 37Z' fill={color} />
          <Line x1='13.5' y1='40.5' x2='34.5' y2='40.5' stroke={color} strokeWidth='2' strokeLinecap='round' opacity='0.76' />
        </>
      );
    case 'webs':
      return (
        <>
          <Circle cx='24' cy='24' r='16' fill='none' stroke={color} strokeWidth='2' />
          <Circle cx='24' cy='24' r='8' fill='none' stroke={color} strokeWidth='1.8' />
          <Path d='M24 8v32M8 24h32M13 13l22 22M35 13 13 35' fill='none' stroke={color} strokeWidth='1.8' strokeLinecap='round' />
        </>
      );
    case 'hearts':
      return <Path d='M24 38 9 24.4c-3.2-2.9-5-6.1-5-9.6C4 9.9 7.9 6 12.8 6c3.1 0 6 1.4 7.9 3.8C22.6 7.4 25.5 6 28.6 6 33.5 6 37.4 9.9 37.4 14.8c0 3.5-1.8 6.7-5 9.6Z' fill={color} />;
    case 'none':
    default:
      return null;
  }
}

type SceneToken = { x: number; y: number; size: number; opacity?: number; rotate?: number };

const EMOJI_SCENES: Record<Exclude<ProfileCardEmojiBackgroundPack, 'none'>, {
  small: SceneToken[];
  accent: SceneToken[];
  large: SceneToken[];
  blobs?: Array<{ cx: number; cy: number; r: number; opacity: number }>;
}> = {
  ghosts: {
    blobs: [{ cx: 54, cy: 42, r: 34, opacity: 0.16 }, { cx: 262, cy: 46, r: 42, opacity: 0.12 }],
    small: [{ x: 14, y: 18, size: 30, opacity: 0.28 }, { x: 270, y: 12, size: 30, opacity: 0.22 }, { x: 230, y: 128, size: 24, opacity: 0.18 }],
    accent: [{ x: 80, y: 20, size: 40, opacity: 0.24 }, { x: 240, y: 56, size: 36, opacity: 0.2 }],
    large: [{ x: 22, y: 112, size: 48, opacity: 0.14 }, { x: 254, y: 140, size: 44, opacity: 0.12 }],
  },
  stars: {
    blobs: [{ cx: 266, cy: 40, r: 46, opacity: 0.14 }],
    small: [{ x: 24, y: 18, size: 26, opacity: 0.26 }, { x: 278, y: 18, size: 22, opacity: 0.24 }, { x: 256, y: 132, size: 26, opacity: 0.18 }],
    accent: [{ x: 98, y: 8, size: 42, opacity: 0.28 }, { x: 224, y: 50, size: 38, opacity: 0.24 }],
    large: [{ x: 12, y: 120, size: 48, opacity: 0.12 }, { x: 248, y: 144, size: 44, opacity: 0.12 }],
  },
  lightning: {
    blobs: [{ cx: 246, cy: 34, r: 42, opacity: 0.18 }, { cx: 60, cy: 146, r: 34, opacity: 0.12 }],
    small: [{ x: 18, y: 14, size: 28, opacity: 0.26 }, { x: 272, y: 18, size: 24, opacity: 0.22 }],
    accent: [{ x: 76, y: 18, size: 44, opacity: 0.32 }, { x: 228, y: 42, size: 40, opacity: 0.28 }],
    large: [{ x: 22, y: 126, size: 42, opacity: 0.16, rotate: -8 }, { x: 258, y: 138, size: 46, opacity: 0.12, rotate: 12 }],
  },
  crowns: {
    blobs: [{ cx: 92, cy: 24, r: 36, opacity: 0.16 }, { cx: 264, cy: 28, r: 40, opacity: 0.14 }],
    small: [{ x: 18, y: 12, size: 24, opacity: 0.22 }, { x: 278, y: 12, size: 24, opacity: 0.22 }],
    accent: [{ x: 96, y: 16, size: 40, opacity: 0.24 }, { x: 220, y: 34, size: 40, opacity: 0.24 }],
    large: [{ x: 18, y: 126, size: 42, opacity: 0.12 }, { x: 256, y: 138, size: 44, opacity: 0.12 }],
  },
  webs: {
    blobs: [{ cx: 42, cy: 30, r: 28, opacity: 0.1 }, { cx: 276, cy: 154, r: 30, opacity: 0.1 }],
    small: [{ x: 14, y: 14, size: 28, opacity: 0.2 }, { x: 278, y: 10, size: 24, opacity: 0.22 }],
    accent: [{ x: 92, y: 18, size: 42, opacity: 0.22 }, { x: 220, y: 38, size: 40, opacity: 0.22 }],
    large: [{ x: 12, y: 124, size: 46, opacity: 0.14 }, { x: 248, y: 142, size: 46, opacity: 0.12 }],
  },
  hearts: {
    blobs: [{ cx: 58, cy: 28, r: 30, opacity: 0.14 }, { cx: 264, cy: 40, r: 42, opacity: 0.14 }],
    small: [{ x: 16, y: 12, size: 24, opacity: 0.22 }, { x: 282, y: 14, size: 22, opacity: 0.2 }],
    accent: [{ x: 86, y: 16, size: 40, opacity: 0.24 }, { x: 224, y: 48, size: 38, opacity: 0.22 }],
    large: [{ x: 18, y: 126, size: 40, opacity: 0.14 }, { x: 254, y: 142, size: 42, opacity: 0.12 }],
  },
};

function SceneGlyphs({
  pack,
  items,
  color,
}: {
  pack: Exclude<ProfileCardEmojiBackgroundPack, 'none'>;
  items: SceneToken[];
  color: string;
}): React.JSX.Element {
  return (
    <>
      {items.map((item, index) => {
        const translateX = item.x;
        const translateY = item.y;
        const scale = item.size / 48;
        const rotate = item.rotate ? ` rotate(${item.rotate} 24 24)` : '';
        return (
          <G
            key={`${pack}-${index}-${item.x}-${item.y}`}
            opacity={item.opacity ?? 1}
            transform={`translate(${translateX} ${translateY}) scale(${scale})${rotate}`}
          >
            <EmojiGlyph pack={pack} color={color} />
          </G>
        );
      })}
    </>
  );
}

export function CardEmojiBackground({
  pack,
  theme,
}: {
  pack?: ProfileCardEmojiBackgroundPack;
  theme: CardThemeSpec;
}): React.JSX.Element | null {
  const normalized = normalizeProfileEmojiBackgroundPack(pack);
  if (normalized === 'none') {
    return null;
  }
  const scene = EMOJI_SCENES[normalized];
  return (
    <View pointerEvents='none' style={styles.emojiWrap}>
      <Svg viewBox='0 0 320 220' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
        {(scene.blobs ?? []).map((blob, index) => (
          <Circle
            key={`blob-${index}`}
            cx={blob.cx}
            cy={blob.cy}
            r={blob.r}
            fill={theme.accentColor}
            opacity={blob.opacity}
          />
        ))}
        <SceneGlyphs pack={normalized} items={scene.small} color={withAlpha(theme.roleColor, 0.92)} />
        <SceneGlyphs pack={normalized} items={scene.accent} color={withAlpha(theme.accentColor, 0.96)} />
        <SceneGlyphs pack={normalized} items={scene.large} color={withAlpha(theme.roleColor, 0.56)} />
      </Svg>
    </View>
  );
}

export function AvatarFrameOverlay({
  frame,
  theme,
}: {
  frame?: ProfileCardAvatarFrame;
  theme: CardThemeSpec;
}): React.JSX.Element | null {
  const normalized = normalizeProfileAvatarFrame(frame);
  if (normalized === 'none') {
    return null;
  }
  const colors = framePalette(theme);

  const strokeProps = { fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <View pointerEvents='none' style={styles.frameWrap}>
      <Svg viewBox='0 0 140 140' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
        {normalized === 'chrome_ring' ? (
          <>
            <Circle cx='70' cy='70' r='61' fill={colors.subtle} opacity={0.72} />
            <Circle cx='70' cy='70' r='58' stroke={colors.metal} strokeWidth='8' opacity={0.94} {...strokeProps} />
            <Circle cx='70' cy='70' r='48' stroke={colors.glow} strokeWidth='2.8' opacity={0.78} {...strokeProps} />
            <Path d='M28 42c16-12 34-18 54-18' stroke={colors.white} strokeWidth='2' opacity={0.82} {...strokeProps} />
          </>
        ) : null}
        {normalized === 'neon_spray' ? (
          <>
            <Circle cx='70' cy='70' r='58' stroke={colors.glow} strokeWidth='7' opacity={0.72} {...strokeProps} />
            <Circle cx='20' cy='66' r='4' fill={colors.accent} />
            <Circle cx='28' cy='52' r='3.2' fill={colors.secondary} />
            <Circle cx='32' cy='76' r='2.8' fill={colors.primary} />
            <Circle cx='110' cy='26' r='3.6' fill={colors.primary} />
            <Circle cx='122' cy='38' r='2.4' fill={colors.secondary} />
            <Circle cx='116' cy='52' r='2' fill={colors.accent} />
            <Circle cx='104' cy='114' r='4.2' fill={colors.secondary} />
            <Circle cx='118' cy='104' r='2.4' fill={colors.primary} />
            <Path d='M20 82c9 7 18 11 28 12' stroke={colors.primary} strokeWidth='2' {...strokeProps} />
          </>
        ) : null}
        {normalized === 'sticker_bubble' ? (
          <>
            <Path
              d='M70 12c28 0 50 8 58 28 7 18 6 42-2 58-10 18-32 32-58 32-26 0-48-10-58-28-11-20-8-47 6-64C28 22 47 12 70 12Z M70 20c14 0 27 4 36 11 10 8 17 22 17 39 0 16-6 29-16 38-10 9-23 14-37 14-15 0-28-5-38-14-10-9-16-22-16-38 0-18 7-32 18-40 10-7 22-10 36-10Z'
              fill={colors.white}
              opacity={0.92}
            />
            <Path d='M70 14c27 0 47 8 55 26 8 17 7 40-1 56-10 18-31 30-54 30-24 0-46-9-56-27C3 80 6 53 20 37 32 22 49 14 70 14Z' stroke={colors.primary} strokeWidth='2.4' {...strokeProps} />
            <Circle cx='70' cy='70' r='52.5' stroke={colors.white} strokeWidth='1.8' {...strokeProps} />
            <Path d='M24 104c8 8 18 14 30 18' stroke={colors.secondary} strokeWidth='1.8' {...strokeProps} />
          </>
        ) : null}
        {normalized === 'chain_link' ? (
          <>
            <Circle cx='70' cy='70' r='54' stroke={colors.primary} strokeWidth='2' strokeDasharray='6 8' {...strokeProps} />
            {[
              ['70', '14', '10', '6', undefined],
              ['118', '42', '10', '6', 'rotate(48 118 42)'],
              ['126', '96', '10', '6', 'rotate(90 126 96)'],
              ['70', '126', '10', '6', undefined],
              ['18', '98', '10', '6', 'rotate(130 18 98)'],
              ['18', '42', '10', '6', 'rotate(45 18 42)'],
            ].map(([cx, cy, rx, ry, transform], index) => (
              <Ellipse
                key={`chain-${index}`}
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                transform={transform}
                stroke={colors.secondary}
                strokeWidth='2'
                fill='none'
              />
            ))}
          </>
        ) : null}
        {normalized === 'pixel_glow' ? (
          <>
            <Path d='M38 20h64v10h10v18h10v44h-10v18h-10v10H38v-10H28V92H18V48h10V30h10Z' stroke={colors.primary} strokeWidth='7' {...strokeProps} />
            <Path d='M44 26h52v8h10v16h8v40h-8v16H96v8H44v-8H34V90h-8V50h8V34h10Z' stroke={colors.glow} strokeWidth='2.4' {...strokeProps} />
          </>
        ) : null}
        {normalized === 'starburst' ? (
          <>
            <Path d='M70 6L84 29L111 20L104 47L132 54L113 72L132 90L104 97L111 124L84 115L70 138L56 115L29 124L36 97L8 90L27 72L8 54L36 47L29 20L56 29Z' stroke={colors.secondary} strokeWidth='7' {...strokeProps} />
            <Path d='M70 6L84 29L111 20L104 47L132 54L113 72L132 90L104 97L111 124L84 115L70 138L56 115L29 124L36 97L8 90L27 72L8 54L36 47L29 20L56 29Z' stroke={colors.primary} strokeWidth='2' {...strokeProps} />
            <Circle cx='70' cy='70' r='51.5' stroke={colors.white} strokeWidth='1.8' {...strokeProps} />
          </>
        ) : null}
        {normalized === 'drip_outline' ? (
          <>
            <Path d='M70 14c28 0 50 21 54 47 2 15-2 29-11 40-8 10-10 18-10 26 0 9-7 15-14 15s-12-6-12-13v-14c0-5-3-8-7-8s-7 3-7 8v19c0 6-5 10-11 10s-11-5-11-11c0-13-4-23-11-31C12 92 8 79 10 66c4-30 29-52 60-52Z' stroke={colors.secondary} strokeWidth='7' {...strokeProps} />
            <Path d='M28 40c12-14 26-20 42-20' stroke={colors.primary} strokeWidth='2' {...strokeProps} />
          </>
        ) : null}
        {normalized === 'tape_collage' ? (
          <>
            <Rect x='18' y='18' width='38' height='12' rx='3' transform='rotate(-18 18 18)' fill={colors.white} opacity={0.92} />
            <Rect x='92' y='22' width='30' height='12' rx='3' transform='rotate(18 92 22)' fill={colors.secondary} opacity={0.88} />
            <Rect x='18' y='106' width='34' height='12' rx='3' transform='rotate(14 18 106)' fill={colors.secondary} opacity={0.88} />
            <Rect x='92' y='106' width='34' height='12' rx='3' transform='rotate(-12 92 106)' fill={colors.white} opacity={0.92} />
            <Circle cx='70' cy='70' r='54' stroke={colors.primary} strokeWidth='2' {...strokeProps} />
          </>
        ) : null}
        {normalized === 'orbit_dots' ? (
          <>
            <Ellipse cx='70' cy='70' rx='58' ry='44' stroke={colors.primary} strokeWidth='2' fill='none' />
            <Ellipse cx='70' cy='70' rx='44' ry='58' stroke={colors.secondary} strokeWidth='2' fill='none' />
            <Circle cx='22' cy='70' r='5' fill={colors.primary} />
            <Circle cx='118' cy='70' r='4.4' fill={colors.secondary} />
            <Circle cx='70' cy='18' r='4.6' fill={colors.accent} />
            <Circle cx='70' cy='122' r='4' fill={colors.white} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

export function CardPetsOverlay({
  pets,
  theme,
}: {
  pets?: ProfileCardPet[];
  theme: CardThemeSpec;
}): React.JSX.Element | null {
  const visiblePets = getVisibleProfilePets(pets);
  if (!visiblePets.length) {
    return null;
  }
  const slots = getPetSlots(visiblePets.length);
  return (
    <View pointerEvents='none' style={styles.petsWrap}>
      {visiblePets.map((pet, index) => {
        const slot = slots[index];
        const imageUrl = resolveAssetUrl(pet.assetUrl);
        return (
          <View key={`${pet.id || pet.petType}-${index}`} style={[styles.petItem, slot === 'left' ? styles.petLeft : slot === 'bottom-right' ? styles.petBottomRight : styles.petTopRight]}>
            <View style={styles.petVisual}>
              {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.petImage} resizeMode='contain' /> : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.petName,
                {
                  backgroundColor: withAlpha(theme.surfaceBg, 0.92),
                  borderColor: withAlpha(theme.accentColor, 0.2),
                  color: theme.nameColor,
                },
              ]}
            >
              {pet.displayName}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emojiWrap: {
    ...StyleSheet.absoluteFillObject,
    top: -10,
    opacity: 0.82,
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    left: -10,
    right: -10,
    top: -10,
    bottom: -10,
  },
  petsWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  petItem: {
    position: 'absolute',
    width: 88,
    alignItems: 'center',
    gap: 4,
  },
  petLeft: {
    left: 0,
    top: 78,
  },
  petTopRight: {
    left: '50%',
    marginLeft: -44,
    top: -52,
  },
  petBottomRight: {
    right: 6,
    top: 126,
  },
  petVisual: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  petName: {
    maxWidth: 86,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    overflow: 'hidden',
    fontFamily: 'Inter_500Medium',
  },
});
