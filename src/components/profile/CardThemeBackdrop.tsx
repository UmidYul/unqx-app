import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Line,
  Path,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';

import { CardThemeSpec } from '@/types';

interface CardThemeBackdropProps {
  theme: CardThemeSpec;
  rounded?: number;
}

function OverlayArtwork({ theme }: { theme: CardThemeSpec }): React.JSX.Element | null {
  switch (theme.overlay) {
    case 'default_flow':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id='dd-flow' x1='0%' y1='0%' x2='100%' y2='100%'>
              <Stop offset='0%' stopColor='#b0bbcb' stopOpacity='0.78' />
              <Stop offset='100%' stopColor='#dfe4ec' stopOpacity='0.92' />
            </SvgGradient>
            <SvgGradient id='dd-halo' x1='0%' y1='0%' x2='100%' y2='100%'>
              <Stop offset='0%' stopColor='#f8fbff' stopOpacity='0.42' />
              <Stop offset='100%' stopColor='#d7deea' stopOpacity='0.08' />
            </SvgGradient>
          </Defs>
          <Circle cx='286' cy='130' r='164' fill='url(#dd-halo)' opacity='0.2' />
          <Path d='M0 112C78 94 150 98 222 118C282 136 324 136 360 126' stroke='url(#dd-flow)' strokeWidth='0.88' fill='none' />
          <Path d='M0 324C74 306 146 312 216 332C278 350 322 352 360 342' stroke='url(#dd-flow)' strokeWidth='0.78' fill='none' />
          <Path d='M0 522C80 504 152 510 224 530C286 548 326 550 360 540' stroke='url(#dd-flow)' strokeWidth='0.68' fill='none' />
        </Svg>
      );
    case 'arctic_frost':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id='ar-line' x1='0%' y1='0%' x2='100%' y2='100%'>
              <Stop offset='0%' stopColor='#9cb8cf' stopOpacity='0.78' />
              <Stop offset='100%' stopColor='#d3e0ec' stopOpacity='0.9' />
            </SvgGradient>
            <SvgGradient id='ar-glow' x1='0%' y1='0%' x2='100%' y2='100%'>
              <Stop offset='0%' stopColor='#e8f3fd' stopOpacity='0.42' />
              <Stop offset='100%' stopColor='#cfdcea' stopOpacity='0.08' />
            </SvgGradient>
          </Defs>
          <Rect width='100%' height='100%' fill='rgba(255,255,255,0.16)' />
          <Circle cx='302' cy='104' r='160' fill='url(#ar-glow)' opacity='0.34' />
          <Path d='M0 58C74 42 146 52 216 76C278 96 322 98 360 86' stroke='#c6d7e6' strokeWidth='0.56' fill='none' />
          <Path d='M0 188C74 170 146 180 216 202C278 222 322 224 360 212' stroke='#c6d7e6' strokeWidth='0.5' fill='none' />
          <Path d='M0 420C72 402 144 410 214 432C278 450 322 452 360 440' stroke='#c6d7e6' strokeWidth='0.48' fill='none' />
          <Path d='M0 94C64 72 130 78 198 102C262 124 316 124 360 112' stroke='url(#ar-line)' strokeWidth='0.84' fill='none' />
          <Path d='M0 284C62 262 128 268 196 292C262 316 316 318 360 304' stroke='url(#ar-line)' strokeWidth='0.74' fill='none' />
          <Path d='M0 488C64 466 132 472 198 496C262 518 316 522 360 508' stroke='url(#ar-line)' strokeWidth='0.68' fill='none' />
        </Svg>
      );
    case 'linen_stitch':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id='ln-stitch' width='26' height='26' patternUnits='userSpaceOnUse'>
              <Path d='M0 13H26' stroke='#c5a07a' strokeWidth='0.28' strokeDasharray='3 6' fill='none' />
            </Pattern>
            <SvgGradient id='ln-wave' x1='0%' y1='0%' x2='100%' y2='100%'>
              <Stop offset='0%' stopColor='#97704a' stopOpacity='0.9' />
              <Stop offset='100%' stopColor='#c9ab87' stopOpacity='0.88' />
            </SvgGradient>
          </Defs>
          <Rect width='100%' height='100%' fill='url(#ln-stitch)' />
          <Path d='M0 96C72 70 146 78 214 98C278 116 322 116 360 104' stroke='url(#ln-wave)' strokeWidth='0.82' fill='none' />
          <Path d='M0 288C70 262 140 270 208 290C274 308 322 310 360 296' stroke='url(#ln-wave)' strokeWidth='0.72' fill='none' />
          <Path d='M0 500C72 474 146 484 214 504C278 522 322 526 360 514' stroke='url(#ln-wave)' strokeWidth='0.66' fill='none' />
        </Svg>
      );
    case 'marble_veins':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Rect width='100%' height='100%' fill='rgba(0,0,0,0.02)' />
          <Path d='M0 84C88 50 164 64 236 100C286 124 330 126 360 110' stroke='#5f5f5f' strokeWidth='1.2' fill='none' opacity='0.55' />
          <Path d='M0 222C78 192 150 204 222 236C286 264 328 264 360 252' stroke='#4a4a4a' strokeWidth='0.95' fill='none' opacity='0.48' />
          <Path d='M0 402C84 374 160 388 234 418C294 444 334 446 360 434' stroke='#616161' strokeWidth='0.86' fill='none' opacity='0.44' />
        </Svg>
      );
    case 'forest_grain':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Circle cx='70' cy='86' r='182' fill='rgba(231,219,191,0.06)' />
          <Circle cx='296' cy='482' r='208' fill='rgba(231,219,191,0.05)' />
          <Path d='M-12 168C52 136 126 132 210 154C288 176 332 178 378 164' stroke='rgba(231,219,191,0.15)' strokeWidth='1.2' fill='none' />
          <Path d='M-18 424C48 404 128 406 212 430C284 450 330 452 382 442' stroke='rgba(231,219,191,0.12)' strokeWidth='1' fill='none' />
          <Path d='M-6 548C72 528 152 534 236 554C298 568 338 572 376 564' stroke='rgba(231,219,191,0.1)' strokeWidth='0.9' fill='none' />
        </Svg>
      );
    case 'sage_geometry':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id='sg-flow' x1='0%' y1='0%' x2='100%' y2='100%'>
              <Stop offset='0%' stopColor='#8b9d8e' stopOpacity='0.8' />
              <Stop offset='100%' stopColor='#c3cdc4' stopOpacity='0.6' />
            </SvgGradient>
            <SvgGradient id='sg-glow' x1='0%' y1='0%' x2='100%' y2='100%'>
              <Stop offset='0%' stopColor='#f7fbf7' stopOpacity='0.48' />
              <Stop offset='100%' stopColor='#dfe8e1' stopOpacity='0.08' />
            </SvgGradient>
          </Defs>
          <Circle cx='288' cy='124' r='154' fill='url(#sg-glow)' opacity='0.3' />
          <Rect x='24' y='70' width='146' height='20' rx='10' fill='#dce6dd' opacity='0.34' />
          <Rect x='8' y='312' width='186' height='18' rx='9' fill='#d2ddd3' opacity='0.28' />
          <Rect x='122' y='472' width='202' height='16' rx='8' fill='#d7e1d8' opacity='0.26' />
          <Path d='M0 46C70 32 142 38 212 56C276 74 320 78 360 68' stroke='#b6c4b8' strokeWidth='0.5' fill='none' />
          <Path d='M0 238C72 224 144 232 214 248C276 266 320 270 360 260' stroke='#b6c4b8' strokeWidth='0.48' fill='none' />
          <Path d='M0 422C74 408 146 416 216 434C278 450 320 454 360 446' stroke='#b6c4b8' strokeWidth='0.46' fill='none' />
          <Path d='M0 548C74 532 146 536 214 552C278 566 320 570 360 562' stroke='url(#sg-flow)' strokeWidth='0.72' fill='none' />
        </Svg>
      );
    case 'midnight_constellation':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <G opacity='0.94'>
            <Circle cx='54' cy='74' r='2.3' fill='rgba(127,179,255,0.44)' />
            <Circle cx='128' cy='110' r='1.8' fill='rgba(127,179,255,0.36)' />
            <Circle cx='242' cy='84' r='2.2' fill='rgba(127,179,255,0.4)' />
            <Circle cx='308' cy='148' r='1.6' fill='rgba(127,179,255,0.3)' />
            <Circle cx='82' cy='286' r='1.5' fill='rgba(127,179,255,0.34)' />
            <Circle cx='196' cy='238' r='2' fill='rgba(127,179,255,0.32)' />
            <Circle cx='286' cy='356' r='2.2' fill='rgba(127,179,255,0.34)' />
            <Circle cx='112' cy='468' r='1.7' fill='rgba(127,179,255,0.34)' />
          </G>
          <Line x1='54' y1='74' x2='128' y2='110' stroke='rgba(127,179,255,0.12)' strokeWidth='1' />
          <Line x1='128' y1='110' x2='242' y2='84' stroke='rgba(127,179,255,0.12)' strokeWidth='1' />
          <Line x1='196' y1='238' x2='286' y2='356' stroke='rgba(127,179,255,0.1)' strokeWidth='1' />
          <Circle cx='282' cy='128' r='168' fill='rgba(127,179,255,0.06)' />
        </Svg>
      );
    case 'noir_gold_dust':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Circle cx='48' cy='64' r='2' fill='rgba(201,173,106,0.36)' />
          <Circle cx='144' cy='92' r='1.4' fill='rgba(201,173,106,0.24)' />
          <Circle cx='312' cy='118' r='2.2' fill='rgba(201,173,106,0.3)' />
          <Circle cx='250' cy='198' r='1.6' fill='rgba(201,173,106,0.24)' />
          <Circle cx='84' cy='382' r='1.8' fill='rgba(201,173,106,0.28)' />
          <Circle cx='286' cy='470' r='2' fill='rgba(201,173,106,0.28)' />
          <Path d='M18 164C94 142 170 142 250 160C304 172 336 174 360 168' stroke='rgba(201,173,106,0.1)' strokeWidth='1' fill='none' />
          <Path d='M-8 486C74 462 152 466 236 486C298 500 334 504 368 498' stroke='rgba(201,173,106,0.1)' strokeWidth='1' fill='none' />
        </Svg>
      );
    case 'codex_corner_lines':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Path d='M22 22H146M22 22V120' stroke='rgba(143,40,32,0.22)' strokeWidth='1.8' fill='none' />
          <Path d='M338 22H214M338 22V120' stroke='rgba(143,40,32,0.22)' strokeWidth='1.8' fill='none' />
          <Path d='M22 578H148M22 578V470' stroke='rgba(143,40,32,0.22)' strokeWidth='1.8' fill='none' />
          <Path d='M338 578H212M338 578V470' stroke='rgba(143,40,32,0.22)' strokeWidth='1.8' fill='none' />
          <Path d='M90 186C160 170 222 170 296 184' stroke='rgba(143,40,32,0.1)' strokeWidth='1.2' fill='none' />
          <Path d='M60 420C144 402 218 406 300 420' stroke='rgba(143,40,32,0.1)' strokeWidth='1.2' fill='none' />
        </Svg>
      );
    case 'velvet_weave':
      return (
        <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id='vl-light' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(35)'>
              <Line x1='0' y1='0' x2='0' y2='8' stroke='#ffffff' strokeOpacity='0.08' strokeWidth='0.42' />
            </Pattern>
            <Pattern id='vl-dark' width='10' height='10' patternUnits='userSpaceOnUse' patternTransform='rotate(-38)'>
              <Line x1='0' y1='0' x2='0' y2='10' stroke='#000000' strokeOpacity='0.11' strokeWidth='0.46' />
            </Pattern>
          </Defs>
          <Rect width='100%' height='100%' fill='url(#vl-light)' />
          <Rect width='100%' height='100%' fill='url(#vl-dark)' />
          <Circle cx='58' cy='86' r='152' fill='rgba(196,53,74,0.12)' />
          <Circle cx='302' cy='516' r='176' fill='rgba(139,26,42,0.1)' />
          <Path d='M0 120C72 98 152 100 236 120C290 134 326 138 360 134' stroke='rgba(201,165,90,0.12)' strokeWidth='1' fill='none' />
          <Path d='M0 344C72 322 150 324 236 344C292 356 326 360 360 356' stroke='rgba(201,165,90,0.1)' strokeWidth='1' fill='none' />
          <Path d='M0 540C72 520 150 522 236 542C292 554 326 558 360 554' stroke='rgba(201,165,90,0.08)' strokeWidth='1' fill='none' />
        </Svg>
      );
    default:
      return null;
  }
}

