import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemeTokens } from '@/types';

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  tokens: ThemeTokens;
  disabled?: boolean;
}

const OTP_LENGTH = 6;

export function OtpCodeInput({
  value,
  onChange,
  tokens,
  disabled = false,
}: OtpCodeInputProps): React.JSX.Element {
  const inputRef = React.useRef<TextInput | null>(null);
  const normalized = React.useMemo(() => value.replace(/\D/g, '').slice(0, OTP_LENGTH), [value]);

  React.useEffect(() => {
    if (value !== normalized) {
      onChange(normalized);
    }
  }, [normalized, onChange, value]);

  const cells = Array.from({ length: OTP_LENGTH }, (_, index) => normalized[index] ?? '');

  return (
    <Pressable
      disabled={disabled}
      onPress={() => inputRef.current?.focus()}
      style={styles.wrap}
    >
      <View style={styles.row}>
        {cells.map((cell, index) => {
          const active = index === Math.min(normalized.length, OTP_LENGTH - 1);
          const filled = Boolean(cell);
          return (
            <View
              key={`otp-${index}`}
              style={[
                styles.cell,
                {
                  borderColor: filled || active ? tokens.accent : tokens.border,
                  backgroundColor: tokens.inputBg,
                },
              ]}
            >
              <Text style={[styles.cellText, { color: tokens.text }]}>{cell || ' '}</Text>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={normalized}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        keyboardType='number-pad'
        maxLength={OTP_LENGTH}
        editable={!disabled}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cell: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Inter_600SemiBold',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
});
