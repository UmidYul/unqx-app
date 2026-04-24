import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CardThemeBackdrop } from '@/components/profile/CardThemeBackdrop';
import { findButtonIcon } from '@/components/profile/buttonIcons';
import { resolveProfileCardTheme } from '@/design/cardThemes';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { ProfileCard, ThemeTokens } from '@/types';

interface CardPreviewProps {
  visible: boolean;
  card: ProfileCard;
  tokens: ThemeTokens;
  onClose: () => void;
}

interface ProfileCardSurfaceProps {
  card: ProfileCard;
  websiteLabel?: string;
  companyLine?: string;
  scoreLabel?: string;
  scoreTopLabel?: string;
  scoreValue?: string;
  scoreFillPercent?: number;
  footerViewsLabel?: string;
  aboutTitle?: string;
  onButtonPress?: (button: ProfileCard['buttons'][number], index: number) => void;
  showScoreBlock?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function resolvePreviewTheme(theme: ProfileCard['theme']): {
  cardBg: string;
  avatarBg: string;
  avatarText: string;
  name: string;
  job: string;
  slug: string;
  buttonBg: string;
  buttonText: string;
} {
  const spec = resolveProfileCardTheme(theme);
  return {
    cardBg: spec.cardBg,
    avatarBg: spec.avatarGradient?.[0] ?? spec.avatarBg,
    avatarText: spec.avatarText,
    name: spec.nameColor,
    job: spec.roleColor,
    slug: spec.accentColor,
    buttonBg: spec.buttonSecondaryBg === 'transparent' ? spec.surfaceBg : spec.buttonSecondaryBg,
    buttonText: spec.buttonSecondaryText,
  };
}

function ThemeButton({
  label,
  Icon,
  themeBg,
  themeGradient,
  textColor,
  borderColor,
  fontFamily,
  onPress,
}: {
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  themeBg: string;
  themeGradient?: readonly string[];
  textColor: string;
  borderColor: string;
  fontFamily: string;
  onPress?: () => void;
}): React.JSX.Element {
  const inner = (
    <View style={styles.actionButtonContent}>
      <Icon size={14} strokeWidth={1.5} color={textColor} />
      <Text style={[styles.actionButtonText, { color: textColor, fontFamily }]}>{label}</Text>
    </View>
  );

  if (themeGradient && themeGradient.length >= 2) {
    const content = (
      <LinearGradient colors={themeGradient as [string, string]} style={styles.actionButtonFill}>
        {inner}
      </LinearGradient>
    );

    if (onPress) {
      return (
        <Pressable onPress={onPress} style={[styles.actionButton, { borderColor }]}>
          {content}
        </Pressable>
      );
    }

    return (
      <View style={[styles.actionButton, { borderColor }]}>
        {content}
      </View>
    );
  }

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.actionButton, { borderColor, backgroundColor: themeBg }]}>
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.actionButton, { borderColor, backgroundColor: themeBg }]}>
      {inner}
    </View>
  );
}

function ThemeTopLine({ theme }: { theme: ReturnType<typeof resolveProfileCardTheme> }): React.JSX.Element {
  if (theme.topLineGradient && theme.topLineGradient.length >= 3) {
    return (
      <LinearGradient colors={theme.topLineGradient as [string, string, string]} style={styles.topLine} />
    );
  }

  return <View style={[styles.topLine, { backgroundColor: theme.topLineColor }]} />;
}

