import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { User, Mail, Shield, LogOut, Pencil } from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { useAuthStore } from '../../store/authStore';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, logout, isLoading } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of Interlink?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'IL';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const topPadding = Math.max(insets.top, 16) + 14;

  const roleDisplay =
    user?.role === 'admin'
      ? 'Administrator'
      : user?.role
      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
      : 'Member';

  const roleBadgeText =
    user?.role === 'admin'
      ? 'ADMINISTRATOR'
      : user?.role
      ? user.role.toUpperCase()
      : 'MEMBER';

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
      style={styles.screenWrapper}
    >
      <StatusBar barStyle="light-content" />

      {/* ────────────────────────────────────────────────────────
          1. TOP PART: CURVED HEADER UI (ONLY AVATAR AND USER ROLE)
      ──────────────────────────────────────────────────────── */}
      <View style={[styles.curvedHeader, { paddingTop: topPadding }]}>
        {/* Avatar Circle with Initials */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>
            {getInitials(user?.name || user?.username)}
          </Text>
        </View>

        {/* User Role Badge */}
        <View style={styles.roleBadgeContainer}>
          <Text style={styles.roleBadgeText}>{roleBadgeText}</Text>
        </View>
      </View>

      {/* ────────────────────────────────────────────────────────
          2. BODY: WHITE BACKGROUND & PERSONAL INFORMATION
      ──────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.whiteBodyScroll}
        contentContainerStyle={styles.whiteBodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Information Header: Left Title, Right Edit */}
        <View style={styles.personalInfoHeader}>
          <Text style={styles.personalInfoTitle}>Personal Information</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfileScreen')}
            activeOpacity={0.7}
          >
            <Pencil size={13} color="#2878C7" strokeWidth={2.4} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Information Card */}
        <View style={styles.infoCard}>
          {/* Row 1: User Name */}
          <View style={styles.infoItemRow}>
            <View style={[styles.infoIconBox, styles.iconBoxBlue]}>
              <User size={18} color="#2878C7" strokeWidth={2.2} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>User Name</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {user?.name || user?.username || 'Admin User'}
              </Text>
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* Row 2: User Role */}
          <View style={styles.infoItemRow}>
            <View style={[styles.infoIconBox, styles.iconBoxGreen]}>
              <Shield size={18} color="#10B981" strokeWidth={2.2} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>User Role</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {roleDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* Row 3: User Email */}
          <View style={styles.infoItemRow}>
            <View style={[styles.infoIconBox, styles.iconBoxPurple]}>
              <Mail size={18} color="#8B5CF6" strokeWidth={2.2} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>User Email</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {user?.email || 'admin@interlink.com'}
              </Text>
            </View>
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────
            3. SIGN OUT BUTTON
        ──────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <LogOut size={18} color="#EF4444" strokeWidth={2.2} />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    backgroundColor: '#FFFFFF',
  },
  curvedHeader: {
    backgroundColor: '#17365D',
    borderBottomLeftRadius: 65,
    paddingBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2878C7',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  roleBadgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  whiteBodyScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  whiteBodyContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 60,
  },
  personalInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  personalInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2878C7',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  infoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxBlue: {
    backgroundColor: '#EFF6FF',
  },
  iconBoxGreen: {
    backgroundColor: '#ECFDF5',
  },
  iconBoxPurple: {
    backgroundColor: '#FAF5FF',
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 13,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
