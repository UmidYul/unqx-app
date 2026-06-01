import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { FollowSummary } from '@/types';

import { SocialAvatar, SocialPalette } from './primitives';

interface FollowSummaryRowProps {
  summary?: FollowSummary;
  palette: SocialPalette;
  showPreviewCard?: boolean;
  text: {
    followers: string;
    following: string;
    followersSub: string;
    followingSub: string;
    follow: string;
    followingNow: string;
    followActionSub: string;
    previewsLabel: string;
  };
  action?: {
    active: boolean;
    label?: string;
    loading?: boolean;
    onPress: () => void;
  };
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
}

function SummaryCard({
  value,
  label,
  subtitle,
  palette,
  onPress,
}: {
  value: number;
  label: string;
  subtitle: string;
  palette: SocialPalette;
  onPress?: () => void;
}): React.JSX.Element {
  const inner = (
    <>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value.toLocaleString('ru-RU')}</Text>
      <Text style={[styles.summaryLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.summarySub, { color: palette.mutedText }]}>{subtitle}</Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {inner}
      </View>
    );
  }

  return (
    <AnimatedPressable
      containerStyle={styles.summaryCell}
      style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
      onPress={onPress}
    >
      {inner}
    </AnimatedPressable>
  );
}

export function FollowSummaryRow({
  summary,
  palette,
  showPreviewCard = true,
  text,
  action,
  onOpenFollowers,
  onOpenFollowing,
}: FollowSummaryRowProps): React.JSX.Element {
  const followers = summary?.counts.followers ?? 0;
  const following = summary?.counts.following ?? 0;
  const followingPreview = summary?.previews.following ?? [];
  const shouldShowPreviewCard = showPreviewCard && (followingPreview.length > 0 || Boolean(action));
  const shouldShowStandaloneAction = !showPreviewCard && Boolean(action);
  const actionLabel = action?.active ? text.followingNow : action?.label ?? text.follow;

  return (
    <View style={styles.wrap}>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCell}>
          <SummaryCard
            value={followers}
            label={text.followers}
            subtitle={text.followersSub}
            palette={palette}
            onPress={onOpenFollowers}
          />
        </View>
        <View style={styles.summaryCell}>
          <SummaryCard
            value={following}
            label={text.following}
            subtitle={text.followingSub}
            palette={palette}
            onPress={onOpenFollowing}
          />
        </View>
      </View>

      {shouldShowPreviewCard ? (
        <View style={[styles.previewCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.previewCenter}>
            {followingPreview.length > 0 ? (
              <View style={styles.previewList}>
                {followingPreview.slice(0, 5).map((item, index) => (
                  <View
                    key={`${item.userId ?? item.primarySlug ?? item.name}-${index}`}
                    style={[styles.previewItem, { marginLeft: index === 0 ? 0 : -12 }]}
                  >
                    <SocialAvatar
                      name={item.name}
                      initials={item.initials}
                      avatarUrl={item.avatarUrl}
                      size={44}
                      palette={palette}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {action ? (
              <AnimatedPressable
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: action.active ? palette.accentSoft : palette.surfaceAlt,
                    borderColor: action.active ? palette.accent : palette.border,
                    opacity: action.loading ? 0.7 : 1,
                  },
                ]}
                disabled={action.loading}
                hitSlop={8}
                onPress={action.onPress}
              >
                {action.loading ? (
                  <ActivityIndicator size='small' color={action.active ? palette.accent : palette.text} />
                ) : (
                  <Text
                    style={[
                      styles.actionSymbol,
                      { color: action.active ? palette.accent : palette.text },
                    ]}
                  >
                    {action.active ? '✓' : '+'}
                  </Text>
                )}
              </AnimatedPressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {shouldShowStandaloneAction && action ? (
        <AnimatedPressable
          style={[
            styles.standaloneActionButton,
            {
              backgroundColor: action.active ? palette.surfaceAlt : palette.accent,
              borderColor: action.active ? palette.accent : palette.accent,
              opacity: action.loading ? 0.7 : 1,
            },
          ]}
          disabled={action.loading}
          onPress={action.onPress}
        >
          {action.loading ? (
            <ActivityIndicator size='small' color={action.active ? palette.text : palette.accentText} />
          ) : (
            <Text
              style={[
                styles.standaloneActionText,
                { color: action.active ? palette.text : palette.accentText },
              ]}
            >
              {actionLabel}
            </Text>
          )}
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  summaryCell: {
    flex: 1,
  },
  summaryCard: {
    flex: 1,
    minHeight: 108,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 4,
    justifyContent: 'space-between',
  },
  summaryValue: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: 'Inter_700Bold',
  },
  summaryLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  summarySub: {
    minHeight: 36,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  previewCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  previewCenter: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  previewList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewItem: {
    borderRadius: 999,
  },
  actionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSymbol: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: 'Inter_700Bold',
  },
  standaloneActionButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  standaloneActionText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
});
