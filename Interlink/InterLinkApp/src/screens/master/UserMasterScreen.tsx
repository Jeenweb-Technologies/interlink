import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import {
  Search,
  Mail,
  Phone,
  Shield,
  Smartphone,
  Power,
  Plus,
  X,
  LaptopMinimal,
  ChevronDown,
  Check,
  Calendar,
  Users,
  History,
  Clock,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  XCircle,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { AppHeader } from '../../components/common/AppHeader';
import {
  fetchAdminUsers,
  toggleUserActive,
  revokeUserDevice,
  createUserByAdmin,
  fetchUserTypes,
  fetchPendingDevices,
  approveDevice,
  fetchDeviceAuditLogs,
  AdminUserItem,
  UserTypeItem,
  PendingDeviceItem,
  DeviceHistoryItem,
} from '../../api/masterApi';
import { MasterStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MasterStackParamList, 'UserMaster'>;
type ActiveTab = 'users' | 'pending' | 'history';

const DEFAULT_USER_TYPES: UserTypeItem[] = [
  { id: 1, type_name: 'Administrator' },
  { id: 2, type_name: 'Project Manager' },
  { id: 3, type_name: 'Team Member' },
  { id: 4, type_name: 'Viewer' },
];

export const UserMasterScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');

  // Users Tab State
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Pending Devices Tab State
  const [pendingDevices, setPendingDevices] = useState<PendingDeviceItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approvingDeviceId, setApprovingDeviceId] = useState<number | null>(null);

  // Device History Tab State
  const [deviceHistory, setDeviceHistory] = useState<DeviceHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyUserFilter, setHistoryUserFilter] = useState<string>('all');
  const [userFilterModalOpen, setUserFilterModalOpen] = useState(false);

  // Shared / Search & Refresh
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // User Types for Dropdown
  const [userTypes, setUserTypes] = useState<UserTypeItem[]>(DEFAULT_USER_TYPES);
  const [userTypeDropdownOpen, setUserTypeDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    userTypeId: '',
    role: 'user',
    mobNo: '',
    dateOfJoin: '',
    deviceVerificationRequired: true,
  });

  // Loaders
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchAdminUsers(showInactive);
      if (res.success && Array.isArray(res.data)) {
        setUsers(res.data);
      } else if (Array.isArray(res.users)) {
        setUsers(res.users);
      }
    } catch {
      // Keep state
    } finally {
      setLoadingUsers(false);
    }
  }, [showInactive]);

  const loadPendingDevices = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await fetchPendingDevices();
      const list = res.devices || (res.data as any)?.devices || res.data || [];
      if (Array.isArray(list)) {
        setPendingDevices(list);
      }
    } catch {
      // Keep state
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const loadDeviceHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetchDeviceAuditLogs();
      const list = res.logs || (res.data as any)?.logs || res.data || [];
      if (Array.isArray(list)) {
        setDeviceHistory(list);
      }
    } catch {
      // Keep state
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadUserTypes = useCallback(async () => {
    try {
      const res = await fetchUserTypes();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setUserTypes(res.data);
      }
    } catch {
      // Keep defaults
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadUsers(), loadPendingDevices(), loadDeviceHistory(), loadUserTypes()]);
    setRefreshing(false);
  }, [loadUsers, loadPendingDevices, loadDeviceHistory, loadUserTypes]);

  useEffect(() => {
    loadUsers();
    loadPendingDevices();
    loadDeviceHistory();
    loadUserTypes();
  }, [loadUsers, loadPendingDevices, loadDeviceHistory, loadUserTypes]);

  // Handlers for Users
  const handleToggleActive = async (user: AdminUserItem) => {
    const newActive = !user.active;
    try {
      const res = await toggleUserActive(user.id, newActive);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, active: newActive ? 1 : 0 } : u))
        );
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, active: newActive ? 1 : 0 } : u))
        );
      }
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: newActive ? 1 : 0 } : u))
      );
    }
  };

  const handleRevokeDevice = async (user: AdminUserItem) => {
    Alert.alert(
      'Revoke Device',
      `Are you sure you want to revoke the registered device for ${user.name || user.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await revokeUserDevice(user.id);
              if (res.success) {
                Alert.alert('Success', 'Device revoked successfully.');
              }
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === user.id ? { ...u, device_status: null, device_id: null } : u
                )
              );
              loadDeviceHistory();
            } catch {
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === user.id ? { ...u, device_status: null, device_id: null } : u
                )
              );
            }
          },
        },
      ]
    );
  };

  // Handlers for Pending Devices
  const handleApproveDevice = async (device: PendingDeviceItem) => {
    Alert.alert(
      'Approve Device',
      `Approve device for ${device.user_name}?\n\nDevice ID: ${device.device_id}\n\nThis will authorize this device and revoke any other active device for this user.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setApprovingDeviceId(device.id);
            try {
              const res = await approveDevice(device.id);
              if (res.success) {
                Alert.alert('Approved', `Device for ${device.user_name} was approved.`);
              } else {
                Alert.alert('Notice', res.message || 'Device approved.');
              }
              // Refresh pending, history and user list
              setPendingDevices((prev) => prev.filter((d) => d.id !== device.id));
              loadPendingDevices();
              loadDeviceHistory();
              loadUsers();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to approve device.');
            } finally {
              setApprovingDeviceId(null);
            }
          },
        },
      ]
    );
  };

  // Handlers for Create User
  const handleCreateUserSubmit = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim()) {
      Alert.alert('Validation Error', 'Full Name, Username, Email, and Password are required.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedType = userTypes.find((t) => String(t.id) === String(form.userTypeId));
      const res = await createUserByAdmin({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        userTypeId: form.userTypeId || undefined,
        mobNo: form.mobNo.trim() || undefined,
        dateOfJoin: form.dateOfJoin.trim() || undefined,
        deviceVerificationRequired: form.deviceVerificationRequired,
        role: form.role,
      });

      if (res.success) {
        Alert.alert('Success', `User ${form.username} created successfully!`);
      } else {
        Alert.alert('Notice', res.message || 'User added.');
      }

      const newUser: AdminUserItem = {
        id: Date.now(),
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        mob_no: form.mobNo.trim() || undefined,
        role: form.role,
        type_name: selectedType ? selectedType.type_name : 'Team Member',
        active: 1,
        device_status: null,
        device_verification_required: form.deviceVerificationRequired ? 1 : 0,
      };

      setUsers((prev) => [newUser, ...prev]);
      setShowCreateModal(false);
      setUserTypeDropdownOpen(false);
      setRoleDropdownOpen(false);
      setForm({
        name: '',
        username: '',
        email: '',
        password: '',
        userTypeId: '',
        role: 'user',
        mobNo: '',
        dateOfJoin: '',
        deviceVerificationRequired: true,
      });
      loadUsers();
    } catch {
      Alert.alert('Notice', 'User created locally.');
      const selectedType = userTypes.find((t) => String(t.id) === String(form.userTypeId));
      const newUser: AdminUserItem = {
        id: Date.now(),
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        mob_no: form.mobNo.trim() || undefined,
        role: form.role,
        type_name: selectedType ? selectedType.type_name : 'Team Member',
        active: 1,
        device_status: null,
        device_verification_required: form.deviceVerificationRequired ? 1 : 0,
      };
      setUsers((prev) => [newUser, ...prev]);
      setShowCreateModal(false);
      setUserTypeDropdownOpen(false);
      setRoleDropdownOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Data
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.type_name?.toLowerCase().includes(q) ||
        u.mob_no?.toLowerCase().includes(q) ||
        u.device_id?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const filteredPendingDevices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pendingDevices;
    return pendingDevices.filter(
      (d) =>
        d.user_name?.toLowerCase().includes(q) ||
        d.user_email?.toLowerCase().includes(q) ||
        d.device_id?.toLowerCase().includes(q) ||
        d.status?.toLowerCase().includes(q)
    );
  }, [pendingDevices, searchQuery]);

  const filteredDeviceHistory = useMemo(() => {
    let list = deviceHistory;
    if (historyUserFilter !== 'all') {
      list = list.filter((item) => String(item.user_id) === String(historyUserFilter));
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (h) =>
        h.user_name?.toLowerCase().includes(q) ||
        h.user_email?.toLowerCase().includes(q) ||
        h.device_id?.toLowerCase().includes(q) ||
        h.status?.toLowerCase().includes(q) ||
        h.approved_by_name?.toLowerCase().includes(q) ||
        h.closed_by_name?.toLowerCase().includes(q)
    );
  }, [deviceHistory, historyUserFilter, searchQuery]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const selectedUserTypeObj = userTypes.find((t) => String(t.id) === String(form.userTypeId));
  const selectedFilterUserName = useMemo(() => {
    if (historyUserFilter === 'all') return 'All Users';
    const match = users.find((u) => String(u.id) === String(historyUserFilter));
    return match ? match.name || match.username : `User #${historyUserFilter}`;
  }, [historyUserFilter, users]);

  return (
    <ScreenWrapper dark={false} edges={['right', 'bottom', 'left']} statusBarStyle="light-content">
      {/* Header */}
      <AppHeader
        title="User Master"
        onBackPress={() => navigation.goBack()}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
        rightElement={
          activeTab === 'users' ? (
            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Plus size={22} color={theme.colors.textWhite} strokeWidth={2.4} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={fetchAllData}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <RefreshCw size={18} color={theme.colors.textWhite} strokeWidth={2.2} />
            </TouchableOpacity>
          )
        }
      />

      <View style={styles.container}>
        {/* Top Segmented Navigation Tabs */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'users' && styles.segmentTabActive]}
            onPress={() => setActiveTab('users')}
            activeOpacity={0.8}
          >
            <Users
              size={15}
              color={activeTab === 'users' ? theme.colors.accent : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'users' && styles.segmentTabTextActive,
              ]}
            >
              Users
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'pending' && styles.segmentTabActive]}
            onPress={() => setActiveTab('pending')}
            activeOpacity={0.8}
          >
            <Clock
              size={15}
              color={activeTab === 'pending' ? theme.colors.accent : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'pending' && styles.segmentTabTextActive,
              ]}
            >
              Pending
            </Text>
            {pendingDevices.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pendingDevices.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'history' && styles.segmentTabActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <History
              size={15}
              color={activeTab === 'history' ? theme.colors.accent : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentTabText,
                activeTab === 'history' && styles.segmentTabTextActive,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar & Secondary Controls */}
        <View style={styles.searchRow}>
          <Input
            placeholder={
              activeTab === 'users'
                ? 'Search users by name, username, email...'
                : activeTab === 'pending'
                ? 'Search pending devices by user, device ID...'
                : 'Search history by user, device, status...'
            }
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={16} color={theme.colors.textMuted} />}
            dark={false}
            containerStyle={styles.searchContainer}
          />
        </View>

        {/* Secondary Sub-Controls Per Tab */}
        {activeTab === 'users' && (
          <View style={styles.subFilterRow}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setShowInactive((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={[styles.toggleSwitch, showInactive && styles.toggleSwitchActive]}>
                <View style={[styles.toggleThumb, showInactive && styles.toggleThumbActive]} />
              </View>
              <Text style={styles.toggleLabel}>Show Deactivated</Text>
            </TouchableOpacity>

            <Text style={styles.countSummary}>{filteredUsers.length} users</Text>
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.subFilterRow}>
            <TouchableOpacity
              style={styles.historyUserFilterBtn}
              onPress={() => setUserFilterModalOpen(true)}
              activeOpacity={0.7}
            >
              <UserCheck size={13} color={theme.colors.accent} />
              <Text style={styles.historyUserFilterText} numberOfLines={1}>
                {selectedFilterUserName}
              </Text>
              <ChevronDown size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {historyUserFilter !== 'all' && (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => setHistoryUserFilter('all')}
                activeOpacity={0.7}
              >
                <Text style={styles.clearFilterText}>Reset</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.countSummary}>{filteredDeviceHistory.length} logs</Text>
          </View>
        )}

        {/* TAB 1: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <>
            {loadingUsers ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Loading user directory...</Text>
              </View>
            ) : filteredUsers.length === 0 ? (
              <View style={styles.centerBox}>
                <Users size={40} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>No users found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? 'Try matching another name, username, or role'
                    : 'Tap the + button in the header to create a user'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={fetchAllData} />
                }
                renderItem={({ item }) => {
                  const isActive = Boolean(item.active);
                  const hasDevice = item.device_status === 'approved';
                  const isPendingDevice = item.device_status === 'pending';

                  return (
                    <Card variant="light" dark={false} style={styles.userCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.userMainInfo}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {getInitials(item.name || item.username)}
                            </Text>
                          </View>
                          <View style={styles.nameBlock}>
                            <View style={styles.nameRoleRow}>
                              <Text style={styles.userName} numberOfLines={1}>
                                {item.name || item.username}
                              </Text>
                              <View style={styles.roleTag}>
                                <Text style={styles.roleTagText}>
                                  {item.role?.toUpperCase() || 'USER'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.userHandle}>@{item.username}</Text>
                          </View>
                        </View>

                        <StatusBadge
                          label={isActive ? 'Active' : 'Deactivated'}
                          status={isActive ? 'success' : 'warning'}
                          dot
                        />
                      </View>

                      <View style={styles.innerSurface}>
                        <View style={styles.chipRow}>
                          <View style={styles.typeChip}>
                            <Shield size={12} color={theme.colors.accent} />
                            <Text style={styles.typeChipText} numberOfLines={1}>
                              {item.type_name || item.user_type_name || 'User Type: —'}
                            </Text>
                          </View>

                          <View style={styles.deviceChip}>
                            <Smartphone
                              size={12}
                              color={hasDevice ? '#059669' : isPendingDevice ? '#D97706' : '#94A3B8'}
                            />
                            <Text
                              style={[
                                styles.deviceChipText,
                                hasDevice
                                  ? styles.deviceTextApproved
                                  : isPendingDevice
                                  ? styles.deviceTextPending
                                  : styles.deviceTextNone,
                              ]}
                            >
                              {hasDevice ? 'Approved' : isPendingDevice ? 'Pending ⏳' : 'No Device —'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.contactDetails}>
                          <View style={styles.contactRow}>
                            <Mail size={13} color={theme.colors.textMuted} />
                            <Text style={styles.contactText} numberOfLines={1}>
                              {item.email || '—'}
                            </Text>
                          </View>

                          {item.mob_no ? (
                            <View style={styles.contactRow}>
                              <Phone size={13} color={theme.colors.textMuted} />
                              <Text style={styles.contactText}>{item.mob_no}</Text>
                            </View>
                          ) : null}

                          {item.device_id ? (
                            <View style={styles.deviceFingerprintRow}>
                              <Text style={styles.deviceFpLabel}>Device ID:</Text>
                              <Text style={styles.deviceFpValue} numberOfLines={1}>
                                {item.device_id}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.cardFooter}>
                        <View style={styles.flexOne} />
                        <View style={styles.cardActionsRow}>
                          {hasDevice ? (
                            <TouchableOpacity
                              style={styles.revokeBtn}
                              onPress={() => handleRevokeDevice(item)}
                              activeOpacity={0.7}
                            >
                              <LaptopMinimal size={13} color="#DC2626" />
                              <Text style={styles.revokeText}>Revoke Device</Text>
                            </TouchableOpacity>
                          ) : null}

                          <TouchableOpacity
                            style={[
                              styles.powerToggleBtn,
                              isActive ? styles.powerBtnActive : styles.powerBtnInactive,
                            ]}
                            onPress={() => handleToggleActive(item)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={isActive ? 'Deactivate user' : 'Activate user'}
                          >
                            <Power
                              size={15}
                              color={isActive ? '#D97706' : '#059669'}
                              strokeWidth={2.2}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Card>
                  );
                }}
              />
            )}
          </>
        )}

        {/* TAB 2: PENDING DEVICE APPROVALS */}
        {activeTab === 'pending' && (
          <>
            {loadingPending ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Loading pending approvals...</Text>
              </View>
            ) : filteredPendingDevices.length === 0 ? (
              <View style={styles.centerBox}>
                <View style={styles.emptySuccessIconWrap}>
                  <CheckCircle2 size={36} color="#059669" />
                </View>
                <Text style={styles.emptyTitle}>No Pending Approvals</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? 'No pending device requests match your search.'
                    : 'All device registration requests are reviewed and approved.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredPendingDevices}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={fetchAllData} />
                }
                renderItem={({ item }) => {
                  const isApproving = approvingDeviceId === item.id;

                  return (
                    <Card variant="light" dark={false} style={styles.approvalCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.userMainInfo}>
                          <View style={styles.pendingAvatar}>
                            <Text style={styles.pendingAvatarText}>
                              {getInitials(item.user_name)}
                            </Text>
                          </View>
                          <View style={styles.nameBlock}>
                            <Text style={styles.userName} numberOfLines={1}>
                              {item.user_name}
                            </Text>
                            <Text style={styles.userEmail} numberOfLines={1}>
                              {item.user_email}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>PENDING APPROVAL</Text>
                        </View>
                      </View>

                      {/* Device ID Box */}
                      <View style={styles.deviceBox}>
                        <View style={styles.deviceRow}>
                          <Smartphone size={14} color={theme.colors.accent} />
                          <Text style={styles.deviceBoxLabel}>Device Identifier:</Text>
                        </View>
                        <Text style={styles.deviceMonoText} selectable>
                          {item.device_id}
                        </Text>
                      </View>

                      {/* Submitted Time */}
                      <View style={styles.timeInfoRow}>
                        <Calendar size={13} color={theme.colors.textMuted} />
                        <Text style={styles.timeInfoText}>
                          Submitted: {formatDateTime(item.submitted_at)}
                        </Text>
                      </View>

                      {/* Action Bar */}
                      <View style={styles.approvalActionsRow}>
                        <TouchableOpacity
                          style={[styles.approveBtn, isApproving && styles.btnDisabled]}
                          onPress={() => handleApproveDevice(item)}
                          activeOpacity={0.7}
                          disabled={isApproving}
                        >
                          {isApproving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Check size={15} color="#FFFFFF" strokeWidth={2.4} />
                              <Text style={styles.approveBtnText}>Approve Device</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </Card>
                  );
                }}
              />
            )}
          </>
        )}

        {/* TAB 3: DEVICE HISTORY */}
        {activeTab === 'history' && (
          <>
            {loadingHistory ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Loading device history logs...</Text>
              </View>
            ) : filteredDeviceHistory.length === 0 ? (
              <View style={styles.centerBox}>
                <History size={40} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>No Device History</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery || historyUserFilter !== 'all'
                    ? 'No logs match your filter criteria.'
                    : 'Device registration and approval logs will appear here.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredDeviceHistory}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={fetchAllData} />
                }
                renderItem={({ item }) => {
                  const status = (item.status || '').toLowerCase();
                  const isApproved = status === 'approved';
                  const isPending = status === 'pending';

                  return (
                    <Card variant="light" dark={false} style={styles.historyCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.userMainInfo}>
                          <View
                            style={[
                              styles.historyAvatar,
                              isApproved
                                ? styles.avatarApproved
                                : isPending
                                ? styles.avatarPending
                                : styles.avatarRevoked,
                            ]}
                          >
                            <Text
                              style={[
                                styles.historyAvatarText,
                                isApproved
                                  ? styles.textApproved
                                  : isPending
                                  ? styles.textPending
                                  : styles.textRevoked,
                              ]}
                            >
                              {getInitials(item.user_name)}
                            </Text>
                          </View>
                          <View style={styles.nameBlock}>
                            <Text style={styles.userName} numberOfLines={1}>
                              {item.user_name}
                            </Text>
                            <Text style={styles.userEmail} numberOfLines={1}>
                              {item.user_email}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusPill,
                            isApproved
                              ? styles.statusPillApproved
                              : isPending
                              ? styles.statusPillPending
                              : styles.statusPillRevoked,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              isApproved
                                ? styles.textApproved
                                : isPending
                                ? styles.textPending
                                : styles.textRevoked,
                            ]}
                          >
                            {status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Device Fingerprint */}
                      <View style={styles.historyDeviceBox}>
                        <Smartphone size={13} color={theme.colors.textMuted} />
                        <Text style={styles.historyDeviceMono} numberOfLines={1} selectable>
                          {item.device_id}
                        </Text>
                      </View>

                      {/* Audit Details */}
                      <View style={styles.historyAuditInfo}>
                        <View style={styles.auditRow}>
                          <Calendar size={12} color={theme.colors.textMuted} />
                          <Text style={styles.auditLabel}>Submitted:</Text>
                          <Text style={styles.auditValue}>
                            {formatDateTime(item.submitted_at)}
                          </Text>
                        </View>

                        {item.approved_by_name || item.approved_at ? (
                          <View style={styles.auditRow}>
                            <CheckCircle2 size={12} color="#059669" />
                            <Text style={styles.auditLabel}>Approved By:</Text>
                            <Text style={styles.auditValue} numberOfLines={1}>
                              {item.approved_by_name || 'Admin'}
                              {item.approved_at ? ` on ${formatDateTime(item.approved_at)}` : ''}
                            </Text>
                          </View>
                        ) : null}

                        {item.closed_by_name || item.closed_at ? (
                          <View style={styles.auditRow}>
                            <XCircle size={12} color="#DC2626" />
                            <Text style={styles.auditLabel}>Closed By:</Text>
                            <Text style={styles.auditValue} numberOfLines={1}>
                              {item.closed_by_name || 'Admin'}
                              {item.closed_at ? ` on ${formatDateTime(item.closed_at)}` : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Card>
                  );
                }}
              />
            )}
          </>
        )}
      </View>

      {/* Filter by User Modal (For History) */}
      <Modal
        visible={userFilterModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setUserFilterModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setUserFilterModalOpen(false)}
        >
          <View style={styles.filterModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter History by User</Text>
              <TouchableOpacity
                onPress={() => setUserFilterModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalScroll}>
              <TouchableOpacity
                style={[
                  styles.filterItemRow,
                  historyUserFilter === 'all' && styles.filterItemRowActive,
                ]}
                onPress={() => {
                  setHistoryUserFilter('all');
                  setUserFilterModalOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.filterItemText,
                    historyUserFilter === 'all' && styles.filterItemTextActive,
                  ]}
                >
                  All Users
                </Text>
                {historyUserFilter === 'all' && <Check size={16} color={theme.colors.accent} />}
              </TouchableOpacity>

              {users.map((u) => {
                const isSelected = String(historyUserFilter) === String(u.id);
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.filterItemRow, isSelected && styles.filterItemRowActive]}
                    onPress={() => {
                      setHistoryUserFilter(String(u.id));
                      setUserFilterModalOpen(false);
                    }}
                  >
                    <View style={styles.flexOne}>
                      <Text
                        style={[styles.filterItemText, isSelected && styles.filterItemTextActive]}
                      >
                        {u.name || u.username}
                      </Text>
                      <Text style={styles.filterItemSub}>{u.email}</Text>
                    </View>
                    {isSelected && <Check size={16} color={theme.colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create User Modal (identical fields matching CreateUser.jsx in frontend) */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCreateModal(false);
          setUserTypeDropdownOpen(false);
          setRoleDropdownOpen(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New User</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setUserTypeDropdownOpen(false);
                  setRoleDropdownOpen(false);
                }}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Input
                label="Full Name *"
                placeholder="Enter Full Name"
                value={form.name}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                dark={false}
                containerStyle={styles.formInput}
              />

              <Input
                label="Username *"
                placeholder="Enter Username"
                value={form.username}
                onChangeText={(text) => setForm((prev) => ({ ...prev, username: text }))}
                autoCapitalize="none"
                dark={false}
                containerStyle={styles.formInput}
              />

              <Input
                label="Email Address *"
                placeholder="Enter Email Address"
                value={form.email}
                onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
                dark={false}
                containerStyle={styles.formInput}
              />

              <Input
                label="Password *"
                placeholder="Enter Password"
                value={form.password}
                onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
                secureTextEntry
                dark={false}
                containerStyle={styles.formInput}
              />

              <View style={styles.formDropdownGroup}>
                <Text style={styles.dropdownLabel}>User Type</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    setUserTypeDropdownOpen(!userTypeDropdownOpen);
                    setRoleDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownTriggerText,
                      !form.userTypeId && styles.dropdownPlaceholder,
                    ]}
                  >
                    {selectedUserTypeObj ? selectedUserTypeObj.type_name : 'Select user type'}
                  </Text>
                  <ChevronDown size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                {userTypeDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setForm((prev) => ({ ...prev, userTypeId: '' }));
                          setUserTypeDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>Select user type</Text>
                      </TouchableOpacity>
                      {userTypes.map((type) => {
                        const isSelected = String(form.userTypeId) === String(type.id);
                        return (
                          <TouchableOpacity
                            key={type.id}
                            style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                            onPress={() => {
                              setForm((prev) => ({ ...prev, userTypeId: String(type.id) }));
                              setUserTypeDropdownOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                isSelected && styles.dropdownItemTextActive,
                              ]}
                            >
                              {type.type_name}
                            </Text>
                            {isSelected && <Check size={16} color={theme.colors.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formDropdownGroup}>
                <Text style={styles.dropdownLabel}>User Group (Role)</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    setRoleDropdownOpen(!roleDropdownOpen);
                    setUserTypeDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownTriggerText}>
                    {form.role === 'admin' ? 'Admin' : 'User'}
                  </Text>
                  <ChevronDown size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                {roleDropdownOpen && (
                  <View style={styles.dropdownMenu}>
                    {[
                      { label: 'User', value: 'user' },
                      { label: 'Admin', value: 'admin' },
                    ].map((r) => {
                      const isSelected = form.role === r.value;
                      return (
                        <TouchableOpacity
                          key={r.value}
                          style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                          onPress={() => {
                            setForm((prev) => ({ ...prev, role: r.value }));
                            setRoleDropdownOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextActive,
                            ]}
                          >
                            {r.label}
                          </Text>
                          {isSelected && <Check size={16} color={theme.colors.accent} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <Input
                label="Mobile Number"
                placeholder="Enter mobile number"
                value={form.mobNo}
                onChangeText={(text) => setForm((prev) => ({ ...prev, mobNo: text }))}
                keyboardType="phone-pad"
                dark={false}
                containerStyle={styles.formInput}
              />

              <Input
                label="Date of Join"
                placeholder="YYYY-MM-DD"
                value={form.dateOfJoin}
                onChangeText={(text) => setForm((prev) => ({ ...prev, dateOfJoin: text }))}
                leftIcon={<Calendar size={16} color={theme.colors.textMuted} />}
                dark={false}
                containerStyle={styles.formInput}
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setForm((prev) => ({
                    ...prev,
                    deviceVerificationRequired: !prev.deviceVerificationRequired,
                  }))
                }
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    form.deviceVerificationRequired && styles.checkboxBoxChecked,
                  ]}
                >
                  {form.deviceVerificationRequired && (
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  Require device verification for this user
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <Button
                  title="Create User Account"
                  variant="primary"
                  loading={submitting}
                  onPress={handleCreateUserSubmit}
                  style={styles.modalSubmitBtn}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 9,
    gap: 6,
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    ...theme.shadows.sm,
  },
  segmentTabText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
  },
  segmentTabTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.bold,
  },
  tabBadge: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.heavy,
    color: '#FFFFFF',
  },
  searchRow: {
    marginBottom: 8,
  },
  searchContainer: {
    marginBottom: 0,
  },
  subFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleSwitch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#F59E0B',
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    ...theme.shadows.sm,
  },
  toggleThumbActive: {
    transform: [{ translateX: 16 }],
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  countSummary: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  historyUserFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 200,
  },
  historyUserFilterText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  clearFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  clearFilterText: {
    fontSize: 11,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.bold,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  loadingText: {
    marginTop: 12,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  emptySuccessIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  listContent: {
    gap: 12,
    paddingBottom: theme.spacing.xxxl,
  },
  userCard: {
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    ...theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 10,
  },
  userMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(40, 120, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(40, 120, 199, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.accent,
  },
  nameBlock: {
    flex: 1,
  },
  nameRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: 'rgba(23, 54, 93, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  userHandle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  powerToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  powerBtnActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  powerBtnInactive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  innerSurface: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deviceChipText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },
  deviceTextApproved: {
    color: '#065F46',
  },
  deviceTextPending: {
    color: '#92400E',
  },
  deviceTextNone: {
    color: theme.colors.textMuted,
  },
  contactDetails: {
    gap: 5,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  deviceFingerprintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    marginTop: 2,
  },
  deviceFpLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.semibold,
  },
  deviceFpValue: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 10,
  },
  flexOne: {
    flex: 1,
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  revokeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
  // Approval Card Styles
  approvalCard: {
    padding: 15,
    backgroundColor: theme.colors.surface,
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 16,
    ...theme.shadows.sm,
  },
  pendingAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pendingAvatarText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.heavy,
    color: '#EA580C',
  },
  pendingBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.heavy,
    color: '#C2410C',
    letterSpacing: 0.3,
  },
  deviceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  deviceBoxLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
  },
  deviceMonoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: theme.colors.textPrimary,
    lineHeight: 16,
  },
  timeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  timeInfoText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  approvalActionsRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    ...theme.shadows.sm,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  // History Card Styles
  historyCard: {
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    ...theme.shadows.sm,
  },
  historyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
  },
  avatarApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  avatarPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  avatarRevoked: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  historyAvatarText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.heavy,
  },
  textApproved: {
    color: '#059669',
  },
  textPending: {
    color: '#D97706',
  },
  textRevoked: {
    color: '#DC2626',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPillPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusPillRevoked: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.heavy,
    letterSpacing: 0.3,
  },
  historyDeviceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
  },
  historyDeviceMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  historyAuditInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 4,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
  },
  auditValue: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  // Filter Modal
  filterModalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  filterModalScroll: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterItemRowActive: {
    backgroundColor: 'rgba(40, 120, 199, 0.06)',
  },
  filterItemText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  filterItemTextActive: {
    color: theme.colors.accent,
  },
  filterItemSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  formInput: {
    marginBottom: 12,
  },
  formDropdownGroup: {
    marginBottom: 14,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.canvas,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  dropdownPlaceholder: {
    color: theme.colors.textMuted,
  },
  dropdownMenu: {
    marginTop: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    ...theme.shadows.md,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 160,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(40, 120, 199, 0.08)',
  },
  dropdownItemText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  dropdownItemTextActive: {
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
    gap: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalSubmitBtn: {
    flex: 1,
  },
});
