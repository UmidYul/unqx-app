import React from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Award, Download, Search, Star, TrendingUp, UserX } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ErrorState';
import { ScreenTransition } from '@/components/ScreenTransition';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCircle } from '@/components/ui/skeleton';
import { Label, Pill } from '@/components/ui/shared';
import { MESSAGES } from '@/constants/messages';
import { useExport } from '@/hooks/useExport';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useStoreReview } from '@/hooks/useStoreReview';
import { useThrottledNavigation } from '@/hooks/useThrottledNavigation';
import { resolveAssetUrl } from '@/lib/assetUrl';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';
import { fetchContactsLike, fetchDirectoryLike, saveContactLike } from '@/services/mobileApi';
import { Contact, LeaderboardEntry, Resident } from '@/types';
import { useThemeContext } from '@/theme/ThemeProvider';
import { formatSlug } from '@/utils/avatar';
import { toast } from '@/utils/toast';

type PeopleTab = 'contacts' | 'directory' | 'leaderboard';

function parseContacts(raw: unknown): Contact[] {
  const source = (raw as { items?: unknown[]; contacts?: unknown[] })?.items ?? (raw as { contacts?: unknown[] })?.contacts ?? raw;
  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((item: any) => ({
    name: item?.name ?? item?.displayName ?? item?.ownerName ?? item?.firstName ?? 'Unknown',
    slug: item?.slug ?? item?.code ?? item?.fullSlug ?? 'UNQ000',
    avatarUrl: resolveAssetUrl(item?.avatarUrl),
    phone: item?.phone,
    taps: Number(item?.taps ?? item?.views ?? item?.count ?? 0),
    tag: item?.tag ?? item?.plan ?? 'basic',
    lastSeen: item?.lastSeen ?? item?.time,
    saved: Boolean(item?.saved),
  }));
}

function normalizeResidentSlug(value: unknown): string | null {
  const safe = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!safe) {
    return null;
  }
  return safe.slice(0, 20);
}

function collectResidentSlugs(item: any): string[] {
  const set = new Set<string>();
  const push = (candidate: unknown): void => {
    const normalized = normalizeResidentSlug(candidate);
    if (normalized) {
      set.add(normalized);
    }
  };

  [item?.slug, item?.fullSlug, item?.code, item?.unq, item?.unqSlug, item?.selectedSlug].forEach(push);

  [item?.slugs, item?.unqs, item?.codes].forEach((list) => {
    if (!Array.isArray(list)) {
      return;
    }
    for (const entry of list) {
      if (typeof entry === 'string') {
        push(entry);
      } else {
        push((entry as any)?.fullSlug ?? (entry as any)?.slug ?? (entry as any)?.code ?? (entry as any)?.unq);
      }
    }
  });

  return Array.from(set);
}

function getResidentGroupKey(item: any, name: string, avatarUrl?: string): string {
  const idCandidate = item?.userId ?? item?.ownerId ?? item?.accountId ?? item?.profileId ?? item?.memberId ?? item?.id;
  if (idCandidate !== undefined && idCandidate !== null && String(idCandidate).trim()) {
    return `id:${String(idCandidate).trim()}`;
  }

  const email = String(item?.email ?? '').trim().toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const phone = String(item?.phone ?? '').replace(/\D/g, '');
  if (phone) {
    return `phone:${phone}`;
  }

  return `fallback:${name.trim().toLowerCase()}|${String(avatarUrl ?? '').trim().toLowerCase()}`;
}

