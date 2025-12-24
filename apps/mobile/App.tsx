import { useEffect, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import SplashScreen from 'react-native-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import CounterProvider from './src/context/CounterContext';
import { chatDB } from './src/db/sqlite';
import RootNavigator from './src/navigators/RootNavigator';
import { getUserData } from './src/api/userData.api';

function App() {
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app...');

        // Initialize database
        console.log('Checking SQLite database...');
        await chatDB.init();
        console.log('Database initialized');

        // Get database statistics
        const stats = await getDatabaseStats();
        console.log('Database Statistics:', stats);

        await chatDB.addColumnIfNotExists("chat_messages", "uuid", "TEXT");

        // Get all chat history (you can limit this in production)
        const allMessages = await getAllMessages();
        console.log('Total messages in database:', allMessages.length);

        if (allMessages.length > 0) {
          console.log('Sample of latest messages:');
          allMessages.slice(-5).forEach((msg, index) => {
            console.log(`  ${index + 1}. [${msg.message_type}] ${msg.text.substring(0, 50)}...`);
          });
        } else {
          console.log('Database is empty');
        }

        // Fetch user data if user is logged in
        const userToken = await AsyncStorage.getItem('userToken');
        if (userToken) {
          try {
            const userData = await getUserData();
            console.log("[App.tsx] userData", userData);
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        } else {
          console.log('No user token found, skipping user data fetch');
        }

      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        SplashScreen.hide();
      }
    };

    initializeApp();
  }, []);

  const getDatabaseStats = async () => {
    try {
      const db = await chatDB['database']; // Access private database property
      if (!db) {
        await chatDB.init();
      }

      const [result] = await chatDB['database']!.executeSql(`
        SELECT 
          COUNT(*) as total_messages,
          SUM(CASE WHEN message_type = 'ai' THEN 1 ELSE 0 END) as ai_messages,
          SUM(CASE WHEN message_type = 'user' THEN 1 ELSE 0 END) as user_messages,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT flow_slug) as unique_flows
        FROM chat_messages
      `);

      return result.rows.item(0);
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        total_messages: 0,
        ai_messages: 0,
        user_messages: 0,
        unique_users: 0,
        unique_flows: 0,
      };
    }
  };

  const getAllMessages = async () => {
    try {
      const db = await chatDB['database'];
      if (!db) {
        await chatDB.init();
      }

      const [result] = await chatDB['database']!.executeSql(`
        SELECT * FROM chat_messages 
        ORDER BY timestamp DESC 
        LIMIT 100
      `);

      const messages = [];
      for (let i = 0; i < result.rows.length; i++) {
        messages.push(result.rows.item(i));
      }

      return messages;
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  };

  const isDarkMode = useColorScheme() === 'dark';

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
