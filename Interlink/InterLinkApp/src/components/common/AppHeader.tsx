import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';

export interface AppHeaderProps {
  /** Screen title (e.g., "Header", "Master", etc.) */
  title?: string;
  /** Callback when back button is pressed */
  onBackPress?: () => void;
  /** Whether to show the back button. Defaults to true */
  showBack?: boolean;
  /** Optional element rendered on the right side of the navigation row (e.g. filter/search) */
  rightElement?: React.ReactNode;
  /** Header background color. Defaults to theme.colors.primary (#17365D) */
  backgroundColor?: string;
  /** Radius of the curved bottom-left corner. Defaults to 65 */
  curveRadius?: number;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom title text style */
  titleStyle?: TextStyle;
}

/**
 * Reusable Mobile App Header
 * Features a deep theme-colored background, left back arrow,
 * title centered in the top bar, and the signature curved bottom-left corner.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  title = 'Header',
  onBackPress,
  showBack = true,
  rightElement,
  backgroundColor = theme.colors.primary,
  curveRadius = 65,
  style,
  titleStyle,
}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;
  const topPadding = Math.max(insets.top, statusBarHeight, Platform.OS === 'ios' ? 44 : 28) + 10;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderBottomLeftRadius: curveRadius,
          paddingTop: topPadding,
        },
        style,
      ]}
    >
      <StatusBar barStyle="light-content" />

      {/* Top Part: Left Back Arrow, Centered Title, Right Placeholder/Action */}
      <View style={styles.topBar}>
        {/* Left Side: Back Arrow */}
        <View style={styles.sideBox}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ArrowLeft size={24} color={theme.colors.textWhite} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Center: Title centered in the top part */}
        <View style={styles.titleBox}>
          <Text style={[styles.title, titleStyle]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Right Side: Action element or placeholder balancing the back arrow */}
        <View style={[styles.sideBox, styles.rightBox]}>
          {rightElement || null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    // Subtle elevation shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sideBox: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  rightBox: {
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textWhite,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});