function parseResidents(raw: unknown): Resident[] {
  const source = (raw as { residents?: unknown[]; items?: unknown[] })?.residents ?? (raw as { items?: unknown[] })?.items ?? raw;
  if (!Array.isArray(source)) {
    return [];
  }

  const grouped = new Map<string, Resident>();

  source.forEach((entry: any) => {
    const name = String(entry?.name ?? entry?.displayName ?? entry?.ownerName ?? 'Unknown');
    const avatarUrl = resolveAssetUrl(entry?.avatarUrl);
    const city = String(entry?.city ?? entry?.verifiedCompany ?? '');
    const tag = entry?.tag ?? entry?.plan ?? 'basic';
    const taps = Number(entry?.taps ?? entry?.views ?? entry?.count ?? 0);
    const subscribed = Boolean(entry?.subscribed);
    const saved = Boolean(entry?.saved);
    const slugs = collectResidentSlugs(entry);
    const primarySlug = slugs[0] ?? normalizeResidentSlug(entry?.slug ?? entry?.fullSlug) ?? 'UNQ000';
    const groupKey = getResidentGroupKey(entry, name, avatarUrl);

    const existing = grouped.get(groupKey);
    if (!existing) {
      grouped.set(groupKey, {
        name,
        slug: primarySlug,
        slugs: slugs.length > 0 ? slugs : [primarySlug],
        avatarUrl,
        city,
        tag,
        taps,
        subscribed,
        saved,
      });
      return;
    }

    const nextSlugs = Array.from(new Set([...(existing.slugs ?? [existing.slug]), ...slugs]));
    existing.slugs = nextSlugs.length > 0 ? nextSlugs : [existing.slug];
    existing.slug = existing.slugs[0] ?? existing.slug;

    if (!existing.avatarUrl && avatarUrl) {
      existing.avatarUrl = avatarUrl;
    }
    if (!existing.city && city) {
      existing.city = city;
    }
    if (tag === 'premium') {
      existing.tag = 'premium';
    }
    existing.taps = Math.max(Number(existing.taps ?? 0), Number.isFinite(taps) ? taps : 0);
    existing.subscribed = Boolean(existing.subscribed || subscribed);
    existing.saved = Boolean(existing.saved || saved);
  });

  return Array.from(grouped.values()).sort((a, b) => Number(b.taps ?? 0) - Number(a.taps ?? 0));
}

function parseLeaderboard(raw: unknown): LeaderboardEntry[] {
  const source = (raw as { items?: unknown[] })?.items ?? raw;

  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((item: any, index: number) => ({
    rank: Number(item?.rank ?? index + 1),
    name: item?.name ?? item?.displayName ?? item?.ownerName ?? 'Unknown',
    slug: item?.slug ?? 'UNQ000',
    avatarUrl: resolveAssetUrl(item?.avatarUrl),
    taps: Number(item?.taps ?? item?.views ?? item?.count ?? 0),
    delta: Number(item?.delta ?? 0),
    score: Number(item?.score ?? 0),
    topPercent: item?.topPercent !== undefined ? Number(item?.topPercent) : undefined,
    verifiedCompany: item?.verifiedCompany,
  }));
}

function initial(name: string): string {
  return (name || 'U').charAt(0).toUpperCase();
}

function Avatar({
  name,
  avatarUrl,
  fallbackColor,
  style,
  textStyle,
}: {
  name: string;
  avatarUrl?: string;
  fallbackColor: string;
  style: any;
  textStyle: any;
}): React.JSX.Element {
  const [failed, setFailed] = React.useState(false);

  if (avatarUrl && !failed) {
    return <Image source={{ uri: avatarUrl }} style={style} onError={() => setFailed(true)} />;
  }

  return (
    <View style={[style, { backgroundColor: `${fallbackColor}1F` }]}>
      <Text style={[textStyle, { color: fallbackColor }]}>{initial(name)}</Text>
    </View>
  );
}

