import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { FollowListItem, WallPagination } from '@/types';

import { SocialAvatar, SocialPalette, SocialVerifiedIcon } from './primitives';

interface FollowListModalProps {
  visible: boolean;
  title: string;
  subtitle: string;
  items: FollowListItem[];
  pagination?: WallPagination;
  loading?: boolean;
  loadingMore?: boolean;
  palette: SocialPalette;
  text: {
    close: string;
    empty: string;
    loadMore: string;
    follow: string;
    followingNow: string;
  };
  followBusySlug?: string | null;
  onClose: () => void;
  onOpenProfile?: (item: FollowListItem) => void;
  onToggleFollow?: (item: FollowListItem) => void;
  onLoadMore?: () => void;
}

export function FollowListModal({
  visible,
  title,
  subtitle,
  items,
  pagination,
  loading,
  loadingMore,
  palette,
  text,
  followBusySlug,
  onClose,
  onOpenProfile,
  onToggleFollow,
  onLoadMore,
}: FollowListModalProps): React.JSX.Element {
  const hasMore = Boolean(pagination?.hasMore && onLoadMore);

  return (
    <Modal visible={visible} animationType='fade' transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: palette.mutedText }]}>{subtitle}</Text>
            </View>
            <AnimatedPressable
              style={[styles.closeButton, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
              onPress={onClose}
            >
              <Text style={[styles.closeText, { color: palette.text }]}>{text.close}</Text>
            </AnimatedPressable>
          </View>

          {loading ? (
            <View style={styles.loaderBlock}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {items.length > 0 ? items.map((item, index) => {
                const itemKey = item.primarySlug ?? item.userId ?? `${item.name}-${index}`;
                const followLabel = item.isFollowing ? text.followingNow : text.follow;
                const busy = followBusySlug === item.primarySlug;

                return (
                  <View
                    key={itemKey}
                    style={[
                      styles.row,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.surfaceAlt,
                      },
                    ]}
                  >
                    <AnimatedPressable
                      containerStyle={styles.rowMainContainer}
                      style={styles.rowMain}
                      onPress={() => onOpenProfile?.(item)}
                    >
                      <SocialAvatar
                        name={item.name}
                        initials={item.initials}
                        avatarUrl={item.avatarUrl}
                        size={44}
                        palette={palette}
                      />
                      <View style={styles.rowText}>
                        <View style={styles.rowNameLine}>
                          <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.verified ? <SocialVerifiedIcon color={palette.accent} size={13} /> : null}
                        </View>
                        <Text style={[styles.rowSub, { color: palette.mutedText }]} numberOfLines={1}>
                          {item.primarySlug ? `unqx.uz/${item.primarySlug}` : (item.role || 'UNQX')}
                        </Text>
                      </View>
                    </AnimatedPressable>

                    {item.canFollow !== false && onToggleFollow ? (
                      <AnimatedPressable
                        style={[
                          styles.followButton,
                          {
                            backgroundColor: item.isFollowing ? palette.accentSoft : palette.surface,
                            borderColor: item.isFollowing ? palette.accent : palette.border,
                            opacity: busy ? 0.7 : 1,
                          },
                        ]}
                        disabled={busy}
                        onPress={() => onToggleFollow(item)}
                      >
                        {busy ? (
                          <ActivityIndicator size='small' color={item.isFollowing ? palette.accent : palette.text} />
                        ) : (
                          <Text style={[styles.followText, { color: item.isFollowing ? palette.accent : palette.text }]}>
                            {followLabel}
                          </Text>
                        )}
                      </AnimatedPressable>
                    ) : null}
                  </View>
                );
              }) : (
                <View style={[styles.emptyBlock, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
                  <Text style={[styles.emptyText, { color: palette.mutedText }]}>{text.empty}</Text>
                </View>
              )}

              {hasMore ? (
                <AnimatedPressable
                  style={[styles.moreButton, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
                  disabled={loadingMore}
                  onPress={onLoadMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size='small' color={palette.accent} />
                  ) : (
                    <Text style={[styles.moreText, { color: palette.text }]}>{text.loadMore}</Text>
                  )}
                </AnimatedPressable>
              ) : null}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 18,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  sheet: {
    maxHeight: '82%',
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  closeButton: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  loaderBlock: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 12,
    paddingBottom: 8,
  },
  row: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMainContainer: {
    flex: 1,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  rowSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  followButton: {
    minWidth: 110,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyBlock: {
    minHeight: 120,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  moreButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
