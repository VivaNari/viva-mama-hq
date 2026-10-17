import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeToken } from './src/utils/decodeJWTToken';
import { chatDB } from './src/db/sqlite';
import { FLOW_SLUGS } from './src/constants/chat';
import { FlowType } from './src/types/chat.types';

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
        if (!userId) {
            console.log('[backgroundMessageHandler] No userId found, cannot save');
            return;
        }

        //  Read onboarding status EXACTLY as stored by AuthContext
        const stored = await AsyncStorage.getItem('onboardingStatus');
        let onboardingStatus = null;

        if (stored) {
            onboardingStatus = JSON.parse(stored);
        }

        const isFullyOnboarded =
            onboardingStatus?.is_questionnaire_completed &&
            onboardingStatus?.is_subscription_completed;

        // Read from FLOW_SLUGS rather than retyped literals.
        //
        // These used to be hardcoded here, and the check-in one was spelled
        // "weekly-check-in-v1" — an extra hyphen. Chat history in SQLite is keyed by
        // (user_id, flow_slug), so every question pre-fetched by a background push was
        // written under a key the chat screen never reads: useChatMessages loads history
        // with FLOW_SLUGS[FlowType.CHECKIN] ("weekly-checkin-v1"). The rows were saved
        // correctly and then silently never shown, which defeats the point of
        // pre-fetching on push. Sharing the constant is what stops the two drifting again.
        const FLOW_SLUG = isFullyOnboarded
            ? FLOW_SLUGS[FlowType.CHECKIN]
            : FLOW_SLUGS[FlowType.ONBOARDING];

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