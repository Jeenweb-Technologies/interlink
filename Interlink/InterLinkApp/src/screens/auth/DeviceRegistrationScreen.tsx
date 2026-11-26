import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Smartphone, ArrowLeft, Send } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { InterlinkLogo } from '../../components/common/InterlinkLogo';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { requestDeviceRegistration } from '../../api/authApi';
import { getDeviceId } from '../../utils/device';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'DeviceRegistration'>;

export const DeviceRegistrationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { username, password } = route.params;
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const handleRequestAuthorization = async () => {
    if (!deviceId) return;

    setLoading(true);
    try {
      const response = await requestDeviceRegistration({
        username,
        password,
        deviceId,
      });

      if (response.success || response.status === 'PENDING_APPROVAL') {
        navigation.navigate('PendingApproval', {
          type: 'device',
          title: 'Device Authorization Submitted',
          message:
            'Your device registration request has been submitted to the administrator. Once approved, you will be able to log in from this device.',
        });
      } else {
        Alert.alert('Request Failed', response.message || 'Unable to submit device registration.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error while requesting device approval.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper scrollable dark showAmbientGlows>
      <View style={styles.container}>
        <InterlinkLogo size="md" light subtitle="DEVICE GOVERNANCE" style={styles.logo} />

        <Card variant="glass" style={styles.card}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Smartphone size={32} color={theme.colors.sky} />
            </View>
            <StatusBadge label="New Device Detected" status="warning" style={styles.badge} />
          </View>

          <Text style={styles.title}>Device Authorization Required</Text>
          <Text style={styles.description}>
            Under the Interlink zero-trust policy, all devices must be verified and authorized by an
            administrator before accessing company workspaces.
          </Text>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account</Text>
              <Text style={styles.infoValue}>{username}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Device Fingerprint</Text>
              <Text style={[styles.infoValue, styles.fingerprint]} numberOfLines={1}>
                {deviceId || 'Resolving...'}
              </Text>
            </View>
          </View>

          <Button
            title="Request Device Authorization"
            onPress={handleRequestAuthorization}
            loading={loading}
            variant="primary"
            size="md"
            rightIcon={<Send size={16} color={theme.colors.textWhite} />}
            style={styles.actionBtn}
          />

          <Button
            title="Back to Sign In"
            onPress={() => navigation.navigate('Login')}
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={16} color={theme.colors.sky} />}
            style={styles.backBtn}
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
    justifyContent: 'center',
    minHeight: '100%',
  },
  logo: {
    marginBottom: theme.spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badge: {
    marginTop: 10,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textWhite,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  description: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textWhiteSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  infoBox: {
    width: '100%',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textWhiteMuted,
    fontWeight: theme.typography.weights.medium,
  },
  infoValue: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textWhite,
    fontWeight: theme.typography.weights.semibold,
  },
  fingerprint: {
    color: theme.colors.sky,
    maxWidth: '55%',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    marginVertical: 10,
  },
  actionBtn: {
    width: '100%',
  },
  backBtn: {
    marginTop: theme.spacing.sm,
  },
});
