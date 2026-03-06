import React from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Check, Copy, MessageCircle, Send, Share2, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { MESSAGES } from '@/constants/messages';
import { ThemeTokens } from '@/types';
import { getProfileURL } from '@/utils/links';
import { toast } from '@/utils/toast';

interface ShareSheetProps {
  visible: boolean;
  slug: string;
  name?: string;
  tokens: ThemeTokens;
  onClose: () => void;
}

export function ShareSheet({ visible, slug, name, tokens, onClose }: ShareSheetProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const shareUrl = React.useMemo(() => getProfileURL(slug, 'share'), [slug]);
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 280 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 280 }],
    opacity: progress.value,
  }));

  const openTelegram = React.useCallback(async () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(name ?? 'UNQX card')}`;
    await Linking.openURL(url);
  }, [name, shareUrl]);

  const openWhatsApp = React.useCallback(async () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareUrl)}`;
    await Linking.openURL(url);
  }, [shareUrl]);

  const copyLink = React.useCallback(async () => {
    try {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      toast.success(MESSAGES.toast.linkCopied);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(MESSAGES.toast.linkCopyFailed);
    }
  }, [shareUrl]);

  const openSystemShare = React.useCallback(async () => {
    try {
      await Share.share({
        message: shareUrl,
        url: shareUrl,
        title: 'UNQX',
      });
    } catch {
      // ignore share errors
    }
  }, [shareUrl]);

  return (
    <Modal visible={visible} transparent animationType='none' onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView tint='dark' intensity={40} style={StyleSheet.absoluteFillObject} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: tokens.phoneBg,
            },
            sheetStyle,
          ]}
        >
          <Pressable onPress={() => undefined}>
            <View style={[styles.handle, { backgroundColor: tokens.border }]} />
            <View style={styles.header}>
              <View>
                <Text style={[styles.title, { color: tokens.text }]}>Поделиться</Text>
                <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{`unqx.uz/${slug}`}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <X size={18} strokeWidth={1.5} color={tokens.textMuted} />
              </Pressable>
            </View>

            <View style={styles.actionsGrid}>
              <ActionButton
                label='Telegram'
                tokens={tokens}
                icon={<Send size={19} strokeWidth={1.7} color={tokens.text} />}
                onPress={() => void openTelegram()}
              />
              <ActionButton
                label='WhatsApp'
                tokens={tokens}
                icon={<MessageCircle size={19} strokeWidth={1.7} color={tokens.text} />}
                onPress={() => void openWhatsApp()}
              />
              <ActionButton
                label={copied ? 'Скопировано' : 'Копировать'}
                tokens={tokens}
                icon={copied ? <Check size={19} strokeWidth={1.9} color={tokens.text} /> : <Copy size={19} strokeWidth={1.7} color={tokens.text} />}
                onPress={() => void copyLink()}
              />
              <ActionButton
                label='Системный share'
                tokens={tokens}
                icon={<Share2 size={19} strokeWidth={1.7} color={tokens.text} />}
                onPress={() => void openSystemShare()}
              />
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function ActionButton({
  label,
  icon,
  tokens,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  tokens: ThemeTokens;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <AnimatedPressable onPress={onPress} style={styles.actionItem} accessibilityLabel={label}>
      <View style={[styles.actionIcon, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>{icon}</View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 18,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 18,
    rowGap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  actionItem: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
