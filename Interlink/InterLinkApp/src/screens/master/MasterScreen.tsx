import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Users,
  Building2,
  Shield,
  Network,
  MessageSquare,
} from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { Card } from '../../components/common/Card';
import { AppHeader } from '../../components/common/AppHeader';
import { MasterStackParamList } from '../../navigation/types';

type MasterScreenNavigationProp = NativeStackNavigationProp<MasterStackParamList, 'MasterHome'>;

interface MasterScreenProps {
  navigation: MasterScreenNavigationProp;
}

export const MasterScreen: React.FC<MasterScreenProps> = ({ navigation }) => {
  const masterModules = [
    {
      id: 'user_master',
      title: 'User Master',
      description: 'Manage enterprise users, access roles, status toggles, and login identities.',
      icon: Users,
      iconColor: theme.colors.accent,
      iconBg: 'rgba(40, 120, 199, 0.1)',
      route: 'UserMaster' as const,
    },
    {
      id: 'company_master',
      title: 'Company Master',
      description: 'Configure corporate branches, legal entities, email addresses, and contact points.',
      icon: Building2,
      iconColor: '#0284C7',
      iconBg: 'rgba(2, 132, 199, 0.1)',
      route: 'CompanyMaster' as const,
    },
    {
      id: 'usertype_master',
      title: 'UserType Master',
      description: 'Configure role archetypes and granular CRUD permissions (Read, Write, Update, Delete).',
      icon: Shield,
      iconColor: '#7C3AED',
      iconBg: 'rgba(124, 58, 237, 0.1)',
      route: 'UserTypeMaster' as const,
    },
    {
      id: 'department_master',
      title: 'Department Master',
      description: 'Manage corporate divisions, leadership heads, member allocations, and operating status.',
      icon: Network,
      iconColor: '#0D9488',
      iconBg: 'rgba(13, 148, 136, 0.1)',
      route: 'DepartmentMaster' as const,
    },
    {
      id: 'chat_settings_master',
      title: 'Chat Settings Master',
      description: 'Configure corporate chat governance, messaging policies, role permissions, and department scopes.',
      icon: MessageSquare,
      iconColor: '#2563EB',
      iconBg: 'rgba(37, 99, 235, 0.1)',
      route: 'ChatSettingsMaster' as const,
    },
  ];

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // If at root of Master stack, navigate back to Home tab
      navigation.getParent()?.navigate('HomeTab');
    }
  };

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Reusable Curved Header with centered title and left back arrow */}
      <AppHeader
        title="Master"
        onBackPress={handleBack}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 3 Master Cards */}
        <View style={styles.cardsContainer}>
          {masterModules.map((item) => {
            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => navigation.navigate(item.route)}
                style={styles.cardTouchable}
              >
                <Card variant="light" dark={false} style={styles.masterCard}>
                  {/* Top-Right Background Watermark Icon - reduced height & slightly transformed */}
                  <View style={styles.bgIconWrap} pointerEvents="none">
                    <IconComponent
                      size={50}
                      color={item.iconColor}
                      strokeWidth={1.5}
                    />
                  </View>

                  {/* Card Content (Right arrow hidden as requested) */}
                  <View style={styles.cardBody}>
                    <View style={styles.cardTextContent}>
                      <Text style={styles.moduleTitle}>{item.title}</Text>
                      <Text style={styles.moduleDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  cardsContainer: {
    gap: 12,
    marginBottom: theme.spacing.xl,
  },
  cardTouchable: {
    width: '100%',
  },
  masterCard: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    position: 'relative',
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  bgIconWrap: {
    position: 'absolute',
    top: 4,
    right: 4,
    opacity: 0.12,
    transform: [{ rotate: '-12deg' }],
  },
  cardBody: {
    paddingRight: 40,
  },
  cardTextContent: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  moduleDesc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
