import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ThemeTokens } from '@/types';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  tokens: ThemeTokens;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  leftIcon?: React.ReactNode;
}

function resolveColors(tokens: ThemeTokens, variant: ButtonVariant): { bg: string; border: string; text: string } {
  if (variant === 'secondary') {
    return { bg: tokens.surface, border: tokens.border, text: tokens.text };
  }
  if (variant === 'ghost') {
    return { bg: 'transparent', border: tokens.border, text: tokens.text };
  }
  if (variant === 'danger') {
    return { bg: tokens.red, border: tokens.red, text: '#ffffff' };
  }
  return { bg: tokens.accent, border: tokens.accent, text: tokens.accentText };
}

function resolveSize(size: ButtonSize): { height: number; radius: number; font: number } {
  if (size === 'sm') return { height: 38, radius: 10, font: 13 };
  if (size === 'lg') return { height: 50, radius: 14, font: 15 };
  return { height: 44, radius: 12, font: 14 };
}

export function Button({
  tokens,
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  success,
  leftIcon,
}: ButtonProps): React.JSX.Element {
  const palette = resolveColors(tokens, variant);
  const metrics = resolveSize(size);
  const isDisabled = Boolean(disabled || loading);

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      containerStyle={{ width: '100%' }}
      style={[
        styles.button,
        {
          minHeight: metrics.height,
          borderRadius: metrics.radius,
          backgroundColor: success ? tokens.green : palette.bg,
          borderColor: success ? tokens.green : palette.border,
          opacity: isDisabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size='small' color={palette.text} />
        ) : success ? (
          <>
            <Check size={16} strokeWidth={2} color='#ffffff' />
            <Text style={[styles.label, { color: '#ffffff', fontSize: metrics.font }]}>{label}</Text>
          </>
        ) : (
          <>
            {leftIcon}
            <Text style={[styles.label, { color: palette.text, fontSize: metrics.font }]}>{label}</Text>
          </>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    minWidth: 124,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
  },
});

