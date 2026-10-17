import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { HeaderHeightContext } from '@react-navigation/elements';
import type { Edge } from 'react-native-safe-area-context';

/**
 * Which safe-area edges a screen has to apply for itself.
 *
 * Under enforced edge-to-edge (targetSdk 36) insets are non-zero, so applying one
 * twice shows up as a band of dead space. Two things already consume an inset on a
 * screen's behalf:
 *
 *  - a navigator header consumes the **top** inset, and
 *  - the bottom tab bar consumes the **bottom** inset — see the `tabBarStyle`
 *    `paddingBottom: insets.bottom` in DashboardTabs.
 *
 * Neither is visible to the screen through `SafeAreaInsetsContext`: React Navigation
 * passes the raw insets straight through (`SafeAreaProviderCompat` explicitly declines
 * to re-wrap when insets already exist), so a screen cannot tell by reading them.
 *
 * Both are therefore resolved from context rather than assumed:
 *
 *  - `BottomTabBarHeightContext` is `undefined` outside a tab navigator.
 *  - `HeaderHeightContext` is `0` when the header is hidden, and otherwise the height
 *    of the nearest visible header — including a parent's, which is exactly right,
 *    since a parent header consumes the top inset just as well as an own one.
 *
 * Pass `hasHeader` only to override the header detection. `Subscription` needs the
 * automatic form: the same file is registered as `SubscriptionDetails` (with a header)
 * and as `Services` (without one), so no literal value is correct in both.
 *
 * Screens registered in exactly one place do not need this at all; a literal `edges`
 * array says the same thing more plainly.
 */
export const useScreenEdges = (hasHeader?: boolean): Edge[] => {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const headerHeight = useContext(HeaderHeightContext);

  const headerShown = hasHeader ?? !!headerHeight;

  const edges: Edge[] = ['left', 'right'];
  if (!headerShown) {
    edges.push('top');
  }
  if (tabBarHeight === undefined) {
    edges.push('bottom');
  }
  return edges;
};
