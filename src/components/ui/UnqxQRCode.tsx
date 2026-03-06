import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn } from 'react-native-reanimated';

import { formatSlug } from '@/utils/avatar';
import { getProfileURL } from '@/utils/links';

const logo = require('../../../assets/icon.png');

export function UnqxQRCode({
  slug,
  size = 200,
}: {
  slug: string;
  size?: number;
}): React.JSX.Element {
  const value = getProfileURL(slug, 'qr');

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.wrap}>
      <View style={styles.inner}>
        <QRCode
          value={value}
          size={size}
          color='#0a0a0a'
          backgroundColor='#ffffff'
          logo={logo}
          logoSize={size * 0.18}
          logoBackgroundColor='#ffffff'
          logoMargin={4}
          logoBorderRadius={8}
          enableLinearGradient
          linearGradient={['#000000', '#333333']}
          quietZone={8}
        />
      </View>
      <Text style={styles.slug}>{formatSlug(slug)}</Text>
      <Text style={styles.domain}>unqx.uz</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
  },
  inner: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  slug: {
    fontSize: 14,
    letterSpacing: 3,
    fontFamily: 'Inter_600SemiBold',
    color: '#111111',
  },
  domain: {
    fontSize: 11,
    color: '#7f7f7f',
    fontFamily: 'Inter_400Regular',
  },
});
