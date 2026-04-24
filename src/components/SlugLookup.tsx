import React from 'react';
import { ActivityIndicator, Image, Linking, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Search } from 'lucide-react-native';

import { MESSAGES } from '@/constants/messages';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';
import { lookupSlugLike } from '@/services/mobileApi';
import { SlugLookupResult } from '@/types';
import { normalizeLookupSlug } from '@/utils/slug';
import { toast } from '@/utils/toast';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

interface SlugLookupCopy {
  title?: string;
  placeholder: string;
  priceLabel: string;
  pricePending: string;
  available: string;
  taken: string;
  pending: string;
  blocked: string;
  invalidFormat: string;
  buy: string;
  searchError: string;
  openLinkFailed: string;
}

interface SlugLookupTheme {
  surface: string;
  border: string;
  text: string;
  mutedText: string;
  primaryBg: string;
  primaryText: string;
  chipBg: string;
}

interface SlugLookupProps {
  copy: SlugLookupCopy;
  locale: string;
  theme: SlugLookupTheme;
  initialSlug?: string;
  leading?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  onOpenOwner?: (slug: string) => void;
}

function initial(value?: string): string {
  return String(value ?? 'U').trim().charAt(0).toUpperCase() || 'U';
}

function resolveStatusText(result: SlugLookupResult, copy: SlugLookupCopy): string {
  if (result.status === 'available') {
    return copy.available;
  }
  if (result.status === 'pending') {
    return copy.pending;
  }
  if (result.status === 'blocked') {
    return copy.blocked;
  }
  if (result.status === 'invalid_format') {
    return copy.invalidFormat;
  }
  return result.owner?.name || copy.taken;
}