export function ProfileCardSurface({
  card,
  websiteLabel,
  companyLine,
  scoreLabel = 'UNQ SCORE',
  scoreTopLabel = 'Top 38%',
  scoreValue = '547',
  scoreFillPercent = 58,
  footerViewsLabel = '© 352 просмотров',
  aboutTitle = 'КОНТАКТЫ',
  onButtonPress,
  showScoreBlock = true,
  style,
}: ProfileCardSurfaceProps): React.JSX.Element {
  const theme = resolveProfileCardTheme(card.theme);
  const avatarImage = useRetryImageUri(card.avatarUrl);
  const hashtag = String(card.hashtag || '').trim();
  const resolvedHashtag = hashtag ? (hashtag.startsWith('#') ? hashtag : `#${hashtag}`) : '#UNQX';
  const primaryButtons = card.buttons.filter((button) => button.label).slice(0, 4);
  const themeTextStyle = { fontFamily: theme.fontFamily } as const;
  const resolvedCompanyLine = companyLine ?? `unqx ${card.email ? '• verified' : '• owner'}`;
  const resolvedWebsiteLabel = websiteLabel ?? `unqx.uz / ${card.slug || 'demo'}`;
  const boundedFillPercent = Math.max(0, Math.min(100, scoreFillPercent));
  const contactLines = [card.address, card.postcode, card.email, card.phone, card.extraPhone]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.cardBorder,
          borderRadius: theme.cardRadius,
          shadowColor: theme.shadowColor,
          shadowOpacity: theme.shadowOpacity,
          shadowRadius: theme.shadowRadius,
          shadowOffset: { width: 0, height: theme.shadowOffsetY },
          elevation: theme.elevation,
        },
        style,
      ]}
    >
      <LinearGradient colors={theme.cardGradient as [string, string, string]} style={[StyleSheet.absoluteFill, { borderRadius: theme.cardRadius }]} />
      <CardThemeBackdrop theme={theme} rounded={theme.cardRadius} />

      <ThemeTopLine theme={theme} />

      <View style={styles.metaRow}>
        <View style={styles.slugRow}>
          <View style={[styles.slugChip, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder || theme.cardBorder }]}>
            <Text style={[styles.slugChipText, themeTextStyle, { color: theme.badgeText }]}>{`# ${card.slug || 'AAA001'}`}</Text>
          </View>
          {(card.tags ?? []).slice(0, 2).map((tag, index) => (
            <View
              key={`${tag}-${index}`}
              style={[styles.slugChip, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder || theme.cardBorder }]}
            >
              <Text style={[styles.slugChipText, themeTextStyle, { color: theme.badgeText }]}>{tag.startsWith('#') ? tag : `# ${tag}`}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.priceChip, { backgroundColor: theme.surfaceBg, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.priceChipText, themeTextStyle, { color: theme.emailColor }]}>{resolvedWebsiteLabel}</Text>
        </View>
      </View>

      {card.showBranding !== false ? (
        <View style={styles.brandBlock}>
          <Text style={[styles.brandTitle, themeTextStyle, { color: theme.nameColor }]}>UNQX</Text>
          <Text style={[styles.brandSubtitle, themeTextStyle, { color: theme.roleColor }]}>POWERED BY SCXR</Text>
        </View>
      ) : null}

      <View style={styles.profileBlock}>
        <View
          style={[
            styles.avatarWrap,
            {
              borderColor: theme.avatarBorder,
              backgroundColor: theme.avatarBg,
            },
          ]}
        >
          {theme.avatarGradient ? (
            <LinearGradient colors={theme.avatarGradient as [string, string]} style={StyleSheet.absoluteFill} />
          ) : null}
          {avatarImage.showImage && avatarImage.imageUri ? (
            <Image
              key={`${card.avatarUrl}:${avatarImage.retryCount}`}
              source={{ uri: avatarImage.imageUri }}
              style={styles.avatarImage}
              onError={avatarImage.onError}
            />
          ) : (
            <Text style={[styles.avatarText, themeTextStyle, { color: theme.avatarText }]}>{card.name[0] || 'U'}</Text>
          )}
        </View>

        <Text
          style={[
            styles.name,
            {
              color: theme.nameColor,
              fontFamily: theme.fontFamily,
              fontStyle: theme.nameFontStyle,
              fontWeight: theme.nameFontWeight,
            },
          ]}
        >
          {card.name}
        </Text>
        <Text style={[styles.companyLine, themeTextStyle, { color: theme.emailColor }]}>{resolvedCompanyLine}</Text>
        <Text style={[styles.role, themeTextStyle, { color: theme.roleColor, letterSpacing: theme.roleLetterSpacing }]}>{card.job}</Text>
        {card.bio ? <Text style={[styles.bio, themeTextStyle, { color: theme.emailColor }]}>{card.bio}</Text> : null}
      </View>

      {showScoreBlock ? (
        <View style={[styles.scoreBlock, { backgroundColor: theme.surfaceBg, borderColor: theme.surfaceBorder }]}>
          <View style={styles.scoreHead}>
            <Text style={[styles.scoreLabel, themeTextStyle, { color: theme.scoreLabelColor }]}>{scoreLabel}</Text>
            <Text style={[styles.scoreTop, themeTextStyle, { color: theme.scorePercentileColor }]}>{scoreTopLabel}</Text>
          </View>
          <Text style={[styles.scoreValue, themeTextStyle, { color: theme.scoreValueColor }]}>{scoreValue}</Text>
          <View style={[styles.scoreTrack, { backgroundColor: theme.scoreBarTrack }]}>
            <View style={[styles.scoreFill, { width: `${boundedFillPercent}%`, backgroundColor: theme.scoreBarFill }]} />
          </View>
        </View>
      ) : null}

      {primaryButtons.length > 0 ? <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} /> : null}

      {primaryButtons.length > 0 ? (
        <View style={styles.actions}>
          {primaryButtons.map((button, index) => {
            const Icon = findButtonIcon(button.icon).Icon;
            const usePrimary = index === 0;
            return (
              <ThemeButton
                key={`btn-${index}`}
                label={button.label}
                Icon={Icon}
                themeBg={usePrimary ? theme.buttonPrimaryBg : theme.buttonSecondaryBg}
                themeGradient={usePrimary ? theme.buttonPrimaryGradient : theme.buttonSecondaryGradient}
                textColor={usePrimary ? theme.buttonPrimaryText : theme.buttonSecondaryText}
                borderColor={usePrimary ? theme.buttonPrimaryBorder : theme.buttonSecondaryBorder}
                fontFamily={theme.fontFamily}
                onPress={onButtonPress ? () => onButtonPress(button, index) : undefined}
              />
            );
          })}
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />

      <Text style={[styles.hashtag, themeTextStyle, { color: theme.accentColor }]}>{resolvedHashtag}</Text>

      {contactLines.length > 0 ? (
        <View style={[styles.aboutCard, { backgroundColor: theme.surfaceBg, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.aboutKicker, themeTextStyle, { color: theme.roleColor }]}>{aboutTitle}</Text>
          {contactLines.map((line, index) => (
            <Text key={`${line}-${index}`} style={[styles.aboutText, themeTextStyle, { color: theme.emailColor }]}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.footLine}>
        <Text style={[styles.footText, themeTextStyle, { color: theme.footerText }]}>{footerViewsLabel}</Text>
        <Text style={[styles.footText, themeTextStyle, { color: theme.footerText }]}>{card.showBranding === false ? '' : '• UNQX'}</Text>
      </View>
    </View>
  );
}

export function CardPreview({ visible, card, tokens, onClose }: CardPreviewProps): React.JSX.Element {
  const { language } = useLanguageContext();
  const isUz = language === 'uz';

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={[styles.hint, { color: tokens.textMuted }]}>
            {isUz ? "Boshqalar ko'radigan ko'rinish" : 'ПРЕДПРОСМОТР ПУБЛИЧНОЙ ВИЗИТКИ'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardWrap}>
            <ProfileCardSurface card={card} />
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: tokens.accent }]}>
            <Text style={[styles.closeText, { color: tokens.accentText }]}>{isUz ? 'Yopish' : 'Закрыть'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  sheet: {
    width: '100%',
    maxWidth: 390,
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 1.8,
    marginBottom: 12,
    fontFamily: 'Inter_500Medium',
  },
  cardWrap: {
    paddingBottom: 2,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    minHeight: 620,
  },
  topLine: {
    height: 2,
    borderRadius: 999,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  slugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  slugChip: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slugChipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  priceChip: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceChipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 24,
  },
  brandTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.6,
  },
  brandSubtitle: {
    marginTop: 4,
    fontSize: 13,
    letterSpacing: 2.2,
    fontFamily: 'Inter_500Medium',
  },
  profileBlock: {
    alignItems: 'center',
    marginTop: 22,
  },
  avatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 38,
    fontFamily: 'Inter_600SemiBold',
  },
  name: {
    marginTop: 18,
    fontSize: 42,
    lineHeight: 44,
    textAlign: 'center',
  },
  companyLine: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  role: {
    marginTop: 8,
    fontSize: 14,
    textTransform: 'uppercase',
    fontFamily: 'Inter_500Medium',
  },
  bio: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  scoreBlock: {
    marginTop: 22,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  scoreHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontFamily: 'Inter_500Medium',
  },
  scoreTop: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  scoreValue: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 36,
    fontFamily: 'Inter_600SemiBold',
  },
  scoreTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  scoreFill: {
    height: '100%',
    borderRadius: 999,
  },
  divider: {
    height: 1,
    marginTop: 20,
  },
  actions: {
    marginTop: 18,
    gap: 10,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionButtonFill: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  hashtag: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Inter_500Medium',
  },
  aboutCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  aboutKicker: {
    fontSize: 11,
    letterSpacing: 1.8,
    fontFamily: 'Inter_500Medium',
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  footLine: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  closeBtn: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
