import { Suspense } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DATABASE_NAME } from '../src/peaks/database';
import { theme } from '../src/ui/theme';

function Loading() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Chargement des sommets</Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Suspense fallback={<Loading />}>
        {/* La base arrive depuis les assets et est recopiee au premier
            lancement. `forceOverwrite` la remplace a chaque demarrage : le
            fichier est un artefact du pipeline, jamais modifie par l'app, et
            une version plus recente doit s'imposer apres une mise a jour. */}
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          assetSource={{ assetId: require('../assets/peaks.sqlite'), forceOverwrite: true }}
          useSuspense
        >
          <Stack screenOptions={{ headerShown: false, contentStyle: styles.content }} />
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: theme.color.screen },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.screen,
  },
  loadingText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.sans,
    fontSize: theme.size.body,
  },
});