export function SlugLookup({
  copy,
  locale,
  theme,
  initialSlug,
  leading,
  containerStyle,
  onOpenOwner,
}: SlugLookupProps): React.JSX.Element {
  const { isOnline } = useNetworkStatus({ invalidateOnReconnect: false });
  const [searchSlugValue, setSearchSlugValue] = React.useState(initialSlug ?? '');
  const [lookupPending, setLookupPending] = React.useState(false);
  const [lookupResult, setLookupResult] = React.useState<SlugLookupResult | null>(null);
  const lookupRequestIdRef = React.useRef(0);
  const lookupAvatar = useRetryImageUri(lookupResult?.owner?.avatarUrl);

  React.useEffect(() => {
    setSearchSlugValue(initialSlug ?? '');
  }, [initialSlug]);

  const clearLookup = React.useCallback(() => {
    lookupRequestIdRef.current += 1;
    setLookupResult(null);
    setLookupPending(false);
  }, []);

  const performLookupSlug = React.useCallback(async (rawSlug: string, silent: boolean) => {
    const targetSlug = normalizeLookupSlug(rawSlug);
    if (!targetSlug) {
      clearLookup();
      return;
    }

    if (!isOnline) {
      if (!silent) {
        toast.info(MESSAGES.toast.offlineQueued);
      }
      return;
    }

    const requestId = lookupRequestIdRef.current + 1;
    lookupRequestIdRef.current = requestId;
    setLookupPending(true);

    try {
      const result = await lookupSlugLike(targetSlug);
      if (lookupRequestIdRef.current !== requestId) {
        return;
      }
      setLookupResult(result);
    } catch {
      if (!silent) {
        toast.error(copy.searchError);
      }
    } finally {
      if (lookupRequestIdRef.current === requestId) {
        setLookupPending(false);
      }
    }
  }, [clearLookup, copy.searchError, isOnline]);

  const handleLookupSlug = React.useCallback(async () => {
    await performLookupSlug(searchSlugValue, false);
  }, [performLookupSlug, searchSlugValue]);

  const handleSearchSlugChange = React.useCallback((value: string) => {
    setSearchSlugValue(value);
    if (!normalizeLookupSlug(value)) {
      clearLookup();
    }
  }, [clearLookup]);

  React.useEffect(() => {
    const targetSlug = normalizeLookupSlug(searchSlugValue);
    if (!targetSlug) {
      clearLookup();
      return;
    }

    const timerId = setTimeout(() => {
      void performLookupSlug(searchSlugValue, true);
    }, 300);

    return () => clearTimeout(timerId);
  }, [clearLookup, performLookupSlug, searchSlugValue]);

  const handleBuySlug = React.useCallback(async () => {
    const targetSlug = lookupResult?.slug ? encodeURIComponent(lookupResult.slug) : '';
    if (!targetSlug) {
      return;
    }
    await Linking.openURL(`https://unqx.uz/?slug=${targetSlug}`).catch(() => {
      toast.error(copy.openLinkFailed);
    });
  }, [copy.openLinkFailed, lookupResult?.slug]);

  const handleOpenOwner = React.useCallback(() => {
    const ownerSlug = lookupResult?.owner?.slug;
    if (!lookupResult?.canOpenOwner || !ownerSlug || !onOpenOwner) {
      return;
    }
    onOpenOwner(ownerSlug);
  }, [lookupResult?.canOpenOwner, lookupResult?.owner?.slug, onOpenOwner]);

  const lookupPriceText = lookupResult?.price !== null && lookupResult?.price !== undefined
    ? `${lookupResult.price.toLocaleString(locale)} сум`
    : copy.pricePending;
  const resultStatusText = lookupResult ? resolveStatusText(lookupResult, copy) : '';
  const ownerClickable = Boolean(lookupResult?.canOpenOwner && lookupResult?.owner?.slug && onOpenOwner);

  const resultCardContent = lookupResult ? (
    lookupResult.status === 'available' ? (
      <>
        <View style={styles.lookupResultInfo}>
          <Text style={[styles.lookupSlug, { color: theme.text }]}>{lookupResult.slug}</Text>
          <Text style={[styles.lookupStatus, { color: theme.mutedText }]}>{resultStatusText}</Text>
        </View>
        <View style={styles.lookupResultRight}>
          <Text style={[styles.lookupPriceLabel, { color: theme.mutedText }]}>{copy.priceLabel}</Text>
          <Text style={[styles.lookupPrice, { color: theme.text }]}>{lookupPriceText}</Text>
          <AnimatedPressable
            style={[styles.buyButton, { borderColor: theme.primaryBg, backgroundColor: theme.primaryBg }]}
            onPress={() => {
              void handleBuySlug();
            }}
          >
            <Text style={[styles.buyButtonText, { color: theme.primaryText }]}>{copy.buy}</Text>
          </AnimatedPressable>
        </View>
      </>
    ) : (
      <>
        <View style={styles.lookupAvatarWrap}>
          {lookupResult.status === 'taken' && lookupAvatar.showImage && lookupAvatar.imageUri ? (
            <Image
              key={`${lookupResult.owner?.avatarUrl}:${lookupAvatar.retryCount}`}
              source={{ uri: lookupAvatar.imageUri }}
              style={styles.lookupAvatar}
              onError={lookupAvatar.onError}
            />
          ) : (
            <View style={[styles.lookupAvatar, { backgroundColor: theme.chipBg }]}>
              <Text style={[styles.lookupAvatarText, { color: theme.mutedText }]}>
                {initial(lookupResult.owner?.name ?? lookupResult.slug)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.lookupResultInfo}>
          <Text style={[styles.lookupSlug, { color: theme.text }]}>{lookupResult.slug}</Text>
          <Text style={[styles.lookupName, { color: theme.mutedText }]}>{resultStatusText}</Text>
        </View>
      </>
    )
  ) : null;

  return (
    <View style={[styles.root, containerStyle]}>
      {copy.title ? <Text style={[styles.title, { color: theme.mutedText }]}>{copy.title}</Text> : null}
      <View style={styles.lookupTopRow}>
        {leading}
        <View style={[styles.searchBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.slugPrefix, { color: theme.mutedText }]}>unqx.uz/</Text>
          <TextInput
            value={searchSlugValue}
            onChangeText={handleSearchSlugChange}
            placeholder={copy.placeholder}
            placeholderTextColor={theme.mutedText}
            autoCapitalize='characters'
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <AnimatedPressable
          style={[styles.searchAction, { borderColor: theme.border, backgroundColor: theme.surface }]}
          onPress={() => {
            void handleLookupSlug();
          }}
        >
          {lookupPending ? (
            <ActivityIndicator size='small' color={theme.text} />
          ) : (
            <Search size={16} color={theme.text} strokeWidth={1.8} />
          )}
        </AnimatedPressable>
      </View>

      {lookupResult ? (
        ownerClickable ? (
          <AnimatedPressable
            style={[styles.lookupResultCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={handleOpenOwner}
          >
            {resultCardContent}
          </AnimatedPressable>
        ) : (
          <View style={[styles.lookupResultCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            {resultCardContent}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  lookupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slugPrefix: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    paddingVertical: 0,
  },
  searchAction: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupResultCard: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lookupAvatarWrap: {
    width: 34,
    height: 34,
  },
  lookupAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupAvatarText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  lookupResultInfo: {
    flex: 1,
    gap: 2,
  },
  lookupSlug: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  lookupName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  lookupStatus: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  lookupResultRight: {
    minWidth: 90,
    alignItems: 'flex-end',
    gap: 6,
  },
  lookupPriceLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  lookupPrice: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
  },
  buyButton: {
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
