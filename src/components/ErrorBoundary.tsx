import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { captureSentryException } from '@/lib/sentry';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (__DEV__) {
      console.error('ErrorBoundary caught:', error, info);
    }
    captureSentryException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack,
        },
      },
    });
  }

  reset = (): void => this.setState({ hasError: false, error: null });

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Что-то пошло не так</Text>
        <Text style={styles.subtitle}>Произошла неожиданная ошибка. Попробуй открыть экран заново.</Text>
        <Pressable style={styles.button} onPress={this.reset}>
          <RefreshCw size={16} color='#0B0D12' strokeWidth={1.6} />
          <Text style={styles.buttonText}>Попробовать снова</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#090B0F',
  },
  title: {
    fontSize: 22,
    color: '#F5F6FA',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#98A1B3',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 24,
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2EBDD',
  },
  buttonText: {
    fontSize: 13,
    color: '#0B0D12',
    fontFamily: 'Inter_600SemiBold',
  },
});
