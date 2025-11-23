import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeToken } from './src/utils/decodeJWTToken';
import { chatDB } from './src/db/sqlite';

const FLOW_SLUG = 'weekly-check-in-v1';

const backgroundMessageHandler = async (remoteMessage) => {
    console.log('[backgroundMessageHandler] Silent push received:', remoteMessage);

    const { data } = remoteMessage;
    if (!data || data.type !== 'NEW_QUESTION') {
        console.log('[backgroundMessageHandler] Not a question push, ignoring');
        return;
    }

    try {
        const questionOrFlowEnd = JSON.parse(data.questionData);

        if (questionOrFlowEnd.type === 'end_flow') {
            console.log('[backgroundMessageHandler] Flow ended via push');
            return;
        }

        // get the jwt token from async storage
        const token = await AsyncStorage.getItem('userToken');
        const userId = decodeToken(token);
        console.log("UserId index.js:", userId);
        if (!userId) {
            console.log('[backgroundMessageHandler] No userId found, cannot save');
            return;
        }

        // Initialize database
        await chatDB.init();

        const aiMessage = {
            type: 'ai',
            id: questionOrFlowEnd.id,
            flowInstanceId: questionOrFlowEnd.flowInstanceId,
            text: questionOrFlowEnd.text,
            educationalMessage: questionOrFlowEnd.educationalMessage,
            whyThisMatters: questionOrFlowEnd.whyThisMatters,
            options: questionOrFlowEnd.options,
            timestamp: Date.now(),
        };

        // Load existing history
        const exists = await chatDB.messageExists(userId, FLOW_SLUG, aiMessage.id);

        if (!exists) {
            // Save to SQLite
            await chatDB.saveAiMessage(userId, FLOW_SLUG, aiMessage);
            console.log('[backgroundMessageHandler] Saved new question to SQLite');

            // Get updated count
            const history = await chatDB.getChatHistory(userId, FLOW_SLUG);
            console.log('[backgroundMessageHandler] Total messages in DB:', history.length);
        } else {
            console.log('[backgroundMessageHandler] Question already exists, skipping');
        }

    } catch (e) {
        console.error('[backgroundMessageHandler] Failed to process push:', e);
    }
};

// Register the background handler
messaging().setBackgroundMessageHandler(backgroundMessageHandler);

AppRegistry.registerComponent(appName, () => App);