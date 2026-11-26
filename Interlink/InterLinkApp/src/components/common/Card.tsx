import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'glass' | 'solid' | 'flat' | 'light';
  dark?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'glass',
  dark = true,
}) => {
  const chosenVariant = !dark ? 'light' : variant;

  return (
    <View style={[styles.base, styles[chosenVariant], style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    overflow: 'hidden',
  },
  glass: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderColor: 'rgba(51, 65, 85, 0.6)',
    borderWidth: 1,
    ...theme.shadows.lg,
  },
  solid: {
    backgroundColor: theme.colors.surfaceDarkSolid,
    borderColor: theme.colors.borderDark,
    borderWidth: 1,
    ...theme.shadows.md,
  },
  flat: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
  },
  light: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    ...theme.shadows.sm,
  },
});
