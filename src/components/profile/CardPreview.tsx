import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileCard, ThemeTokens } from '@/types';
import { findButtonIcon } from '@/components/profile/buttonIcons';
import { useRetryImageUri } from '@/hooks/useRetryImageUri';

interface CardPreviewProps {
  visible: boolean;
  card: ProfileCard;
  tokens: ThemeTokens;
  onClose: () => void;
}

function resolvePreviewTheme(theme: ProfileCard['theme']): {
  cardBg: string;
  avatarBg: string;
  avatarText: string;
  name: string;
  job: string;
  slug: string;
  buttonBg: string;
  buttonText: string;
} {
  if (theme === 'arctic') {
    return {
      cardBg: '#f0f5f9',
      avatarBg: '#dce6ef',
      avatarText: '#365066',
      name: '#1a2a3a',
      job: '#6f8ba4',
      slug: '#4a6880',
      buttonBg: '#dce6ef',
      buttonText: '#1a2a3a',
    };
  }
  if (theme === 'linen') {
    return {
      cardBg: '#f2ede6',
      avatarBg: '#dfd4c8',
      avatarText: '#6b5540',
      name: '#3a2e24',
      job: '#8a7060',
      slug: '#6b5540',
      buttonBg: '#ebe3da',
      buttonText: '#3a2e24',
    };
  }
  if (theme === 'marble') {
    return {
      cardBg: '#ffffff',
      avatarBg: '#f1f1f1',
      avatarText: '#444444',
      name: '#0a0a0a',
      job: '#8b8b8b',
      slug: '#222222',
      buttonBg: '#f5f5f5',
      buttonText: '#111111',
    };
  }
  if (theme === 'forest') {
    return {
      cardBg: '#0e2010',
      avatarBg: '#162a18',
      avatarText: '#e8dcc0',
      name: '#f0e8d0',
      job: '#9ab18d',
      slug: '#d8c7a0',
      buttonBg: '#19311c',
      buttonText: '#e8dcc0',
    };
  }

  return {
    cardBg: '#111111',
    avatarBg: '#222222',
    avatarText: '#e8dfc8',
    name: '#f5f5f5',
    job: 'rgba(255,255,255,0.5)',
    slug: '#e8dfc8',
    buttonBg: 'rgba(255,255,255,0.08)',
    buttonText: '#f5f5f5',
  };
}

export function CardPreview({ visible, card, tokens, onClose }: CardPreviewProps): React.JSX.Element {
  const theme = resolvePreviewTheme(card.theme);
  const avatarImage = useRetryImageUri(card.avatarUrl);

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.inner} onPress={() => undefined}>
          <Text style={styles.hint}>КАК ВИДЯТ ДРУГИЕ</Text>

          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <View style={styles.centered}>
              <View style={[styles.avatar, { backgroundColor: theme.avatarBg }]}>
                {avatarImage.showImage && avatarImage.imageUri ? (
                  <Image
                    key={`${card.avatarUrl}:${avatarImage.retryCount}`}
                    source={{ uri: avatarImage.imageUri }}
                    style={styles.avatarImage}
                    onError={avatarImage.onError}
                  />
                ) : (
                  <Text style={[styles.avatarText, { color: theme.avatarText }]}>{card.name[0] || 'U'}</Text>
                )}
              </View>

              <Text style={[styles.name, { color: theme.name }]}>{card.name}</Text>
              <Text style={[styles.job, { color: theme.job }]}>{card.job}</Text>
              <Text style={[styles.slug, { color: theme.slug }]}>{`unqx.uz/${card.slug}`}</Text>

              <View style={styles.buttons}>
                {card.buttons
                  .filter((b) => b.label)
                  .map((button, index) => {
                    const Icon = findButtonIcon(button.icon).Icon;
                    return (
                      <View key={`btn-${index}`} style={[styles.button, { backgroundColor: theme.buttonBg }]}>
                        <Icon size={14} strokeWidth={1.5} color={theme.buttonText} />
                        <Text style={[styles.buttonText, { color: theme.buttonText }]}>{button.label}</Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          </View>

          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={[styles.closeText, { color: '#ffffff' }]}>Закрыть</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  inner: {
    width: '100%',
    maxWidth: 320,
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
    fontFamily: 'Inter_400Regular',
  },
  card: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  centered: {
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  job: {
    marginTop: 3,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  slug: {
    marginTop: 4,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: 'Inter_500Medium',
  },
  buttons: {
    width: '100%',
    marginTop: 12,
    gap: 8,
  },
  button: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  buttonText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  closeBtn: {
    marginTop: 16,
    alignSelf: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  closeText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