export default function PeoplePage(): React.JSX.Element {
  const { tokens } = useThemeContext();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const { safePush } = useThrottledNavigation();
  const { exportVCF, exportCSV } = useExport();
  const { incrementSuccess } = useStoreReview();
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState<PeopleTab>('contacts');

  const [contactsSearch, setContactsSearch] = React.useState('');
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);

  const [residentsSearch, setResidentsSearch] = React.useState('');

  React.useEffect(() => {
    const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (tabParam === 'contacts' || tabParam === 'directory' || tabParam === 'leaderboard') {
      setActiveTab(tabParam);
    }
  }, [params.tab]);

  const contactsQuery = useQuery({
    queryKey: queryKeys.contacts,
    queryFn: async () => parseContacts(await fetchContactsLike('')),
  });

  const directoryQuery = useQuery({
    queryKey: queryKeys.directory(residentsSearch.trim(), 1),
    queryFn: async () => parseResidents(await fetchDirectoryLike(residentsSearch.trim(), 1)),
    enabled: activeTab === 'directory',
  });

  const leaderboardQuery = useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: async () => parseLeaderboard(await apiClient.getFirst(['/leaderboard'])),
    enabled: activeTab === 'leaderboard',
  });

  const contacts = React.useMemo(() => (Array.isArray(contactsQuery.data) ? contactsQuery.data : parseContacts(contactsQuery.data)), [contactsQuery.data]);
  const residents = React.useMemo(
    () => (Array.isArray(directoryQuery.data) ? directoryQuery.data : parseResidents(directoryQuery.data)),
    [directoryQuery.data],
  );
  const board = React.useMemo(
    () => (Array.isArray(leaderboardQuery.data) ? leaderboardQuery.data : parseLeaderboard(leaderboardQuery.data)),
    [leaderboardQuery.data],
  );
  const isRefreshing =
    activeTab === 'contacts'
      ? contactsQuery.isRefetching
      : activeTab === 'directory'
        ? directoryQuery.isRefetching
        : leaderboardQuery.isRefetching;

  const onRefresh = React.useCallback(async () => {
    if (activeTab === 'contacts') {
      await contactsQuery.refetch();
      return;
    }
    if (activeTab === 'directory') {
      await directoryQuery.refetch();
      return;
    }
    await leaderboardQuery.refetch();
  }, [activeTab, contactsQuery, directoryQuery, leaderboardQuery]);

  const filteredContacts = React.useMemo(() => {
    const query = contactsSearch.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (favoritesOnly && !contact.saved) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${contact.name} ${contact.slug} ${contact.phone ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, contactsSearch, favoritesOnly]);

  const filteredResidents = React.useMemo(() => {
    const query = residentsSearch.trim().toLowerCase();
    if (!query) return residents;

    return residents.filter((item) => {
      const slugValues = (item.slugs?.length ? item.slugs : [item.slug]).join(' ');
      return `${item.name} ${slugValues}`.toLowerCase().includes(query);
    });
  }, [residents, residentsSearch]);

  const saveMutation = useMutation({
    networkMode: 'offlineFirst',
    mutationFn: (slug: string) => saveContactLike(slug),
    onMutate: async (slug: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.contacts });
      await queryClient.cancelQueries({ queryKey: ['directory'] });
      const previous = queryClient.getQueryData<Contact[]>(queryKeys.contacts);
      const previousDirectory = queryClient.getQueriesData<Resident[]>({ queryKey: ['directory'] });

      const savedInContacts = (Array.isArray(previous) ? previous : []).find((c) => c.slug === slug)?.saved;
      const savedInDirectory = previousDirectory
        .flatMap(([, value]) => (Array.isArray(value) ? value : []))
        .find((r) => r.slug === slug || r.slugs?.includes(slug))?.saved;
      const currentSaved = Boolean(savedInContacts ?? savedInDirectory ?? false);
      const nextSaved = !currentSaved;

      queryClient.setQueryData<Contact[]>(queryKeys.contacts, (old = []) =>
        (Array.isArray(old) ? old : []).map((c) => (c.slug === slug ? { ...c, saved: !c.saved } : c)),
      );
      queryClient.setQueriesData<Resident[]>({ queryKey: ['directory'] }, (old = []) =>
        (Array.isArray(old) ? old : []).map((r) =>
          r.slug === slug || r.slugs?.includes(slug)
            ? { ...r, saved: !r.saved }
            : r,
        ),
      );
      return { previous, previousDirectory, nextSaved };
    },
    onError: (_err, _slug, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.contacts, context.previous);
      }
      if (context?.previousDirectory) {
        for (const [key, value] of context.previousDirectory) {
          queryClient.setQueryData(key, value);
        }
      }
      toast.error(MESSAGES.toast.saveFailed);
    },
    onSuccess: (_data, _slug, context) => {
      toast.success(context?.nextSaved ? MESSAGES.toast.favoritesAdded : MESSAGES.toast.favoritesRemoved);
      void incrementSuccess().catch(() => undefined);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      void queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });

  const handleExportVCF = React.useCallback(() => {
    void exportVCF(
      filteredContacts.map((contact) => ({
        name: contact.name,
        slug: contact.slug,
        phone: contact.phone,
      })),
    );
  }, [exportVCF, filteredContacts]);

  const handleExportCSV = React.useCallback(() => {
    void exportCSV(
      filteredContacts.map((contact) => ({
        name: contact.name,
        slug: contact.slug,
        phone: contact.phone,
      })),
    );
  }, [exportCSV, filteredContacts]);

  const handleSaveContact = React.useCallback(
    (slug: string) => {
      if (!isOnline) {
        toast.info(MESSAGES.toast.offlineQueued);
        return;
      }
      saveMutation.mutate(slug);
    },
    [isOnline, saveMutation],
  );

  const handleOpenProfile = React.useCallback(
    (slug: string) => {
      const normalizedSlug = normalizeResidentSlug(slug);
      if (!normalizedSlug) {
        return;
      }
      safePush(`/(tabs)/people/${normalizedSlug}`);
    },
    [safePush],
  );

  const medals = ['1', '2', '3'];
  const topPalette = React.useMemo(
    () => [
      { bg: `${tokens.accent}14`, border: `${tokens.accent}66`, text: tokens.accent, badgeBg: `${tokens.accent}1F` },
      { bg: tokens.surface, border: tokens.borderStrong, text: tokens.text, badgeBg: tokens.inputBg },
      { bg: tokens.surface, border: tokens.border, text: tokens.textMuted, badgeBg: tokens.inputBg },
    ],
    [tokens],
  );

  const hardContactsError = contactsQuery.isError && !contactsQuery.data;
  const hardDirectoryError = directoryQuery.isError && activeTab === 'directory' && !directoryQuery.data;
  const hardLeaderboardError = leaderboardQuery.isError && activeTab === 'leaderboard' && !leaderboardQuery.data;

  return (
    <ErrorBoundary>
      <AppShell title={MESSAGES.ui.screens.people} tokens={tokens}>
      <View style={styles.container}>
        <View style={[styles.tabsWrap, { backgroundColor: tokens.surface }]}> 
          {[
            ['contacts', MESSAGES.ui.people.contacts],
            ['directory', MESSAGES.ui.people.residents],
            ['leaderboard', MESSAGES.ui.people.elite],
          ].map(([id, label]) => (
            <AnimatedPressable
              key={id}
              onPress={() => setActiveTab(id as PeopleTab)}
              containerStyle={styles.tabBtnContainer}
              style={[styles.tabBtn, { backgroundColor: activeTab === id ? tokens.tabActiveBg : 'transparent' }]}
            >
              <Text style={[styles.tabText, { color: activeTab === id ? tokens.tabActiveText : tokens.tabInactive }]}>{label}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <ScreenTransition>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={tokens.accent} colors={[tokens.accent]} />}
        >
          {activeTab === 'contacts' ? (
            <View style={styles.section}>
              {hardContactsError ? (
                <ErrorState
                  tokens={tokens}
                  onRetry={() => {
                    void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
                  }}
                />
              ) : null}

              {!hardContactsError ? (
                <>
              <View style={styles.searchRow}>
                <View style={[styles.searchInputWrap, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
                  <Search size={15} strokeWidth={1.5} color={tokens.textMuted} />
                  <TextInput
                    value={contactsSearch}
                    onChangeText={setContactsSearch}
                    placeholder='Поиск...'
                    placeholderTextColor={tokens.textMuted}
                    style={[styles.searchInput, { color: tokens.text }]}
                  />
                </View>
                <AnimatedPressable
                  onPress={() => setFavoritesOnly((prev) => !prev)}
                  style={[
                    styles.starToggle,
                    {
                      backgroundColor: favoritesOnly ? tokens.accent : tokens.surface,
                      borderColor: favoritesOnly ? tokens.accent : tokens.border,
                    },
                  ]}
                >
                  <Star size={16} strokeWidth={1.5} color={favoritesOnly ? tokens.accentText : tokens.text} fill={favoritesOnly ? tokens.accentText : 'none'} />
                </AnimatedPressable>
              </View>

              <View style={styles.exportRow}>
                <AnimatedPressable style={[styles.exportBtn, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={handleExportVCF}>
                  <Download size={14} strokeWidth={1.5} color={tokens.text} />
                  <Text style={[styles.exportText, { color: tokens.text }]}>Экспорт .vcf</Text>
                </AnimatedPressable>
                <AnimatedPressable style={[styles.exportBtn, { backgroundColor: tokens.surface, borderColor: tokens.border }]} onPress={handleExportCSV}>
                  <Download size={14} strokeWidth={1.5} color={tokens.text} />
                  <Text style={[styles.exportText, { color: tokens.text }]}>Экспорт .csv</Text>
                </AnimatedPressable>
              </View>

              <Label color={tokens.textMuted}>{`${filteredContacts.length} контактов${favoritesOnly ? ' · Избранные' : ''}`}</Label>
              {contactsQuery.isLoading && filteredContacts.length === 0 ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <View key={`contacts-sk-${i}`} style={[styles.contactCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                      <SkeletonCircle tokens={tokens} size={42} />
                      <View style={styles.contactBody}>
                        <View style={styles.contactHead}>
                          <SkeletonBlock tokens={tokens} height={12} width='52%' />
                          <SkeletonBlock tokens={tokens} height={18} width={64} radius={6} />
                        </View>
                        <SkeletonBlock tokens={tokens} height={10} width='68%' />
                      </View>
                      <SkeletonBlock tokens={tokens} width={20} height={20} radius={10} />
                    </View>
                  ))}
                </>
              ) : null}

              {filteredContacts.map((person, index) => (
                <Animated.View key={person.slug} entering={FadeInDown.duration(220).delay(index * 50)}>
                <View style={[styles.contactCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
                  <AnimatedPressable
                    containerStyle={styles.contactMainWrap}
                    style={styles.contactMain}
                    onPress={() => handleOpenProfile(person.slug)}
                  >
                    <Avatar
                      name={person.name}
                      avatarUrl={person.avatarUrl}
                      fallbackColor={tokens.accent}
                      style={styles.avatar}
                      textStyle={styles.avatarText}
                    />
                    <View style={styles.contactBody}>
                      <View style={styles.contactHead}>
                        <Text style={[styles.contactName, { color: tokens.text }]}>{person.name}</Text>
                        <Pill color={person.tag === 'premium' ? tokens.amber : tokens.textMuted} bg={person.tag === 'premium' ? tokens.amberBg : tokens.surface}>
                          {person.tag === 'premium' ? 'Премиум' : 'Базовый'}
                        </Pill>
                      </View>
                      <Text style={[styles.contactMeta, { color: tokens.textMuted }]}>{`${formatSlug(person.slug)} · ${person.taps ?? 0} тапов`}</Text>
                    </View>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => handleSaveContact(person.slug)}
                    disabled={saveMutation.isPending}
                    style={[styles.iconOnly, { opacity: saveMutation.isPending ? 0.5 : 1 }]}
                  >
                    {saveMutation.isPending ? (
                      <ActivityIndicator size='small' color={tokens.text} />
                    ) : (
                      <Star size={18} strokeWidth={1.5} color={person.saved ? tokens.amber : tokens.border} fill={person.saved ? tokens.amber : 'none'} />
                    )}
                  </AnimatedPressable>
                </View>
                </Animated.View>
              ))}
              {!contactsQuery.isLoading && filteredContacts.length === 0 ? (
                contactsSearch.trim() ? (
                  <EmptyState
                    icon={Search}
                    title='Никого не нашли'
                    subtitle={`По запросу "${contactsSearch.trim()}" нет результатов`}
                    tokens={tokens}
                    action={{
                      label: 'Сбросить поиск',
                      onPress: () => setContactsSearch(''),
                    }}
                  />
                ) : favoritesOnly ? (
                  <EmptyState
                    icon={Star}
                    title='Нет избранных'
                    subtitle='Нажми ★ рядом с контактом'
                    tokens={tokens}
                  />
                ) : (
                  <EmptyState
                    icon={UserX}
                    title='Нет контактов'
                    subtitle='Никто ещё не тапнул твою визитку'
                    tokens={tokens}
                  />
                )
              ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          {activeTab === 'directory' ? (
            <View style={styles.section}>
              {hardDirectoryError ? (
                <ErrorState
                  tokens={tokens}
                  onRetry={() => {
                    void queryClient.invalidateQueries({ queryKey: queryKeys.directory(residentsSearch.trim(), 1) });
                  }}
                />
              ) : null}

              {!hardDirectoryError ? (
                <>
              <View style={[styles.searchInputWrap, { backgroundColor: tokens.surface, borderColor: tokens.border }]}> 
                <Search size={15} strokeWidth={1.5} color={tokens.textMuted} />
                <TextInput
                  value={residentsSearch}
                  onChangeText={setResidentsSearch}
                  placeholder='Поиск резидента...'
                  placeholderTextColor={tokens.textMuted}
                  style={[styles.searchInput, { color: tokens.text }]}
                />
              </View>
              <Label color={tokens.textMuted}>{`${filteredResidents.length} резидентов`}</Label>

              {directoryQuery.isLoading && filteredResidents.length === 0 ? (
                <View style={styles.grid}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={`resident-sk-${i}`} style={[styles.residentCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                      <SkeletonCircle tokens={tokens} size={36} />
                      <SkeletonBlock tokens={tokens} height={11} width='82%' style={{ marginTop: 10 }} />
                      <SkeletonBlock tokens={tokens} height={10} width='65%' />
                      <View style={styles.residentFoot}>
                        <SkeletonBlock tokens={tokens} height={18} width={70} radius={6} />
                        <SkeletonBlock tokens={tokens} height={10} width={24} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.grid}>
                {filteredResidents.map((resident, index) => {
                  const residentSlugs = resident.slugs?.length ? resident.slugs : [resident.slug];
                  const visibleSlugs = residentSlugs.slice(0, 3).map((slug) => formatSlug(slug));
                  if (residentSlugs.length > 3) {
                    visibleSlugs.push(`+${residentSlugs.length - 3} ещё`);
                  }
                  const slugsText = visibleSlugs.join('\n');

                  return (
                    <Animated.View
                      key={`${resident.name}-${resident.slug}-${index}`}
                      entering={FadeInDown.duration(220).delay(index * 40)}
                      style={styles.residentCardWrap}
                    >
                      <AnimatedPressable
                        onPress={() => handleOpenProfile(resident.slug)}
                        style={[styles.residentCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                      > 
                        <Avatar
                          name={resident.name}
                          avatarUrl={resident.avatarUrl}
                          fallbackColor={tokens.accent}
                          style={styles.residentAvatar}
                          textStyle={styles.residentAvatarText}
                        />
                        <Text style={[styles.residentName, { color: tokens.text }]} numberOfLines={1}>{resident.name}</Text>
                        {resident.city ? (
                          <Text style={[styles.residentCity, { color: tokens.textMuted }]} numberOfLines={1}>
                            {resident.city}
                          </Text>
                        ) : null}
                        <Text style={[styles.residentSlug, { color: tokens.textMuted }]} numberOfLines={4}>
                          {slugsText}
                        </Text>
                        <View style={styles.residentFoot}>
                          <Pill color={resident.tag === 'premium' ? tokens.amber : tokens.textMuted} bg={resident.tag === 'premium' ? tokens.amberBg : tokens.surface}>
                            {resident.tag === 'premium' ? 'Премиум' : 'Базовый'}
                          </Pill>
                          <Text style={[styles.residentTaps, { color: tokens.textMuted }]}>{resident.taps ?? 0}</Text>
                        </View>
                      </AnimatedPressable>
                    </Animated.View>
                  );
                })}
              </View>
              {!directoryQuery.isLoading && filteredResidents.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title='Никого не нашли'
                  subtitle={
                    residentsSearch.trim()
                      ? `По запросу "${residentsSearch.trim()}" нет результатов`
                      : 'Попробуй другой запрос'
                  }
                  tokens={tokens}
                  action={
                    residentsSearch.trim()
                      ? {
                          label: 'Сбросить поиск',
                          onPress: () => setResidentsSearch(''),
                        }
                      : undefined
                  }
                />
              ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          {activeTab === 'leaderboard' ? (
            <View style={styles.section}>
              {hardLeaderboardError ? (
                <ErrorState
                  tokens={tokens}
                  onRetry={() => {
                    void queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
                  }}
                />
              ) : null}

              {!hardLeaderboardError ? (
                <>
              {leaderboardQuery.isLoading && board.length === 0 ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <View key={`board-sk-${i}`} style={[styles.rankRow, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                      <SkeletonBlock tokens={tokens} width={28} height={18} radius={6} />
                      <SkeletonCircle tokens={tokens} size={36} />
                      <View style={styles.rankBody}>
                        <SkeletonBlock tokens={tokens} height={11} width='58%' />
                        <SkeletonBlock tokens={tokens} height={10} width='42%' />
                      </View>
                      <View style={styles.rankRight}>
                        <SkeletonBlock tokens={tokens} height={14} width={36} />
                        <SkeletonBlock tokens={tokens} height={10} width={30} />
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
              {board.map((row, index) => (
                <AnimatedPressable
                  key={`${row.rank}-${row.slug}`}
                  onPress={() => handleOpenProfile(row.slug)}
                  style={[
                    styles.rankRow,
                    index < 3 ? styles.rankRowTop : undefined,
                    {
                      backgroundColor: index < 3 ? topPalette[index].bg : tokens.surface,
                      borderColor: index < 3 ? topPalette[index].border : tokens.border,
                      borderWidth: index < 3 ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rankPos,
                      {
                        color: index < 3 ? topPalette[index].text : tokens.textMuted,
                        fontSize: index < 3 ? 20 : 18,
                      },
                    ]}
                  >
                    {index < 3 ? medals[index] : row.rank}
                  </Text>
                  <Avatar
                    name={row.name}
                    avatarUrl={row.avatarUrl}
                    fallbackColor={tokens.accent}
                    style={styles.rankAvatar}
                    textStyle={styles.rankAvatarText}
                  />
                  <View style={styles.rankBody}>
                    <View style={styles.rankNameRow}>
                      <Text style={[styles.rankName, { color: tokens.text }]}>{row.name}</Text>
                      {index < 3 ? (
                        <View style={[styles.topBadge, { backgroundColor: topPalette[index].badgeBg, borderColor: topPalette[index].border }]}>
                          <Text style={[styles.topBadgeText, { color: topPalette[index].text }]}>{`TOP ${index + 1}`}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.rankSlug, { color: tokens.textMuted }]}>
                      {row.verifiedCompany ? `${row.verifiedCompany} · ${formatSlug(row.slug)}` : formatSlug(row.slug)}
                    </Text>
                  </View>
                  <View style={styles.rankRight}>
                    <Text style={[styles.rankTaps, { color: tokens.text }]}>{row.taps}</Text>
                    {row.delta > 0 ? (
                      <View style={styles.rankDeltaRow}>
                        <TrendingUp size={11} strokeWidth={1.5} color={tokens.green} />
                        <Text style={[styles.rankDelta, { color: tokens.green }]}>{`+${row.delta}`}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.rankMeta, { color: tokens.textMuted }]}>
                        {row.score ? `Score ${row.score}` : row.topPercent !== undefined ? `Top ${row.topPercent}%` : ''}
                      </Text>
                    )}
                  </View>
                </AnimatedPressable>
              ))}
              {!leaderboardQuery.isLoading && board.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title='Пока никого нет'
                  subtitle=' '
                  tokens={tokens}
                />
              ) : null}
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        </ScreenTransition>
      </View>
      </AppShell>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  tabsWrap: {
    borderRadius: 10,
    padding: 3,
    flexDirection: 'row',
    gap: 2,
  },
  tabBtnContainer: {
    flex: 1,
  },
  tabBtn: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  starToggle: {
    width: 42,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  exportText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  contactCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  contactBody: {
    flex: 1,
  },
  contactMainWrap: {
    flex: 1,
  },
  contactMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  contactHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  contactName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  contactMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  iconOnly: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  residentCardWrap: {
    width: '48.5%',
  },
  residentCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    minHeight: 210,
  },
  residentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  residentAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  residentName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  residentCity: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    marginBottom: 2,
  },
  residentSlug: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
    minHeight: 60,
    marginBottom: 8,
  },
  residentFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  residentTaps: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  rankRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  rankRowTop: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  rankPos: {
    width: 28,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  rankBody: {
    flex: 1,
  },
  rankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rankName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  topBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  topBadgeText: {
    fontSize: 9,
    letterSpacing: 0.3,
    fontFamily: 'Inter_600SemiBold',
  },
  rankSlug: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  rankRight: {
    alignItems: 'flex-end',
  },
  rankTaps: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  rankDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rankDelta: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  rankMeta: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
});
