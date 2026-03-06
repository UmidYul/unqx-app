import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { ToastConfig, ToastConfigParams } from 'react-native-toast-message';

function ToastBase({
  text1,
  text2,
  icon,
  borderColor,
}: {
  text1: string;
  text2?: string;
  icon: React.ReactNode;
  borderColor: string;
}): React.JSX.Element {
  return (
    <View style={[styles.container, { borderLeftColor: borderColor }]}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{text1}</Text>
        {text2 ? <Text style={styles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }: ToastConfigParams<any>) => (
    <ToastBase
      text1={text1 ?? ''}
      text2={text2}
      borderColor='#E8DFC8'
      icon={<CheckCircle2 size={20} color='#E8DFC8' strokeWidth={1.6} />}
    />
  ),
  error: ({ text1, text2 }: ToastConfigParams<any>) => (
    <ToastBase
      text1={text1 ?? ''}
      text2={text2}
      borderColor='#F87171'
      icon={<XCircle size={20} color='#F87171' strokeWidth={1.6} />}
    />
  ),
  info: ({ text1, text2 }: ToastConfigParams<any>) => (
    <ToastBase
      text1={text1 ?? ''}
      text2={text2}
      borderColor='#8E98AC'
      icon={<Info size={20} color='#8E98AC' strokeWidth={1.6} />}
    />
  ),
};

const styles = StyleSheet.create({
  container: {
    width: '92%',
    borderLeftWidth: 4,
    borderRadius: 12,
    backgroundColor: '#141821',
    borderColor: '#232836',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#F2F4F8',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    marginTop: 2,
    color: '#9AA4B6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
