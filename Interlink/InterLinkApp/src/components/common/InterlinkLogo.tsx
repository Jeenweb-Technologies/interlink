import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '../../constants/theme';

interface InterlinkLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  light?: boolean;
  subtitle?: string | null;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const SIZES = {
  sm: { width: 28, height: 18, fontSize: 16, strokeWidth: 3.2, circleR: 1.2 },
  md: { width: 36, height: 24, fontSize: 20, strokeWidth: 3.6, circleR: 1.5 },
  lg: { width: 48, height: 32, fontSize: 26, strokeWidth: 4.2, circleR: 2 },
  xl: { width: 64, height: 42, fontSize: 32, strokeWidth: 5.0, circleR: 2.6 },
};

export const InterlinkLogo: React.FC<InterlinkLogoProps> = ({
  size = 'md',
  showText = true,
  light = true,
  subtitle = null,
  style,
  textStyle,
}) => {
  const config = SIZES[size] || SIZES.md;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.svgWrapper, { width: config.width, height: config.height }]}>
        <Svg
          viewBox="0 0 36 24"
          width="100%"
          height="100%"
          fill="none"
        >
          <Defs>
            <LinearGradient id="sbIlG1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#0056cf" />
              <Stop offset="50%" stopColor="#0284c7" />
              <Stop offset="100%" stopColor="#06b6d4" />
            </LinearGradient>
          </Defs>

          <Path
            d="M18 12 C14 6 6 6 6 12 C6 18 14 18 18 12 C22 6 30 6 30 12 C30 18 22 18 18 12 Z"
            stroke="url(#sbIlG1)"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="18" cy="12" r={config.circleR} fill="#38bdf8" />
        </Svg>
      </View>

      {showText && (
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.baseText,
              {
                fontSize: config.fontSize,
                color: light ? theme.colors.textWhite : theme.colors.textPrimary,
              },
              textStyle,
            ]}
          >
            Inter<Text style={styles.brandLink}>link</Text>
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  svgWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    justifyContent: 'center',
  },
  baseText: {
    fontWeight: theme.typography.weights.heavy,
    letterSpacing: -0.5,
  },
  brandLink: {
    color: theme.colors.blue,
  },
  subtitle: {
    fontSize: theme.typography.sizes.xxs,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
