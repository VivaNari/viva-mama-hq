import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionContext } from '../context/SubscriptionContext';
import apiClientInterceptor from '../api/apiClientInterceptor';
import { REFERRAL_REDEEM } from '../constants/endpoints';
import { syncUserData } from '../utils/syncUserData';

/**
 * The referral step, now BEFORE the plan catalog rather than after it.
 *
 * A code can attach a subscription, so asking for it after the plan choice would have
 * mothers paying for something their doctor's code would have given them. The screen is
 * therefore no longer the end of onboarding — it is a fork:
 *
 *   grant   → refresh entitlements, finish onboarding, skip the catalog entirely
 *   no grant → carry on to the plan catalog ("Services") as before
 *   skip     → carry on to the plan catalog
 *
 * `data.grant != null` is the whole contract with the server.
 */
const ReferralCode: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { completeOnboarding, userToken } = useAuth();
  const { refresh } = useSubscriptionContext();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  /** On to the plan catalog. NOT completeOnboarding() — that used to end here. */
  const goToPlans = () => {
    (navigation as any).navigate('Services');
  };

  const handleSkip = () => {
    goToPlans();
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      return handleSkip();
    }

    try {
      setLoading(true);

      const { data } = await apiClientInterceptor().post(REFERRAL_REDEEM, {
        referralCode: code.trim().toUpperCase(),
      });

      const grant = data?.data?.grant ?? null;

      // Pull the new tier and any capability overrides down before we navigate, so the
      // dashboard's first paint already reflects them — same pair PlanCatalog uses.
      if (userToken) {
        await syncUserData(userToken);
      }
      await refresh();

      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: grant
          ? t('referralCode.grantedMessage')
          : t('referralCode.successMessage'),
        position: 'bottom',
      });

      if (grant) {
        // The server has already marked the subscription step complete; there is
        // nothing left to choose.
        await completeOnboarding();
        return;
      }

      goToPlans();
    } catch (error: any) {
      // A bad code is a 404 now, not a silent 200 — she can correct it or skip.
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: error.response?.data?.message || t('referralCode.errorMessage'),
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={[globalStyles.fontBold, styles.title]}>
          {t('referralCode.title')}
        </Text>
        <Text style={[globalStyles.fontRegular, styles.subtitle]}>
          {t('referralCode.subtitle')}
        </Text>

        <TextInput
          style={[globalStyles.fontRegular, styles.input]}
          placeholder={t('referralCode.placeholder')}
          placeholderTextColor={colors.gray}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[globalStyles.fontBold, styles.primaryButtonText]}>
                {t('referralCode.submit')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={[globalStyles.fontRegular, styles.secondaryButtonText]}>
              {t('referralCode.skip')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBG,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
    marginBottom: 32,
  },
  actions: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: colors.purple,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.darkGray,
    fontSize: 15,
  },
});

export default ReferralCode;
