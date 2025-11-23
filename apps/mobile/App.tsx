import { Alert, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigators/RootNavigator';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/context/AuthContext';
import CounterProvider from './src/context/CounterContext';
import { chatDB } from './src/db/sqlite';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';


function App() {
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        console.log('Checking SQLite database...');

        // Initialize database
        await chatDB.init();
        console.log('Database initialized');

        // Get database statistics
        const stats = await getDatabaseStats();
        console.log('Database Statistics:', stats);

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

      } catch (error) {
        console.error('Error checking database:', error);
      }
    };

    checkDatabase();
  }, []);

  /**
   * Get database statistics
   */
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

  /**
   * Get all messages from database
   */
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
    <AuthProvider>
      <CounterProvider>
        <RootNavigator />
      </CounterProvider>
    </AuthProvider>
  );
}

export default App;
