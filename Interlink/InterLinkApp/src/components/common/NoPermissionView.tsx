import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShieldAlert, ArrowLeft, Home, RefreshCw } from 'lucide-react-native';
import { ScreenWrapper } from './ScreenWrapper';
import { AppHeader } from './AppHeader';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';

interface NoPermissionViewProps {
  moduleName?: string;
  headerTitle?: string;
  onBackPress?: () => void;
  fullScreen?: boolean;
}

export const NoPermissionView: React.FC<NoPermissionViewProps> = ({
  moduleName = 'this',
  headerTitle,
  onBackPress,
  fullScreen = true,
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { fetchPermissions, loading } = usePermissionStore();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'HomeTab' });
    }
  };

  const handleGoHome = () => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  };

  const content = (
    <View style={styles.centerCard}>
      {/* Icon with double soft rings */}
      <View style={styles.iconOuterRing}>
        <View style={styles.iconInnerRing}>
          <ShieldAlert size={38} color="#EF4444" strokeWidth={2.2} />
        </View>
      </View>

      {/* Main Title */}
      <Text style={styles.title}>No Permission to access</Text>

      {/* Descriptive Subtitle */}
      <Text style={styles.description}>
        You do not have permission to view or access the{' '}
        <Text style={styles.moduleNameHighlight}>{moduleName}</Text> module. Please
        contact your system administrator if you require access.
      </Text>

      {/* User Role Badge */}
      <View style={styles.roleBadgeContainer}>
        <Text style={styles.roleBadgeLabel}>Current Role:</Text>
        <View style={styles.roleBadgePill}>
          <Text style={styles.roleBadgeText}>
            {(user?.role || 'Staff').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleGoHome}
          activeOpacity={0.85}
        >
          <Home size={18} color="#FFFFFF" />
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => fetchPermissions()}
          disabled={loading}
          activeOpacity={0.8}
        >
          <RefreshCw size={16} color="#17365D" />
          <Text style={styles.refreshButtonText}>
            {loading ? 'Checking...' : 'Refresh Access'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!fullScreen) {
    return <View style={styles.containerInline}>{content}</View>;
  }

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      <AppHeader
        title={headerTitle || moduleName}
        onBackPress={handleBack}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />
      <View style={styles.container}>{content}</View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  containerInline: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconOuterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
  },
  iconInnerRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  moduleNameHighlight: {
    fontWeight: '700',
    color: '#1E293B',
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 24,
    gap: 6,
  },
  roleBadgeLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  roleBadgePill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17365D',
    borderRadius: 14,
    paddingVertical: 13,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  homeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#17365D',
  },
});
