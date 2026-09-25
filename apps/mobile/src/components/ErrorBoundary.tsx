import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import i18n from '../i18n';
import { recordError } from '../analytics';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-phase errors anywhere below it and reports them.
 *
 * Without this, a thrown error during render unmounts the whole React tree: in
 * release the user is left staring at a blank white screen with the process
 * still alive, so Crashlytics never sees a crash and we never find out. The
 * boundary turns that silent failure into a non-fatal report plus a screen the
 * user can actually recover from.
 *
 * Mounted once at the root, wrapping the navigator — see App.tsx.
 *
 * Note this only catches errors thrown while rendering, in lifecycle methods and
 * in constructors. Errors inside event handlers and async callbacks are not
 * caught by React at all; those are covered by the API interceptor and the
 * global handlers installed in index.js.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // The component stack is the useful half of a React error — it names the
    // subtree that blew up, which a minified JS stack trace will not.
    recordError(error, `React render error${errorInfo.componentStack ?? ''}`, {
      error_boundary: 'root',
    });
  }

  /**
   * Clear the error and re-render the subtree.
   *
   * Enough for a transient fault (a bad response, a race on mount). If the cause
   * is deterministic the boundary simply catches again, which is the honest
   * outcome — better than pretending to recover.
   */
  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: colors.pageBG,
        }}
      >
        <Text
          style={[
            {
              fontSize: 18,
              color: colors.primary,
              textAlign: 'center',
              marginBottom: 8,
            },
            globalStyles.fontSemiBold,
          ]}
        >
          {i18n.t('common.somethingWrong')}
        </Text>
        <Text
          style={[
            {
              fontSize: 14,
              color: colors.darkGray,
              textAlign: 'center',
              marginBottom: 24,
            },
            globalStyles.fontRegular,
          ]}
        >
          {i18n.t('common.pleaseTryAgain')}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={this.handleRetry}
          style={{
            paddingHorizontal: 32,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: colors.darkPurple,
          }}
        >
          <Text
            style={[
              { fontSize: 16, color: colors.white },
              globalStyles.fontSemiBold,
            ]}
          >
            {i18n.t('common.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
}

export default ErrorBoundary;