function GlassHighlights(): React.JSX.Element {
  return (
    <Svg viewBox='0 0 360 600' preserveAspectRatio='none' style={StyleSheet.absoluteFill}>
      <Circle cx='54' cy='82' r='128' fill='rgba(255,255,255,0.1)' />
      <Circle cx='304' cy='494' r='164' fill='rgba(255,255,255,0.08)' />
      <Path d='M0 0H360V172C310 126 240 106 164 124C92 142 40 132 0 96V0Z' fill='rgba(255,255,255,0.05)' />
      <Path d='M0 600V444C62 482 132 492 206 470C272 450 324 450 360 466V600H0Z' fill='rgba(255,255,255,0.03)' />
    </Svg>
  );
}

export function CardThemeBackdrop({ theme, rounded = 24 }: CardThemeBackdropProps): React.JSX.Element {
  return (
    <View
      pointerEvents='none'
      style={[
        styles.root,
        {
          borderRadius: rounded,
          backgroundColor: theme.cardBg,
        },
      ]}
    >
      {theme.id === 'nebula_glass' ? <BlurView tint='dark' intensity={26} style={StyleSheet.absoluteFill} /> : null}
      <OverlayArtwork theme={theme} />
      {theme.id === 'nebula_glass' ? <GlassHighlights /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
