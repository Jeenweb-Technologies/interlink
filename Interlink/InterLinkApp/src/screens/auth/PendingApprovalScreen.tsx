import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, ArrowLeft } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { InterlinkLogo } from '../../components/common/InterlinkLogo';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PendingApproval'>;

export const PendingApprovalScreen: React.FC<Props> = ({ route, navigation }) => {
  const params = route.params || {};
  const title = params.title || 'Pending Approval';
  const message =
    params.message ||
    'Your request has been registered and is waiting for administrator approval. You will receive access once approved.';

  return (
    <ScreenWrapper scrollable dark showAmbientGlows>
      <View style={styles.container}>
        <InterlinkLogo size="md" light subtitle="WORKSPACE PORTAL" style={styles.logo} />

        <Card variant="glass" style={styles.card}>
          <View style={styles.iconCircle}>
            <Clock size={36} color={theme.colors.warning} />
          </View>

          <StatusBadge label="Awaiting Approval" status="warning" style={styles.badge} />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{message}</Text>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>What happens next?</Text>
            <Text style={styles.tipText}>
              • Platform or Organization administrators review pending registrations.{'\n'}
              • Once verified, your status will switch to Active.{'\n'}
              • You can then return here to sign in with your credentials.
            </Text>
          </View>

          <Button
            title="Return to Sign In"
            onPress={() => navigation.navigate('Login')}
            variant="primary"
            size="md"
            leftIcon={<ArrowLeft size={16} color={theme.colors.textWhite} />}
            style={styles.btn}
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
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badge: {
    marginTop: 12,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textWhite,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  description: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textWhiteSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  tipBox: {
    width: '100%',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  tipTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textWhite,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 11,
    color: theme.colors.textWhiteMuted,
    lineHeight: 18,
  },
  btn: {
    width: '100%',
  },
});
