import Lucide from '@react-native-vector-icons/lucide';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

type LanguageSelectionMode = 'gate' | 'settings';

interface LanguageSelectionParams {
  /** `gate` blocks until a choice is made; `settings` allows going back. */
  mode?: LanguageSelectionMode;
  /** In `gate` mode, the route to replace to once a language is chosen. */
  next?: string;
}

/**
 * Full-screen language picker. Reused in two flows:
 *  - `gate`    : mandatory first-run choice (before onboarding / dashboard).
 *  - `settings`: change the language later from the profile.
 * Persists the choice locally and to the backend via LanguageContext.
 */
const LanguageSelection = ({ navigation, route }: any) => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { mode = 'gate', next } = (route?.params ?? {}) as LanguageSelectionParams;

  const [selected, setSelected] = useState<string>(language);
  const [saving, setSaving] = useState<boolean>(false);

  const isGate = mode === 'gate';

  const handleConfirm = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await setLanguage(selected);
      if (isGate) {
        navigation.replace(next ?? 'DashboardTabNavigator');
      } else {
        navigation.goBack();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ flex: 1, padding: 20, gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <Text
            style={[
              globalStyles.fontBold,
              { fontSize: 24, color: colors.darkPurple, flex: 1 },
            ]}
          >
            {t('language.selectTitle')}
          </Text>
          {!isGate && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
              <Lucide name="x" size={24} color={colors.black} />
            </TouchableOpacity>
          )}
        </View>

        <Text
          style={[
            globalStyles.fontRegular,
            { fontSize: 14, color: colors.darkGray, marginBottom: 12 },
          ]}
        >
          {t('language.selectSubtitle')}
        </Text>

        {SUPPORTED_LANGUAGES.map(lang => {
          const isActive = lang.code === selected;
          return (
            <TouchableOpacity
              key={lang.code}
              activeOpacity={0.7}
              onPress={() => setSelected(lang.code)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: isActive ? colors.darkPurple : colors.border,
                backgroundColor: isActive ? colors.lightPurple : colors.white,
                marginBottom: 4,
              }}
            >
              <Text
                style={[
                  globalStyles.fontSemiBold,
                  {
                    fontSize: 16,
                    color: isActive ? colors.darkPurple : colors.text,
                  },
                ]}
              >
                {lang.nativeLabel}
              </Text>
              {isActive && (
                <Lucide name="check" size={20} color={colors.darkPurple} />
              )}
            </TouchableOpacity>
          );
        })}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleConfirm}
          disabled={saving}
          style={{
            backgroundColor: colors.darkPurple,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text
              style={[
                globalStyles.fontSemiBold,
                { fontSize: 16, color: colors.white },
              ]}
            >
              {isGate ? t('language.continue') : t('language.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default LanguageSelection;
