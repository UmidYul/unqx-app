import React from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Mail, Phone, Star, UserCheck, UserPlus } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { ScreenTransition } from '@/components/ScreenTransition';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { Label, Pill } from '@/components/ui/shared';
import { MESSAGES } from '@/constants/messages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queryKeys } from '@/lib/queryKeys';
import { fetchResidentProfileLike, saveContactLike, subscribeContactLike } from '@/services/mobileApi';
import { ResidentProfile } from '@/types';
import { useThemeContext } from '@/theme/ThemeProvider';
import { formatSlug } from '@/utils/avatar';
import { toast } from '@/utils/toast';

function normalizeResidentSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

function initial(name: string): string {
  return (name || 'U').charAt(0).toUpperCase();
}

export default function ResidentProfilePage(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const queryClient = useQueryClient();

  const normalizedSlug = React.useMemo(() => {
    const value = Array.isArray(slug) ? slug[0] : slug;
    return normalizeResidentSlug(value);
  }, [slug]);

  const profileQuery = useQuery({
    queryKey: queryKeys.residentProfile(normalizedSlug),
    queryFn: () => fetchResidentProfileLike(normalizedSlug),
    enabled: Boolean(normalizedSlug),
  });

  const profile = profileQuery.data;
  const displaySlugs = profile?.slugs?.length ? profile.slugs : normalizedSlug ? [normalizedSlug] : [];

  const saveMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: () => saveContactLike(normalizedSlug),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      const previous = queryClient.getQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug));
      const nextSaved = !Boolean(previous?.saved);
      queryClient.setQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug), (old) =>
        old ? { ...old, saved: nextSaved } : old,
      );
      return { previous, nextSaved };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.residentProfile(normalizedSlug), context.previous);
      }
      toast.error(MESSAGES.toast.saveFailed);
    },
    onSuccess: (_data, _variables, context) => {
      toast.success(context?.nextSaved ? MESSAGES.toast.favoritesAdded : MESSAGES.toast.favoritesRemoved);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      void queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });

  const subscribeMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: () => subscribeContactLike(normalizedSlug),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      const previous = queryClient.getQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug));
      const nextSubscribed = !Boolean(previous?.subscribed);
      queryClient.setQueryData<ResidentProfile>(queryKeys.residentProfile(normalizedSlug), (old) =>
        old ? { ...old, subscribed: nextSubscribed } : old,
      );
      return { previous, nextSubscribed };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.residentProfile(normalizedSlug), context.previous);
      }
      toast.error(MESSAGES.toast.subscribeFailed);
    },
    onSuccess: (_data, _variables, context) => {
      toast.success(context?.nextSubscribed ? 'Добавлено в контакты' : 'Удалено из контактов');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.residentProfile(normalizedSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      void queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });

  const onRefresh = React.useCallback(async () => {
    await profileQuery.refetch();
  }, [profileQuery]);

  const handleToggleSaved = React.useCallback(() => {
    if (!normalizedSlug) {
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    saveMutation.mutate();
  }, [isOnline, normalizedSlug, saveMutation]);

  const handleToggleContact = React.useCallback(() => {
    if (!normalizedSlug) {
      return;
    }
    if (!isOnline) {
      toast.info(MESSAGES.toast.offlineQueued);
      return;
    }
    subscribeMutation.mutate();
  }, [isOnline, normalizedSlug, subscribeMutation]);

  if (!normalizedSlug) {
    return (
      <ErrorBoundary>
        <AppShell title='Профиль' tokens={tokens}>
          <ErrorState
            tokens={tokens}
            text='Некорректный slug пользователя'
            onRetry={() => {
              void profileQuery.refetch();
            }}
          />
        </AppShell>
      </ErrorBoundary>
    );
  }

  if (profileQuery.isLoading && !profile) {
    return (
      <AppShell title='Профиль' tokens={tokens}>
        <View style={styles.skeletonWrap}>
          <View style={[styles.heroCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <SkeletonCircle tokens={tokens} size={64} />
            <View style={styles.skeletonBody}>
              <SkeletonBlock tokens={tokens} height={16} width='56%' />
              <SkeletonBlock tokens={tokens} height={12} width='46%' />
              <View style={styles.skeletonPills}>
                <SkeletonBlock tokens={tokens} height={20} width={84} radius={6} />
                <SkeletonBlock tokens={tokens} height={20} width={102} radius={6} />
              </View>
            </View>
          </View>
          <View style={styles.skeletonActions}>
            <SkeletonBlock tokens={tokens} height={48} radius={12} style={styles.skeletonAction} />
            <SkeletonBlock tokens={tokens} height={48} radius={12} style={styles.skeletonAction} />
          </View>
          <SkeletonBlock tokens={tokens} height={120} radius={12} />
          <SkeletonBlock tokens={tokens} height={140} radius={12} />
        </View>
      </AppShell>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <ErrorBoundary>
        <AppShell title='Профиль' tokens={tokens}>
          <ErrorState
            tokens={tokens}
            text='Не удалось загрузить профиль пользователя'
            onRetry={() => {
              void profileQuery.refetch();
            }}
          />
        </AppShell>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell title='Профиль' tokens={tokens}>
        <ScreenTransition>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={profileQuery.isRefetching}
                onRefresh={() => void onRefresh()}
                tintColor={tokens.accent}
                colors={[tokens.accent]}
              />
            }
          >
            <View style={[styles.heroCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: `${tokens.accent}1F` }]}>
                  <Text style={[styles.avatarText, { color: tokens.accent }]}>{initial(profile.name)}</Text>
                </View>
              )}
              <View style={styles.heroBody}>
                <Text style={[styles.name, { color: tokens.text }]}>{profile.name}</Text>
                <Text style={[styles.slug, { color: tokens.textMuted }]}>
                  unqx.uz/<Text style={styles.slugStrong}>{formatSlug(profile.slug)}</Text>
                </Text>
                <View style={styles.pillRow}>
                  <Pill
                    color={profile.tag === 'premium' ? tokens.amber : tokens.textMuted}
                    bg={profile.tag === 'premium' ? tokens.amberBg : tokens.inputBg}
                  >
                    {profile.tag === 'premium' ? 'Премиум' : 'Базовый'}
                  </Pill>
                  <Pill color={tokens.textMuted} bg={tokens.inputBg}>{`${profile.taps ?? 0} тапов`}</Pill>
                </View>
                {profile.city ? <Text style={[styles.meta, { color: tokens.textMuted }]}>{profile.city}</Text> : null}
                {profile.role ? <Text style={[styles.meta, { color: tokens.text }]}>{profile.role}</Text> : null}
              </View>
            </View>

            <View style={styles.actionRow}>
              <AnimatedPressable
                containerStyle={styles.actionHalf}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: profile.saved ? tokens.amberBg : tokens.surface,
                    borderColor: profile.saved ? `${tokens.amber}66` : tokens.border,
                    opacity: saveMutation.isPending ? 0.5 : 1,
                  },
                ]}
                disabled={saveMutation.isPending}
                onPress={handleToggleSaved}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size='small' color={tokens.text} />
                ) : (
                  <>
                    <Star
                      size={16}
                      strokeWidth={1.5}
                      color={profile.saved ? tokens.amber : tokens.text}
                      fill={profile.saved ? tokens.amber : 'none'}
                    />
                    <Text style={[styles.actionText, { color: tokens.text }]}>
                      {profile.saved ? 'В избранном' : 'В избранное'}
                    </Text>
                  </>
                )}
              </AnimatedPressable>

              <AnimatedPressable
                containerStyle={styles.actionHalf}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: profile.subscribed ? tokens.greenBg : tokens.surface,
                    borderColor: profile.subscribed ? `${tokens.green}66` : tokens.border,
                    opacity: subscribeMutation.isPending ? 0.5 : 1,
                  },
                ]}
                disabled={subscribeMutation.isPending}
                onPress={handleToggleContact}
              >
                {subscribeMutation.isPending ? (
                  <ActivityIndicator size='small' color={tokens.text} />
                ) : (
                  <>
                    {profile.subscribed ? (
                      <UserCheck size={16} strokeWidth={1.5} color={tokens.green} />
                    ) : (
                      <UserPlus size={16} strokeWidth={1.5} color={tokens.text} />
                    )}
                    <Text style={[styles.actionText, { color: tokens.text }]}>
                      {profile.subscribed ? 'В контактах' : 'В контакты'}
                    </Text>
                  </>
                )}
              </AnimatedPressable>
            </View>

            <Label color={tokens.textMuted}>UNQ пользователя</Label>
            <View style={[styles.block, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              {displaySlugs.map((item, index) => (
                <Text
                  key={`${item}-${index}`}
                  style={[styles.slugLine, { color: tokens.text }]}
                >
                  {formatSlug(item)}
                </Text>
              ))}
            </View>

            <Label color={tokens.textMuted}>Резюме</Label>
            <View style={[styles.block, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <Text style={[styles.bio, { color: profile.bio ? tokens.text : tokens.textMuted }]}>
                {profile.bio || 'Пользователь пока не добавил резюме'}
              </Text>
            </View>

            {profile.email || profile.phone ? (
              <>
                <Label color={tokens.textMuted}>Контакты</Label>
                <View style={[styles.block, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                  {profile.email ? (
                    <View style={styles.infoRow}>
                      <Mail size={14} strokeWidth={1.5} color={tokens.textMuted} />
                      <Text style={[styles.infoText, { color: tokens.text }]}>{profile.email}</Text>
                    </View>
                  ) : null}
                  {profile.phone ? (
                    <View style={styles.infoRow}>
                      <Phone size={14} strokeWidth={1.5} color={tokens.textMuted} />
                      <Text style={[styles.infoText, { color: tokens.text }]}>{profile.phone}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {Array.isArray(profile.buttons) && profile.buttons.length > 0 ? (
              <>
                <Label color={tokens.textMuted}>Ссылки</Label>
                <View style={[styles.block, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                  {profile.buttons.map((button, index) => (
                    <Animated.View key={`${button.label}-${button.url}-${index}`} entering={FadeInDown.duration(180).delay(index * 35)}>
                      <AnimatedPressable
                        style={[styles.linkButton, { borderColor: tokens.border, backgroundColor: tokens.inputBg }]}
                        onPress={() => {
                          void Linking.openURL(button.url).catch(() => {
                            toast.error('Не удалось открыть ссылку');
                          });
                        }}
                      >
                        <Text style={[styles.linkLabel, { color: tokens.text }]} numberOfLines={1}>{button.label}</Text>
                        <Text style={[styles.linkUrl, { color: tokens.textMuted }]} numberOfLines={1}>{button.url}</Text>
                      </AnimatedPressable>
                    </Animated.View>
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>
        </ScreenTransition>
      </AppShell>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonPills: {
    flexDirection: 'row',
    gap: 6,
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: 10,
  },
  skeletonAction: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 12,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
  },
  heroBody: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  slug: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  slugStrong: {
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.9,
  },
  pillRow: {
    marginTop: 7,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  meta: {
    marginTop: 5,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionHalf: {
    flex: 1,
  },
  actionButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  block: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  slugLine: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  bio: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  linkButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  linkUrl: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
