import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import {
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  PhoneCall,
  Mail,
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
    <ScreenWrapper scrollable dark showAmbientGlows>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand & Heading */}
        <View style={styles.headerArea}>
          <InterlinkLogo size="lg" light subtitle="WORKSPACE PORTAL" />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your Interlink workspace</Text>
        </View>

        {/* Login Form Card */}
        <Card variant="glass" style={styles.formCard}>
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
            leftIcon={<User size={18} color={theme.colors.textWhiteMuted} />}
            error={fieldErrors.username}
            dark
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
            leftIcon={<Lock size={18} color={theme.colors.textWhiteMuted} />}
            isPassword
            error={fieldErrors.password}
            dark
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

          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL('tel:9824466017')}
            >
              <PhoneCall size={12} color={theme.colors.textMuted} />
              <Text style={styles.contactText}>Helpline: </Text>
              <Text style={styles.contactValue}>9824466017</Text>
            </TouchableOpacity>

            <Text style={styles.contactDivider}>•</Text>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL('mailto:info@jeenweb.com')}
            >
              <Mail size={12} color={theme.colors.textMuted} />
              <Text style={styles.contactText}>Email: </Text>
              <Text style={styles.contactValue}>info@jeenweb.com</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
    alignItems: 'center',
  },
  showcaseCard: {
    width: '100%',
    maxWidth: 440,
    marginBottom: theme.spacing.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.7)',
  },
  trafficLights: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  redLight: {
    backgroundColor: '#EF4444',
  },
  yellowLight: {
    backgroundColor: '#F59E0B',
  },
  greenLight: {
    backgroundColor: '#10B981',
  },
  cardHeaderTitle: {
    fontSize: theme.typography.sizes.xxs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textWhiteSecondary,
    marginLeft: 6,
  },
  showcaseHub: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  logoHalo: {
    padding: 8,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    marginBottom: 4,
  },
  showcaseTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textWhite,
    letterSpacing: 0.3,
  },
  showcaseSubtitle: {
    fontSize: theme.typography.sizes.xxs,
    color: theme.colors.textWhiteMuted,
    marginTop: 2,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.7)',
  },
  statusItem: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.6)',
  },
  statusLabel: {
    fontSize: 9,
    color: theme.colors.textWhiteMuted,
    marginTop: 3,
  },
  statusValue: {
    fontSize: theme.typography.sizes.xxs,
    fontWeight: theme.typography.weights.bold,
    marginTop: 1,
  },
  statusGreen: {
    color: '#34D399',
  },
  statusBlue: {
    color: '#60A5FA',
  },
  statusSky: {
    color: '#38BDF8',
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textWhite,
    letterSpacing: -0.5,
    marginTop: 12,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textWhiteSecondary,
    marginTop: 4,
  },
  formCard: {
    width: '100%',
    maxWidth: 440,
    padding: theme.spacing.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderColor: 'rgba(51, 65, 85, 0.6)',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: theme.typography.sizes.xs,
    color: '#FCA5A5',
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
    borderTopColor: 'rgba(30, 41, 59, 0.6)',
  },
  registerPrompt: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textWhiteSecondary,
  },
  registerLink: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.sky,
  },
  footerContainer: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: theme.typography.sizes.xxs,
    color: theme.colors.textMuted,
  },
  jeenwebBadge: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
  },
  jeenwebText: {
    fontSize: theme.typography.sizes.xxs,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.sky,
    letterSpacing: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  contactValue: {
    fontSize: 10,
    color: theme.colors.textWhiteSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  contactDivider: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
});
