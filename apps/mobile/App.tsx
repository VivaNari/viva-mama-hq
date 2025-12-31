import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
import Toast from 'react-native-toast-message';
import { getUserData } from './src/api/userData.api';
import { AuthProvider } from './src/context/AuthContext';
import CounterProvider from './src/context/CounterContext';
import { chatDB } from './src/db/sqlite';
import RootNavigator from './src/navigators/RootNavigator';
import { decodeToken } from './src/utils/decodeJWTToken';

function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database
        await chatDB.init();

        console.log('Database initialized');

        // Fetch user data if user is logged in
        const userToken = await AsyncStorage.getItem('userToken');

        // Decode token to get userId
        if (userToken) {
          try {
            const decodedUserId = decodeToken(userToken);
            const userData = await getUserData();
            console.log("getUserDataFromSQLite in App.tsx is ", userData);

            if (decodedUserId) {
              const userExists = await chatDB.CheckUserExists(decodedUserId);

              userExists
                ? await chatDB.updateUserData(decodedUserId, userData)
                : await chatDB.saveUserData(decodedUserId, userData);
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        } else {
          console.log('No user token found, skipping user data fetch');
        }

      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setAppReady(true);
        SplashScreen.hide();
      }
    };

    initializeApp();
  }, []);


  const isDarkMode = useColorScheme() === 'dark';
  if (!appReady) return null; // or loader


  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
      <Toast />
    </SafeAreaProvider>
  );
}

function AppContent() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CounterProvider>
          <RootNavigator />
        </CounterProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default App;
