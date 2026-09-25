import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import { useTranslation } from 'react-i18next';

import { colors } from '../../public/assets/colors';

interface LockedOverlayProps {
  children: React.ReactNode;
  /** When false the overlay renders nothing and children show normally. */
  locked: boolean;
  onPress: () => void;
  /** Defaults to the generic "unlock to see more". */
  label?: string;
  style?: ViewStyle;
  /** Retained for API compatibility but no longer used — blur is faked via opacity. */
  blurAmount?: number;
}

/**
 * Overlays its children with a frosted-glass effect and an unlock affordance.
 *
 * PERFORMANCE NOTE: We intentionally do NOT use @react-native-community/blur here.
 * BlurView captures and composites a GPU snapshot for every mounted instance.
 * When multiple locked cards are shown simultaneously in a FlatList this causes
 * severe frame drops and UI thread hangs. A semi-transparent white View is
 * visually equivalent and has zero compositing cost.
 *
 * The blur is presentation only — the server has already stripped the affiliate
 * link from a locked item, so there is nothing underneath to reveal by inspecting
 * the response. This exists so the user can SEE that content exists, which is
 * what makes the paywall persuasive rather than merely restrictive.
 */
const LockedOverlay: React.FC<LockedOverlayProps> = ({
  children,
  locked,
  onPress,
  label,
  style,
}) => {
  const { t } = useTranslation();

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Desaturate the underlying content slightly by dimming it */}
      <View pointerEvents="none" style={styles.dimmedContent}>{children}</View>

      {/* Lightweight frosted-glass substitute — no GPU compositing */}
      <View style={[StyleSheet.absoluteFill, styles.frostedOverlay]} />

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={0.8}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label ?? t('subscription.unlockToSeeMore')}
      >
        <View style={styles.center}>
          <View style={styles.badge}>
            <Lucide name="lock" size={16} color={colors.white} />
            <Text style={styles.badgeText}>
              {label ?? t('subscription.unlockToSeeMore')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  /**
   * Dim the locked content so it reads as "disabled" before the overlay covers it.
   * opacity: 0.35 keeps shapes recognisable (the paywall pitch) without revealing
   * any actionable detail.
   */
  dimmedContent: {
    opacity: 0.35,
  },
  /**
   * Cheap frosted-glass substitute.
   * rgba white at ~55 % opacity gives the same visual "blur" impression as
   * BlurView without any GPU compositing — critical for FlatList performance.
   */
  frostedOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.purple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default LockedOverlay;
