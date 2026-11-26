import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}) => {
  const isInteractive = !loading && !disabled;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!isInteractive}
      activeOpacity={0.8}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        variant === 'primary' && !disabled && styles.primaryGlow,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator
            size="small"
            color={variant === 'outline' || variant === 'ghost' ? theme.colors.blue : theme.colors.textWhite}
          />
          <Text style={[styles.baseText, styles[`text_${variant}`], textStyle, styles.loadingText]}>
            Loading...
          </Text>
        </View>
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconMarginRight}>{leftIcon}</View> : null}
          <Text style={[styles.baseText, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
            {title}
          </Text>
          {rightIcon ? <View style={styles.iconMarginLeft}>{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: theme.colors.blue,
  },
  primaryGlow: {
    ...theme.shadows.blueGlow,
  },
  secondary: {
    backgroundColor: theme.colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: theme.colors.borderDark,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  size_sm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  size_lg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
  },
  baseText: {
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  text_primary: {
    color: theme.colors.textWhite,
  },
  text_secondary: {
    color: theme.colors.textWhite,
  },
  text_outline: {
    color: theme.colors.textWhite,
  },
  text_ghost: {
    color: theme.colors.blue,
  },
  text_danger: {
    color: theme.colors.textWhite,
  },
  textSize_sm: {
    fontSize: theme.typography.sizes.xs,
  },
  textSize_md: {
    fontSize: theme.typography.sizes.sm,
  },
  textSize_lg: {
    fontSize: theme.typography.sizes.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    marginLeft: 6,
  },
  iconMarginRight: {
    marginRight: 8,
  },
  iconMarginLeft: {
    marginLeft: 8,
  },
});
