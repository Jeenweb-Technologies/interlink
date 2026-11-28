import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { InterlinkLogo } from '../../components/common/InterlinkLogo';
import { Card } from '../../components/common/Card';
import { Input, TextInputMethods } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { registerOrganization } from '../../api/authApi';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterOrg'>;

export const RegisterOrgScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<any>(null);

  // Field Refs for next-focus progression
  const companyNameRef = useRef<TextInputMethods>(null);
  const nameRef = useRef<TextInputMethods>(null);
  const emailRef = useRef<TextInputMethods>(null);
  const mobNoRef = useRef<TextInputMethods>(null);
  const passwordRef = useRef<TextInputMethods>(null);
  const confirmPasswordRef = useRef<TextInputMethods>(null);

  const [form, setForm] = useState({
    orgName: '',
    companyName: '',
    name: '',
    email: '',
    mob_no: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track keyboard height to expand scroll padding so inputs are never covered
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const clearFieldError = (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!form.orgName.trim()) {
      errs.orgName = 'Organization name is required';
    }

    if (!form.name.trim()) {
      errs.name = 'Administrator name is required';
    }

    if (!form.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (!form.confirmPassword) {
      errs.confirmPassword = 'Confirm password is required';
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();

    if (!validate()) {
      // Auto-scroll to reveal any error if needed
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
      return;
    }

    setLoading(true);
    try {
      const response = await registerOrganization({
        orgName: form.orgName.trim(),
        companyName: form.companyName.trim() || undefined,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        mob_no: form.mob_no.trim() || undefined,
      });

      if (response.success || response.status === 'PENDING_APPROVAL') {
        navigation.navigate('PendingApproval', {
          type: 'organization',
          title: 'Registration Submitted',
          message: `Registration for "${form.orgName.trim()}" has been submitted successfully! Once the platform developer approves it, you can log in.`,
        });
      } else {
        Alert.alert(
          'Registration Failed',
          response.message || 'Could not register organization. Please check credentials.'
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message || 'Network error occurred while registering organization.'
      );
    } finally {
      setLoading(false);
    }
  };

  const scrollToInput = (yOffset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 150);
  };

  return (
    <ScreenWrapper scrollable={false} disableKeyboardAvoiding dark showAmbientGlows>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.flexOne}
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingTop: Math.max(insets.top, 16) + 10,
              paddingBottom: Math.max(keyboardHeight + 40, insets.bottom + 48),
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.contentWrapper}>
            {/* Top Navigation Row: Back to Sign In */}
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={styles.backIconCircle}>
                <ArrowLeft size={16} color={theme.colors.sky} />
              </View>
              <Text style={styles.backText}>Back to Sign In</Text>
            </TouchableOpacity>

            {/* Header: Logo, Title, Subtitle */}
            <View style={styles.header}>
              <InterlinkLogo size="md" light subtitle="ORGANIZATION ONBOARDING" />
              <Text style={styles.title}>Register Organization</Text>
              <Text style={styles.subtitle}>
                Create your company workspace and manage teams securely
              </Text>
            </View>

            {/* Form Card */}
            <Card variant="glass" style={styles.card}>
              {/* Section 1: Organization & Company Setup */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeNumber}>1</Text>
                </View>
                <Text style={styles.sectionTitle}>ORGANIZATION & WORKSPACE</Text>
              </View>

              <Input
                label="Organization Name"
                required
                placeholder="e.g. Acme Corporation"
                value={form.orgName}
                onChangeText={(val) => {
                  setForm({ ...form, orgName: val });
                  clearFieldError('orgName');
                }}
                leftIcon={<Building2 size={18} color={theme.colors.textWhiteMuted} />}
                error={errors.orgName}
                returnKeyType="next"
                onSubmitEditing={() => companyNameRef.current?.focus()}
                dark
              />

              <Input
                ref={companyNameRef}
                label="Main Company Name (Optional)"
                placeholder="e.g. Acme HQ (defaults to Org name)"
                value={form.companyName}
                onChangeText={(val) => setForm({ ...form, companyName: val })}
                leftIcon={<Building2 size={18} color={theme.colors.textWhiteMuted} />}
                returnKeyType="next"
                onSubmitEditing={() => nameRef.current?.focus()}
                dark
              />

              {/* Section 2: Administrator Profile */}
              <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeNumber}>2</Text>
                </View>
                <Text style={styles.sectionTitle}>PRIMARY ADMINISTRATOR</Text>
              </View>

              <Input
                ref={nameRef}
                label="Administrator Full Name"
                required
                placeholder="e.g. John Doe"
                value={form.name}
                onChangeText={(val) => {
                  setForm({ ...form, name: val });
                  clearFieldError('name');
                }}
                leftIcon={<User size={18} color={theme.colors.textWhiteMuted} />}
                error={errors.name}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                dark
              />

              <Input
                ref={emailRef}
                label="Official Work Email"
                required
                placeholder="e.g. admin@acmecorp.com"
                value={form.email}
                onChangeText={(val) => {
                  setForm({ ...form, email: val });
                  clearFieldError('email');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Mail size={18} color={theme.colors.textWhiteMuted} />}
                error={errors.email}
                returnKeyType="next"
                onSubmitEditing={() => mobNoRef.current?.focus()}
                dark
              />

              <Input
                ref={mobNoRef}
                label="Mobile Number (Optional)"
                placeholder="e.g. +91 9876543210"
                value={form.mob_no}
                onChangeText={(val) => setForm({ ...form, mob_no: val })}
                keyboardType="phone-pad"
                leftIcon={<Phone size={18} color={theme.colors.textWhiteMuted} />}
                returnKeyType="next"
                onSubmitEditing={() => {
                  passwordRef.current?.focus();
                  scrollToInput(420);
                }}
                dark
              />

              {/* Section 3: Credentials */}
              <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeNumber}>3</Text>
                </View>
                <Text style={styles.sectionTitle}>SECURITY & CREDENTIALS</Text>
              </View>

              <Input
                ref={passwordRef}
                label="Password"
                required
                placeholder="Choose a strong password (min. 6 chars)"
                value={form.password}
                onChangeText={(val) => {
                  setForm({ ...form, password: val });
                  clearFieldError('password');
                }}
                isPassword
                leftIcon={<Lock size={18} color={theme.colors.textWhiteMuted} />}
                error={errors.password}
                returnKeyType="next"
                onSubmitEditing={() => {
                  confirmPasswordRef.current?.focus();
                  scrollToInput(520);
                }}
                onFocus={() => scrollToInput(360)}
                dark
              />

              <Input
                ref={confirmPasswordRef}
                label="Confirm Password"
                required
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChangeText={(val) => {
                  setForm({ ...form, confirmPassword: val });
                  clearFieldError('confirmPassword');
                }}
                isPassword
                leftIcon={<Lock size={18} color={theme.colors.textWhiteMuted} />}
                error={errors.confirmPassword}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                onFocus={() => scrollToInput(460)}
                dark
              />

              {/* Submit Button */}
              <Button
                title="Register Organization"
                onPress={handleRegister}
                loading={loading}
                variant="primary"
                size="md"
                style={styles.submitBtn}
              />

              {/* Trust Badge */}
              <View style={styles.trustRow}>
                <ShieldCheck size={14} color="#38BDF8" />
                <Text style={styles.trustText}>
                  Multi-tenant isolated workspace • Subject to approval
                </Text>
              </View>
            </Card>

            {/* Bottom Sign In Link */}
            <View style={styles.bottomSignInRow}>
              <Text style={styles.bottomSignInPrompt}>Already have an account?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.7}
              >
                <Text style={styles.bottomSignInLink}> Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 4,
  },
  backIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  backText: {
    color: theme.colors.sky,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textWhite,
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textWhiteSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderColor: 'rgba(51, 65, 85, 0.65)',
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderSpaced: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.4)',
  },
  sectionBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  sectionBadgeNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.sky,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.sky,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 13,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  trustText: {
    fontSize: 11,
    color: theme.colors.textWhiteMuted,
    fontWeight: '500',
  },
  bottomSignInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  bottomSignInPrompt: {
    fontSize: 13,
    color: theme.colors.textWhiteMuted,
  },
  bottomSignInLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.sky,
  },
});
