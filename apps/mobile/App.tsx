import './src/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
import Toast from 'react-native-toast-message';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import CounterProvider from './src/context/CounterContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { BottomSheetProvider } from './src/components/bottomSheet/AppBottomSheet';
import { chatDB } from './src/db/sqlite';
import RootNavigator from './src/navigators/RootNavigator';
import { syncUserData } from './src/utils/syncUserData';
import ErrorBoundary from './src/components/ErrorBoundary';
import { recordError } from './src/analytics';

function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database
        await chatDB.init();

        // Fetch user data if user is logged in
        const userToken = await AsyncStorage.getItem('userToken');

        if (userToken) {
          await syncUserData(userToken);
        } else {
          console.log('No user token found, skipping user data sync');
        }

      } catch (error) {
        console.error('Error initializing app:', error);
        // Startup failures (SQLite init, user sync) leave the app running in a
        // degraded state rather than crashing, so they are invisible without this.
        recordError(error, 'App.initializeApp');
      } finally {
        setAppReady(true);
        SplashScreen.hide();
      }
    };

    initializeApp();
  }, []);


  if (!appReady) return null; // or loader


  return (
    <SafeAreaProvider>
      {/* Pinned dark-content rather than following useColorScheme(): every screen
          renders on a white background regardless of system theme, so light-content
          in dark mode meant white icons on white. Under enforced edge-to-edge
          (targetSdk 36) the bar is transparent, which makes that unreadable rather
          than merely low-contrast. `translucent` matches the OS drawing behind it. */}
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <AppContent />
      <Toast />
    </SafeAreaProvider>
  );
}

function AppContent() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Outermost so provider construction is covered too, and deliberately
          above the providers: its fallback reads i18n directly rather than any
          context, so it still renders when the thing that failed IS a provider. */}
      <ErrorBoundary>
        <BottomSheetModalProvider>
          <AuthProvider>
            {/* Inside AuthProvider — it reads userToken to know when to fetch, and
              refetches on login/logout. */}
            <SubscriptionProvider>
              <LanguageProvider>
                <CounterProvider>
                  <BottomSheetProvider>
                    <RootNavigator />
                  </BottomSheetProvider>
                </CounterProvider>
              </LanguageProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default App;
