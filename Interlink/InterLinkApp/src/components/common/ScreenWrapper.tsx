import React from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  StatusBarStyle,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  dark?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  showAmbientGlows?: boolean;
  edges?: readonly Edge[];
  statusBarStyle?: StatusBarStyle;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  scrollable = false,
  dark = true,
  style,
  contentContainerStyle,
  showAmbientGlows = true,
  edges = ['top', 'right', 'bottom', 'left'],
  statusBarStyle,
}) => {
  const content = (
    <>
      {dark && showAmbientGlows ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Subtle Ambient Glow Circles */}
          <View style={[styles.ambientGlow, styles.topRightGlow]} />
          <View style={[styles.ambientGlow, styles.bottomLeftGlow]} />
          <View style={[styles.ambientGlow, styles.centerGlow]} />
        </View>
      ) : null}

      {scrollable ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.nonScrollContent, contentContainerStyle]}>
          {children}
        </View>
      )}
    </>
  );

  const resolvedStatusBarStyle = statusBarStyle || (dark ? 'light-content' : 'dark-content');

  return (
    <View style={[styles.container, dark ? styles.darkBg : styles.lightBg, style]}>
      <StatusBar barStyle={resolvedStatusBarStyle} />
      <SafeAreaView style={styles.safeArea} edges={edges}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkBg: {
    backgroundColor: theme.colors.bgDarkGradientStart,
  },
  lightBg: {
    backgroundColor: theme.colors.canvas,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  nonScrollContent: {
    flex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    borderRadius: 9999,
  },
  topRightGlow: {
    top: -100,
    right: -100,
    width: 320,
    height: 320,
    backgroundColor: theme.colors.ambientGlow1,
  },
  bottomLeftGlow: {
    bottom: -120,
    left: -120,
    width: 300,
    height: 300,
    backgroundColor: theme.colors.ambientGlow2,
  },
  centerGlow: {
    top: '35%',
    left: '20%',
    width: 250,
    height: 250,
    backgroundColor: 'rgba(30, 99, 168, 0.08)',
  },
});
