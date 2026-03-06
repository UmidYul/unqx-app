import Toast from 'react-native-toast-message';

export const toast = {
  success: (message: string, subtitle?: string): void => {
    Toast.show({
      type: 'success',
      text1: message,
      text2: subtitle,
      position: 'top',
      visibilityTime: 2800,
      topOffset: 56,
    });
  },
  error: (message: string, subtitle?: string): void => {
    Toast.show({
      type: 'error',
      text1: message,
      text2: subtitle ?? 'Попробуй ещё раз',
      position: 'top',
      visibilityTime: 3600,
      topOffset: 56,
    });
  },
  info: (message: string, subtitle?: string): void => {
    Toast.show({
      type: 'info',
      text1: message,
      text2: subtitle,
      position: 'top',
      visibilityTime: 2600,
      topOffset: 56,
    });
  },
};
