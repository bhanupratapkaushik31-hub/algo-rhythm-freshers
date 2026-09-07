import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { AuthService, CoordinatorProfile } from './src/services/auth';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [coordinator, setCoordinator] = useState<CoordinatorProfile | null>(null);

  useEffect(() => {
    checkPersistedLogin();
  }, []);

  const checkPersistedLogin = async () => {
    try {
      const session = await AuthService.getPersistedSession();
      if (session.loggedIn && session.profile) {
        setCoordinator(session.profile);
      }
    } catch (e) {
      console.warn('Auto login check failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#070417" />
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070417" />
      {coordinator ? (
        <ScannerScreen
          coordinator={coordinator}
          onLogout={() => setCoordinator(null)}
        />
      ) : (
        <LoginScreen
          onLoginSuccess={(profile) => setCoordinator(profile)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070417',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070417',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
