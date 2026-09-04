import messaging, { getMessaging, hasPermission, requestPermission } from '@react-native-firebase/messaging';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import i18n from '../i18n';

// Android only started gating notifications behind a runtime permission in 13 (API 33).
const ANDROID_POST_NOTIFICATIONS_API = 33;

const isAuthorized = (status: number) => {
  const { AUTHORIZED, PROVISIONAL, EPHEMERAL } = messaging.AuthorizationStatus;
  return status === AUTHORIZED || status === PROVISIONAL || status === EPHEMERAL;
};

/**
 * Whether the user currently allows notifications. On Android this reflects the
 * system toggle (`areNotificationsEnabled`), not just the runtime grant.
 */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  try {
    return isAuthorized(await hasPermission(getMessaging()));
  } catch (error) {
    console.error('[NOTIFICATIONS] Failed to read permission status:', error);
    return false;
  }
}

/**
 * Shows the OS permission dialog. Returns false when the user declines or when
 * the dialog can no longer be shown (blocked, or Android < 13 with notifications
 * turned off in settings).
 */
async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Firebase's requestPermission is a no-op on Android, so ask the OS directly.
      if (Number(Platform.Version) < ANDROID_POST_NOTIFICATIONS_API) {
        return false;
      }
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    return isAuthorized(await requestPermission(getMessaging()));
  } catch (error) {
    console.error('[NOTIFICATIONS] Permission request failed:', error);
    return false;
  }
}

function promptOpenSettings(): void {
  Alert.alert(
    i18n.t('notificationPermission.title'),
    i18n.t('notificationPermission.message'),
    [
      { text: i18n.t('notificationPermission.notNow'), style: 'cancel' },
      {
        text: i18n.t('notificationPermission.openSettings'),
        onPress: () => Linking.openSettings(),
      },
    ],
  );
}

/**
 * Asks for notification permission whenever it is not already granted. Once the
 * OS stops showing the dialog (blocked / turned off in settings) we point the
 * user at the system settings screen instead.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (await isNotificationPermissionGranted()) {
    return true;
  }

  if (await requestNotificationPermission()) {
    return true;
  }

  promptOpenSettings();
  return false;
}
