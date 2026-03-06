import React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';

import { UnqxQRCode } from '@/components/ui/UnqxQRCode';
import { ThemeTokens } from '@/types';

interface QRCodeModalProps {
  visible: boolean;
  slug: string;
  tokens: ThemeTokens;
  onClose: () => void;
}

export function QRCodeModal({ visible, slug, tokens, onClose }: QRCodeModalProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const modalWidth = Math.min(380, Math.max(0, width - 48));
  const contentWidth = Math.max(0, modalWidth - 40);
  const qrInnerPadding = 32;
  const qrSize = Math.max(160, Math.min(320, contentWidth - qrInnerPadding));

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.centerWrap, { borderColor: tokens.border, backgroundColor: tokens.phoneBg }]}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={24} strokeWidth={1.5} color={tokens.textMuted} />
          </Pressable>
          <View style={styles.qrWrap}>
            <UnqxQRCode slug={slug} size={qrSize} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  centerWrap: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrap: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
