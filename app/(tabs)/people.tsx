import React from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

import { AppShell } from '@/components/AppShell';
import { withProtectedTab } from '@/components/auth/withProtectedTab';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MESSAGES } from '@/constants/messages';
import { useThemeContext } from '@/theme/ThemeProvider';

function PeoplePage(): React.JSX.Element {
  const { tokens } = useThemeContext();

  return (
    <ErrorBoundary>
      <AppShell title={MESSAGES.ui.screens.people} tokens={tokens} hideHeader>
        <View style={styles.container}>
          <WebView
            source={{ uri: 'https://unqx.uz/directory' }}
            style={styles.webview}
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
          />
        </View>
      </AppShell>
    </ErrorBoundary>
  );
}

export default withProtectedTab(PeoplePage);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
