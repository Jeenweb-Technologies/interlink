import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  User,
  Mail,
  Shield,
  LogOut,
  Pencil,
  Building,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../constants/theme';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, logout, activeCompany } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of Interlink?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ],
      { cancelable: true }
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

  const topPadding = Math.max(insets.top, 28) + 20;

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'left']}
      statusBarStyle="light-content"
      style={styles.screenWrapper}
    >
      <StatusBar barStyle="light-content" />

      {/* Main Container wrapping Header, Body, and Floating Avatar */}
      <View style={styles.mainContainer}>
        {/* 1. TOP PART: THEME-COLORED HEADER BANNER (Increased height & breathing room) */}
        <View
          style={[styles.headerBanner, { paddingTop: topPadding }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          {/* Main Title text (User name or Dashboard profile) */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={2}>
              {user?.name || 'Dashboard\nprofile'}
            </Text>
            <View style={styles.roleHeaderBadge}>
              <Text style={styles.roleHeaderBadgeText}>{roleBadgeText}</Text>
            </View>
          </View>
        </View>

        {/* 2. BODY: WHITE SECTION WITH CURVED TOP-LEFT AND TOP-RIGHT CORNERS */}
        <ScrollView
          style={styles.whiteBodyScroll}
          contentContainerStyle={styles.whiteBodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.contentUpper}>
            {/* Overview Row: Left Status Pill (aligned with floating avatar on the right) */}
            <View style={styles.overviewRow}>
              {/* Left Pill Card (Matches "Deadline / August, 20th" pill from reference) */}
              <View style={styles.statusPillCard}>
                <View style={styles.statusPillIconWrap}>
                  <Shield size={20} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={styles.statusPillTexts}>
                  <Text style={styles.statusPillSub}>Account Role</Text>
                  <Text style={styles.statusPillMain} numberOfLines={1}>
                    {roleDisplay}
                  </Text>
                </View>
              </View>
            </View>

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
                <View style={[styles.infoIconBox, styles.iconBoxNavy]}>
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
                <View style={[styles.infoIconBox, styles.iconBoxBlue]}>
                  <Mail size={18} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>User Email</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {user?.email || 'admin@interlink.com'}
                  </Text>
                </View>
              </View>

              {Boolean(activeCompany?.name) && (
                <>
                  <View style={styles.rowDivider} />
                  {/* Row 4: Company */}
                  <View style={styles.infoItemRow}>
                    <View style={[styles.infoIconBox, styles.iconBoxAmber]}>
                      <Building size={18} color="#D97706" strokeWidth={2.2} />
                    </View>
                    <View style={styles.infoTextCol}>
                      <Text style={styles.infoLabel}>Active Workspace</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {activeCompany?.name}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.contentLower}>
            {/* 3. SIGN OUT BUTTON */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <LogOut size={18} color="#EF4444" strokeWidth={2.2} />
                  <Text style={styles.logoutBtnText}>Sign Out</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Version Text */}
            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>Version: 01.27.11</Text>
            </View>
          </View>
        </ScrollView>

        {/* 3. FLOATING SQUIRCLE AVATAR */}
        {/* Harmoniously aligned with Overview pill baseline & overlapping header */}
        <TouchableOpacity
          style={[
            styles.floatingAvatarAbsolute,
            { top: (headerHeight > 0 ? headerHeight : topPadding + 110) - 42 },
          ]}
          onPress={() => navigation.navigate('EditProfileScreen')}
          activeOpacity={0.85}
        >
          <View style={styles.squircleAvatar}>
            <Text style={styles.squircleAvatarText}>
              {getInitials(user?.name || user?.username)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: theme.colors.primary,
  },
  headerBanner: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 64,
    position: 'relative',
  },
  titleContainer: {
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  roleHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  roleHeaderBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  floatingAvatarAbsolute: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
    elevation: 15,
  },
  squircleAvatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#0B1B36',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.24,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  squircleAvatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.8,
  },
  whiteBodyScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    // marginTop: -28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0B1B36',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  whiteBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  contentUpper: {
    width: '100%',
  },
  contentLower: {
    width: '100%',
    marginTop: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingRight: 84,
    minHeight: 52,
  },
  statusPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusPillIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  statusPillTexts: {
    flex: 1,
  },
  statusPillSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  statusPillMain: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  personalInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // marginBottom: 12,
  },
  personalInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2878C7',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
  },
  infoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxNavy: {
    backgroundColor: '#EFF6FF',
  },
  iconBoxGreen: {
    backgroundColor: '#ECFDF5',
  },
  iconBoxBlue: {
    backgroundColor: '#EFF6FF',
  },
  iconBoxAmber: {
    backgroundColor: '#FFFBEB',
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
