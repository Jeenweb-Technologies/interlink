import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { theme } from '../../constants/theme';

export interface TextInputMethods {
  focus: () => void;
  blur: () => void;
}

export interface InputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string | null;
  hint?: string;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  dark?: boolean;
}

export const Input = forwardRef<TextInputMethods, InputProps>(
  (
    {
      label,
      required = false,
      leftIcon,
      rightIcon,
      error,
      hint,
      isPassword = false,
      containerStyle,
      inputStyle,
      dark = true,
      secureTextEntry,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const internalRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        internalRef.current?.focus();
      },
      blur: () => {
        internalRef.current?.blur();
      },
    }));

    const isSecure = isPassword ? !showPassword : secureTextEntry;

    const handleContainerPress = () => {
      internalRef.current?.focus();
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <View style={styles.labelRow}>
            <Text style={[styles.label, dark && styles.labelDark]}>
              {label}
              {required && <Text style={styles.requiredMark}> *</Text>}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleContainerPress}
          style={[
            styles.inputWrapper,
            dark ? styles.inputWrapperDark : styles.inputWrapperLight,
            isFocused && (dark ? styles.focusedDark : styles.focusedLight),
            !!error && styles.errorBorder,
          ]}
        >
          {leftIcon ? (
            <View style={styles.leftIconWrapper} pointerEvents="none">
              {leftIcon}
            </View>
          ) : null}

          <TextInput
            ref={internalRef}
            style={[
              styles.input,
              dark ? styles.inputTextDark : styles.inputTextLight,
              leftIcon ? styles.paddingLeftWithIcon : styles.paddingLeftNormal,
              isPassword || rightIcon ? styles.paddingRightWithIcon : styles.paddingRightNormal,
              inputStyle,
            ]}
            placeholderTextColor={dark ? theme.colors.textWhiteMuted : theme.colors.textMuted}
            onFocus={(e) => {
              setIsFocused(true);
              if (onFocus) onFocus(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              if (onBlur) onBlur(e);
            }}
            secureTextEntry={isSecure}
            autoCapitalize="none"
            autoCorrect={false}
            {...props}
          />

          {isPassword ? (
            <TouchableOpacity
              style={styles.rightActionWrapper}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showPassword ? (
                <Eye size={18} color={dark ? theme.colors.textWhiteMuted : theme.colors.textSecondary} />
              ) : (
                <EyeOff size={18} color={dark ? theme.colors.textWhiteMuted : theme.colors.textSecondary} />
              )}
            </TouchableOpacity>
          ) : rightIcon ? (
            <View style={styles.rightActionWrapper}>{rightIcon}</View>
          ) : null}
        </Pressable>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : hint ? (
          <Text style={[styles.hintText, dark && styles.hintTextDark]}>{hint}</Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: theme.typography.sizes.xxs,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },
  labelDark: {
    color: theme.colors.textWhiteSecondary,
  },
  requiredMark: {
    color: theme.colors.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    minHeight: 48,
    position: 'relative',
  },
  inputWrapperDark: {
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    borderColor: theme.colors.borderDark,
  },
  inputWrapperLight: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  focusedDark: {
    borderColor: theme.colors.blue,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    ...theme.shadows.blueGlow,
  },
  focusedLight: {
    borderColor: theme.colors.blue,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  errorBorder: {
    borderColor: theme.colors.danger,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    paddingVertical: 12,
  },
  inputTextDark: {
    color: theme.colors.textWhite,
  },
  inputTextLight: {
    color: theme.colors.textPrimary,
  },
  leftIconWrapper: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  paddingLeftWithIcon: {
    paddingLeft: 44,
  },
  paddingLeftNormal: {
    paddingLeft: 14,
  },
  rightActionWrapper: {
    position: 'absolute',
    right: 14,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paddingRightWithIcon: {
    paddingRight: 44,
  },
  paddingRightNormal: {
    paddingRight: 14,
  },
  errorText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.danger,
    marginTop: 4,
    marginLeft: 2,
  },
  hintText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
  hintTextDark: {
    color: theme.colors.textWhiteMuted,
  },
});
