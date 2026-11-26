import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Building2, User, Mail, Lock, Phone, ArrowLeft } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { InterlinkLogo } from '../../components/common/InterlinkLogo';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { registerOrganization } from '../../api/authApi';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterOrg'>;

export const RegisterOrgScreen: React.FC<Props> = ({ navigation }) => {
  const [form, setForm] = useState({
    orgName: '',
    companyName: '',
    name: '',
    email: '',
    password: '',
    mob_no: '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.orgName.trim()) errs.orgName = 'Organization name is required';
    if (!form.name.trim()) errs.name = 'Administrator name is required';
    if (!form.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errs.email = 'Invalid email address';
    }
    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

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
          message:
            `Registration for "${form.orgName}" has been submitted successfully! Once the platform developer approves it, you can log in.`,
        });
      } else {
        Alert.alert('Registration Failed', response.message || 'Could not register organization.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error occurred while registering organization.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper scrollable dark showAmbientGlows>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <ArrowLeft size={16} color={theme.colors.sky} />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>

          <InterlinkLogo size="md" light subtitle="ORGANIZATION ONBOARDING" />
          <Text style={styles.title}>Register Organization</Text>
          <Text style={styles.subtitle}>
            Create your company workspace and manage teams securely
          </Text>
        </View>

        <Card variant="glass" style={styles.card}>
          <Input
            label="Organization Name"
            required
            placeholder="e.g. Acme Corporation"
            value={form.orgName}
            onChangeText={(val) => setForm({ ...form, orgName: val })}
            leftIcon={<Building2 size={18} color={theme.colors.textWhiteMuted} />}
            error={errors.orgName}
            dark
          />

          <Input
            label="Main Company Name (Optional)"
            placeholder="e.g. Acme HQ (defaults to Org name)"
            value={form.companyName}
            onChangeText={(val) => setForm({ ...form, companyName: val })}
            leftIcon={<Building2 size={18} color={theme.colors.textWhiteMuted} />}
            dark
          />

          <Input
            label="Administrator Full Name"
            required
            placeholder="e.g. John Doe"
            value={form.name}
            onChangeText={(val) => setForm({ ...form, name: val })}
            leftIcon={<User size={18} color={theme.colors.textWhiteMuted} />}
            error={errors.name}
            dark
          />

          <Input
            label="Official Email"
            required
            placeholder="e.g. admin@acme.com"
            value={form.email}
            onChangeText={(val) => setForm({ ...form, email: val })}
            keyboardType="email-address"
            leftIcon={<Mail size={18} color={theme.colors.textWhiteMuted} />}
            error={errors.email}
            dark
          />

          <Input
            label="Mobile Number (Optional)"
            placeholder="e.g. +91 9876543210"
            value={form.mob_no}
            onChangeText={(val) => setForm({ ...form, mob_no: val })}
            keyboardType="phone-pad"
            leftIcon={<Phone size={18} color={theme.colors.textWhiteMuted} />}
            dark
          />

          <Input
            label="Password"
            required
            placeholder="Choose a strong password"
            value={form.password}
            onChangeText={(val) => setForm({ ...form, password: val })}
            isPassword
            leftIcon={<Lock size={18} color={theme.colors.textWhiteMuted} />}
            error={errors.password}
            dark
          />

          <Button
            title="Register Organization"
            onPress={handleRegister}
            loading={loading}
            variant="primary"
            size="md"
            style={styles.submitBtn}
          />
        </Card>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  backText: {
    color: theme.colors.sky,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textWhite,
    marginTop: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textWhiteSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: theme.spacing.xl,
  },
  submitBtn: {
    marginTop: theme.spacing.md,
  },
});
