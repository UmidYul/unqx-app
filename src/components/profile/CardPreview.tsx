import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileCard, ThemeTokens } from '@/types';
import { findButtonIcon } from '@/components/profile/buttonIcons';

interface CardPreviewProps {
  visible: boolean;
  card: ProfileCard;
  tokens: ThemeTokens;
  onClose: () => void;
}

export function CardPreview({ visible, card, tokens, onClose }: CardPreviewProps): React.JSX.Element {
  const isDark = card.theme === 'dark' || card.theme === 'gradient';

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.inner} onPress={() => undefined}>
          <Text style={styles.hint}>КАК ВИДЯТ ДРУГИЕ</Text>

          <View style={[styles.card, { backgroundColor: isDark ? '#111111' : '#ffffff' }]}> 
            <View style={styles.centered}>
              <View style={[styles.avatar, { backgroundColor: isDark ? '#222222' : '#f0f0f0' }]}>
                {card.avatarUrl ? (
                  <Image source={{ uri: card.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarText, { color: isDark ? '#e8dfc8' : '#111111' }]}>{card.name[0] || 'U'}</Text>
                )}
              </View>

              <Text style={[styles.name, { color: isDark ? '#f5f5f5' : '#0a0a0a' }]}>{card.name}</Text>
              <Text style={[styles.job, { color: isDark ? 'rgba(255,255,255,0.5)' : '#777777' }]}>{card.job}</Text>
              <Text style={[styles.slug, { color: isDark ? '#e8dfc8' : '#000000' }]}>{`unqx.uz/${card.slug}`}</Text>

              <View style={styles.buttons}>
                {card.buttons
                  .filter((b) => b.label)
                  .map((button, index) => {
                    const Icon = findButtonIcon(button.icon).Icon;
                    return (
                      <View key={`btn-${index}`} style={[styles.button, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f5f5f5' }]}>
                        <Icon size={14} strokeWidth={1.5} color={isDark ? '#f5f5f5' : '#111111'} />
                        <Text style={[styles.buttonText, { color: isDark ? '#f5f5f5' : '#111111' }]}>{button.label}</Text>
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
