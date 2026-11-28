import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  User,
  Lock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { InterlinkLogo } from '../../components/common/InterlinkLogo';
import { Input, TextInputMethods } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useAuthStore } from '../../store/authStore';
import { AuthStackParamList } from '../../navigation/types';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const passwordInputRef = useRef<TextInputMethods>(null);

  const { login, isLoading, error, clearError } = useAuthStore();

  const validate = () => {
    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      errors.username = 'Username is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    clearError();
    if (!validate()) return;

    const result = await login(username.trim(), password);

    if (!result.success) {
      if (result.status === 'DEVICE_REGISTRATION_REQUIRED') {
        navigation.navigate('DeviceRegistration', {
          username: username.trim(),
          password,
        });
        return;
      }

      if (result.status === 'PENDING_APPROVAL') {
        navigation.navigate('PendingApproval', {
          type: 'device',
          title: 'Device Approval Pending',
          message: 'Your device registration request has been submitted and is awaiting administrator approval.',
        });
        return;
      }

      if (result.status === 'ORG_PENDING_APPROVAL') {
        navigation.navigate('PendingApproval', {
          type: 'organization',
          title: 'Organization Pending Approval',
          message: result.message || 'Your organization is awaiting developer approval. You will be able to log in once approved.',
        });
        return;
      }

      if (result.status === 'DEVICE_MISMATCH') {
        Alert.alert(
          'Device Not Authorized',
          'This device is not linked to your account. Please request device authorization from your administrator.'
        );
      }
    }
  };

  return (
    <ScreenWrapper
      scrollable
      dark={false}
      showAmbientGlows={false}
      statusBarStyle="dark-content"
      style={styles.screenWrapper}
      contentContainerStyle={styles.scrollContainer}
    >
      {/* Brand & Heading */}
      <View style={styles.headerArea}>
        <InterlinkLogo size="lg" light={false} subtitle="WORKSPACE PORTAL" />
      </View>

      {/* Login Form Card */}
      <Card variant="light" dark={false} style={styles.formCard}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your Interlink workspace</Text>
        {error ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={theme.colors.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Username Field */}
        <Input
          label="Username"
          required
          placeholder="Enter your username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (fieldErrors.username) setFieldErrors({ ...fieldErrors, username: undefined });
          }}
          leftIcon={<User size={18} color={theme.colors.textSecondary} />}
          error={fieldErrors.username}
          dark={false}
          autoFocus={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
        />

        {/* Password Field */}
        <Input
          ref={passwordInputRef}
          label="Password"
          required
          placeholder="Enter your password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
          }}
          leftIcon={<Lock size={18} color={theme.colors.textSecondary} />}
          isPassword
          error={fieldErrors.password}
          dark={false}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        {/* Submit Sign In Button */}
        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={isLoading}
          variant="primary"
          size="md"
          rightIcon={<ArrowRight size={18} color={theme.colors.textWhite} />}
          style={styles.submitBtn}
        />

        {/* Register Organization Option */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerPrompt}>New company or organization? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('RegisterOrg')}
            activeOpacity={0.7}
          >
            <Text style={styles.registerLink}>Register Organization</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Footer Area */}
      <View style={styles.footerContainer}>
        <View style={styles.poweredRow}>
          <Text style={styles.footerText}>Powered by </Text>
          <View style={styles.jeenwebBadge}>
            <Text style={styles.jeenwebText}>JEENWEB</Text>
          </View>
        </View>
        <Text style={styles.versionText}>Version: 01.27.11</Text>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxxl,
    paddingBottom: theme.spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: theme.spacing.xl,
  },
  formCard: {
    width: '100%',
    maxWidth: 440,
    padding: theme.spacing.xl,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: theme.typography.sizes.xs,
    color: '#DC2626',
    lineHeight: 16,
  },
  submitBtn: {
    marginTop: theme.spacing.sm,
    width: '100%',
  },
  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  registerPrompt: {
    fontSize: theme.typography.sizes.xs,
    color: '#64748B',
  },
  registerLink: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.blue,
  },
  footerContainer: {
    marginTop: theme.spacing.xxl,
    alignItems: 'center',
    gap: 8,
  },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: theme.typography.sizes.xxs,
    color: '#94A3B8',
  },
  jeenwebBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  jeenwebText: {
    fontSize: theme.typography.sizes.xxs,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  versionText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
