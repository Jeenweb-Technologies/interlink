import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Sliders,
  Shield,
  Building,
  Check,
  Search,
  X,
  Globe,
  Lock,
  Layers,
  ChevronRight,
  Users,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import {
  getChatSettings,
  updateChatSettings,
  getChatUserTypePermissions,
  saveChatUserTypePermission,
  getAllUserChatPermissions,
  saveUserChatPermission,
  ChatSettings,
  ChatUserTypePermission,
  UserChatScopeItem,
} from '../../api/chatApi';
import { fetchDepartments, DepartmentItem } from '../../api/masterApi';

type ActiveTab = 'policies' | 'user_types' | 'user_scopes';

export const ChatSettingsMasterScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<ActiveTab>('policies');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPermId, setSavingPermId] = useState<number | null>(null);

  // Tab 1: Global Governance Policies
  const [settings, setSettings] = useState<ChatSettings>({
    allow_direct_messaging: true,
    allow_group_creation: 'ALL',
    allow_broadcast_creation: 'ADMIN_ONLY',
    allow_file_sharing: true,
    max_file_size_mb: 25,
    cross_department_chat: true,
    read_receipts_enabled: true,
    typing_indicators_enabled: true,
  });

  // Tab 2: User Type Permissions
  const [userTypePerms, setUserTypePerms] = useState<ChatUserTypePermission[]>([]);

  // Tab 3: User Scopes
  const [userScopes, setUserScopes] = useState<UserChatScopeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');

  // Edit Modal State
  const [selectedUserScope, setSelectedUserScope] = useState<UserChatScopeItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [modalFormData, setModalFormData] = useState({
    chat_scope: 'DEPARTMENT_ONLY',
    allowed_department_ids: [] as number[],
    can_direct_chat: true,
    can_create_group: true,
    can_create_broadcast: false,
    can_send_files: true,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, permsRes, userScopesRes, deptRes] = await Promise.all([
        getChatSettings().catch(() => null),
        getChatUserTypePermissions().catch(() => null),
        getAllUserChatPermissions().catch(() => null),
        fetchDepartments(false).catch(() => null),
      ]);

      if (settingsRes?.success && (settingsRes as any).settings) {
        const s = (settingsRes as any).settings;
        setSettings({
          ...s,
          allow_direct_messaging: Boolean(s.allow_direct_messaging),
          allow_file_sharing: Boolean(s.allow_file_sharing),
          cross_department_chat: Boolean(s.cross_department_chat),
          read_receipts_enabled: Boolean(s.read_receipts_enabled),
          typing_indicators_enabled: Boolean(s.typing_indicators_enabled),
          max_file_size_mb: Number(s.max_file_size_mb) || 25,
        });
      }

      if (permsRes?.success && Array.isArray((permsRes as any).permissions)) {
        setUserTypePerms((permsRes as any).permissions);
      }

      if (userScopesRes?.success && Array.isArray((userScopesRes as any).users)) {
        setUserScopes((userScopesRes as any).users);
      }

      if (deptRes?.success && Array.isArray(deptRes.data)) {
        setDepartments(deptRes.data);
      }
    } catch (err) {
      console.error('Failed to load chat governance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Save Tab 1: Global Policies
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await updateChatSettings(settings);
      if (res.success) {
        Alert.alert('Success', 'Chat policies updated successfully.');
      } else {
        Alert.alert('Notice', res.message || 'Updated local chat settings.');
      }
    } catch {
      Alert.alert('Error', 'Failed to update chat settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Toggle Tab 2 perms locally
  const handleTogglePerm = (userTypeId: number, field: string) => {
    setUserTypePerms((prev) =>
      prev.map((p) => {
        if (p.user_type_id === userTypeId) {
          return { ...p, [field]: !p[field] };
        }
        return p;
      })
    );
  };

  // Save Tab 2 Single Role
  const handleSaveRolePerm = async (perm: ChatUserTypePermission) => {
    try {
      setSavingPermId(perm.user_type_id);
      const res = await saveChatUserTypePermission(perm.user_type_id, {
        can_direct_chat: Boolean(perm.can_direct_chat),
        can_create_group: Boolean(perm.can_create_group),
        can_create_broadcast: Boolean(perm.can_create_broadcast),
        can_send_files: Boolean(perm.can_send_files),
      });
      if (res.success) {
        Alert.alert('Saved', `Permissions updated for ${perm.type_name}.`);
      } else {
        Alert.alert('Notice', `Updated permissions for ${perm.type_name}.`);
      }
    } catch {
      Alert.alert('Error', 'Failed to save role permission.');
    } finally {
      setSavingPermId(null);
    }
  };

  // Open Edit User Scope Modal
  const handleOpenEditUserScope = (u: UserChatScopeItem) => {
    setSelectedUserScope(u);
    setModalFormData({
      chat_scope: u.chat_scope || 'DEPARTMENT_ONLY',
      allowed_department_ids: Array.isArray(u.allowed_department_ids) ? [...u.allowed_department_ids] : [],
      can_direct_chat: u.can_direct_chat !== false,
      can_create_group: u.can_create_group !== false,
      can_create_broadcast: Boolean(u.can_create_broadcast),
      can_send_files: u.can_send_files !== false,
    });
    setIsEditModalOpen(true);
  };

  // Toggle multi-department ID
  const handleToggleAllowedDept = (deptId: number) => {
    setModalFormData((prev) => {
      const current = prev.allowed_department_ids || [];
      const exists = current.includes(deptId);
      return {
        ...prev,
        allowed_department_ids: exists
          ? current.filter((id) => id !== deptId)
          : [...current, deptId],
      };
    });
  };

  // Save User Scope Modal
  const handleSaveUserScopeSubmit = async () => {
    if (!selectedUserScope) return;
    try {
      setSavingScope(true);
      const payload = {
        chat_scope: modalFormData.chat_scope,
        allowed_department_ids:
          modalFormData.chat_scope === 'MULTI_DEPARTMENT'
            ? modalFormData.allowed_department_ids
            : null,
        can_direct_chat: modalFormData.can_direct_chat,
        can_create_group: modalFormData.can_create_group,
        can_create_broadcast: modalFormData.can_create_broadcast,
        can_send_files: modalFormData.can_send_files,
      };

      const res = await saveUserChatPermission(selectedUserScope.user_id, payload);
      if (res.success) {
        Alert.alert('Success', `Chat scope updated for ${selectedUserScope.name}.`);
        setIsEditModalOpen(false);
        // Refresh list
        const refreshed = await getAllUserChatPermissions();
        if (refreshed.success && Array.isArray((refreshed as any).users)) {
          setUserScopes((refreshed as any).users);
        }
      } else {
        Alert.alert('Notice', res.message || 'Updated user communication scope.');
        setIsEditModalOpen(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to update user scope.');
    } finally {
      setSavingScope(false);
    }
  };

  // Department map for quick lookup
  const departmentMap = useMemo(() => {
    const map: Record<number, string> = {};
    departments.forEach((d) => {
      map[d.id] = d.department_name;
    });
    return map;
  }, [departments]);

  // Filtered users for Tab 3
  const filteredUserScopes = useMemo(() => {
    if (!searchUserQuery.trim()) return userScopes;
    const q = searchUserQuery.toLowerCase().trim();
    return userScopes.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.department_name && u.department_name.toLowerCase().includes(q))
    );
  }, [userScopes, searchUserQuery]);

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      <AppHeader
        title="Chat Settings Master"
        showBack={true}
        onBackPress={() => navigation.goBack()}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      {/* Segmented Top Navigation Tabs */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'policies' && styles.activeTabButton]}
          onPress={() => setActiveTab('policies')}
          activeOpacity={0.7}
        >
          <Sliders
            size={14}
            color={activeTab === 'policies' ? '#2878C7' : '#64748B'}
            strokeWidth={2.2}
          />
          <Text style={[styles.tabButtonText, activeTab === 'policies' && styles.activeTabText]}>
            Global Policies
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'user_types' && styles.activeTabButton]}
          onPress={() => setActiveTab('user_types')}
          activeOpacity={0.7}
        >
          <Shield
            size={14}
            color={activeTab === 'user_types' ? '#2878C7' : '#64748B'}
            strokeWidth={2.2}
          />
          <Text style={[styles.tabButtonText, activeTab === 'user_types' && styles.activeTabText]}>
            Role Perms
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'user_scopes' && styles.activeTabButton]}
          onPress={() => setActiveTab('user_scopes')}
          activeOpacity={0.7}
        >
          <Building
            size={14}
            color={activeTab === 'user_scopes' ? '#2878C7' : '#64748B'}
            strokeWidth={2.2}
          />
          <Text style={[styles.tabButtonText, activeTab === 'user_scopes' && styles.activeTabText]}>
            User Scopes
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#17365D']}
            tintColor="#17365D"
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#17365D" />
            <Text style={styles.loadingText}>Loading chat governance settings...</Text>
          </View>
        ) : (
          <>
            {/* ────────────────────────────────────────────────────────
                TAB 1: GLOBAL GOVERNANCE POLICIES
            ──────────────────────────────────────────────────────── */}
            {activeTab === 'policies' && (
              <View style={styles.tabContentCard}>
                <View style={styles.cardHeaderBox}>
                  <Text style={styles.cardTitle}>Company-Wide Chat Governance</Text>
                  <Text style={styles.cardSubtitle}>
                    Control global communication rules and sharing parameters for all workspace users.
                  </Text>
                </View>

                {/* Switch 1: Direct Messaging */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>1-on-1 Direct Messaging</Text>
                    <Text style={styles.policyDesc}>
                      Allow employees to initiate private direct conversations.
                    </Text>
                  </View>
                  <Switch
                    value={settings.allow_direct_messaging}
                    onValueChange={(val) =>
                      setSettings({ ...settings, allow_direct_messaging: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Switch 2: File Sharing */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>File & Document Attachments</Text>
                    <Text style={styles.policyDesc}>
                      Permit sharing documents, images, and attachments in chat.
                    </Text>
                  </View>
                  <Switch
                    value={settings.allow_file_sharing}
                    onValueChange={(val) =>
                      setSettings({ ...settings, allow_file_sharing: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Selector 1: Group Creation Policy */}
                <View style={styles.policySelectBox}>
                  <Text style={styles.policyTitle}>Group Creation Policy</Text>
                  <Text style={styles.policyDesc}>
                    Who is authorized to create project and team group channels.
                  </Text>
                  <View style={styles.optionPillsRow}>
                    {(['ALL', 'ADMIN_ONLY', 'DISABLED'] as const).map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.optionPill,
                          settings.allow_group_creation === opt && styles.optionPillActive,
                        ]}
                        onPress={() =>
                          setSettings({ ...settings, allow_group_creation: opt })
                        }
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            settings.allow_group_creation === opt && styles.optionPillTextActive,
                          ]}
                        >
                          {opt === 'ALL'
                            ? 'All Employees'
                            : opt === 'ADMIN_ONLY'
                            ? 'Admin Only'
                            : 'Disabled'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Selector 2: Broadcast Creation Policy */}
                <View style={styles.policySelectBox}>
                  <Text style={styles.policyTitle}>Broadcast Channel Creation</Text>
                  <Text style={styles.policyDesc}>
                    Who is authorized to post corporate-wide announcements.
                  </Text>
                  <View style={styles.optionPillsRow}>
                    {(['ADMIN_ONLY', 'ALL', 'DISABLED'] as const).map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.optionPill,
                          settings.allow_broadcast_creation === opt && styles.optionPillActive,
                        ]}
                        onPress={() =>
                          setSettings({ ...settings, allow_broadcast_creation: opt })
                        }
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            settings.allow_broadcast_creation === opt && styles.optionPillTextActive,
                          ]}
                        >
                          {opt === 'ADMIN_ONLY'
                            ? 'Admin Only'
                            : opt === 'ALL'
                            ? 'All Employees'
                            : 'Disabled'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Max File Size */}
                <View style={styles.policySelectBox}>
                  <Text style={styles.policyTitle}>Maximum Attachment Size (MB)</Text>
                  <Text style={styles.policyDesc}>
                    Limit individual file upload size per message.
                  </Text>
                  <View style={styles.optionPillsRow}>
                    {[10, 25, 50, 100].map((mb) => (
                      <TouchableOpacity
                        key={mb}
                        style={[
                          styles.optionPill,
                          settings.max_file_size_mb === mb && styles.optionPillActive,
                        ]}
                        onPress={() =>
                          setSettings({ ...settings, max_file_size_mb: mb })
                        }
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            settings.max_file_size_mb === mb && styles.optionPillTextActive,
                          ]}
                        >
                          {mb} MB
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Switch 3: Read Receipts */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>Read Receipts & Double Checks</Text>
                    <Text style={styles.policyDesc}>
                      Show read status checkmarks for sent messages.
                    </Text>
                  </View>
                  <Switch
                    value={settings.read_receipts_enabled}
                    onValueChange={(val) =>
                      setSettings({ ...settings, read_receipts_enabled: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Switch 4: Typing Indicators */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>Typing Indicators</Text>
                    <Text style={styles.policyDesc}>
                      Show real-time typing indicators in active chat windows.
                    </Text>
                  </View>
                  <Switch
                    value={settings.typing_indicators_enabled}
                    onValueChange={(val) =>
                      setSettings({ ...settings, typing_indicators_enabled: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Save Global Policies Button */}
                <TouchableOpacity
                  style={styles.saveSubmitBtn}
                  onPress={handleSaveSettings}
                  disabled={savingSettings}
                  activeOpacity={0.8}
                >
                  {savingSettings ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={16} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.saveSubmitBtnText}>Save Policies</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ────────────────────────────────────────────────────────
                TAB 2: ROLE PERMISSIONS
            ──────────────────────────────────────────────────────── */}
            {activeTab === 'user_types' && (
              <View style={styles.tabContentCard}>
                <View style={styles.cardHeaderBox}>
                  <Text style={styles.cardTitle}>User Role Permissions</Text>
                  <Text style={styles.cardSubtitle}>
                    Define default chat privileges and messaging scopes for each user role.
                  </Text>
                </View>

                <View style={styles.rolesList}>
                  {userTypePerms.map((perm) => (
                    <View key={perm.user_type_id} style={styles.rolePermCard}>
                      <View style={styles.roleHeaderRow}>
                        <View style={styles.roleHeaderLeft}>
                          <View style={styles.roleIconWrap}>
                            <Shield size={16} color="#2878C7" />
                          </View>
                          <View>
                            <Text style={styles.roleNameText}>{perm.type_name}</Text>
                            <Text style={styles.roleSubtext}>Role ID #{perm.user_type_id}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.roleSaveBtn}
                          onPress={() => handleSaveRolePerm(perm)}
                          disabled={savingPermId === perm.user_type_id}
                          activeOpacity={0.8}
                        >
                          {savingPermId === perm.user_type_id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Check size={13} color="#FFFFFF" strokeWidth={2.4} />
                              <Text style={styles.roleSaveBtnText}>Save</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      <View style={styles.permSwitchesGrid}>
                        {/* 1-on-1 Direct Chat */}
                        <View style={styles.permSwitchItem}>
                          <Text style={styles.permSwitchLabel}>Direct Chat</Text>
                          <Switch
                            value={Boolean(perm.can_direct_chat)}
                            onValueChange={() =>
                              handleTogglePerm(perm.user_type_id, 'can_direct_chat')
                            }
                            trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                          />
                        </View>

                        {/* Create Groups */}
                        <View style={styles.permSwitchItem}>
                          <Text style={styles.permSwitchLabel}>Create Groups</Text>
                          <Switch
                            value={Boolean(perm.can_create_group)}
                            onValueChange={() =>
                              handleTogglePerm(perm.user_type_id, 'can_create_group')
                            }
                            trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                          />
                        </View>

                        {/* Create Broadcasts */}
                        <View style={styles.permSwitchItem}>
                          <Text style={styles.permSwitchLabel}>Broadcasts</Text>
                          <Switch
                            value={Boolean(perm.can_create_broadcast)}
                            onValueChange={() =>
                              handleTogglePerm(perm.user_type_id, 'can_create_broadcast')
                            }
                            trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                          />
                        </View>

                        {/* Attach Files */}
                        <View style={styles.permSwitchItem}>
                          <Text style={styles.permSwitchLabel}>Attach Files</Text>
                          <Switch
                            value={Boolean(perm.can_send_files)}
                            onValueChange={() =>
                              handleTogglePerm(perm.user_type_id, 'can_send_files')
                            }
                            trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ────────────────────────────────────────────────────────
                TAB 3: USER DEPARTMENT COMMUNICATION SCOPE
            ──────────────────────────────────────────────────────── */}
            {activeTab === 'user_scopes' && (
              <View style={styles.tabContentCard}>
                <View style={styles.cardHeaderBox}>
                  <Text style={styles.cardTitle}>Employee Communication Scopes</Text>
                  <Text style={styles.cardSubtitle}>
                    Configure individual cross-department chat permissions and outreach boundaries.
                  </Text>
                </View>

                {/* Search Input */}
                <View style={styles.searchBarBox}>
                  <Search size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search employee by name or dept..."
                    placeholderTextColor="#94A3B8"
                    value={searchUserQuery}
                    onChangeText={setSearchUserQuery}
                  />
                  {searchUserQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchUserQuery('')}>
                      <X size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* User Scopes List */}
                <View style={styles.scopesList}>
                  {filteredUserScopes.length > 0 ? (
                    filteredUserScopes.map((u) => {
                      const scope = u.chat_scope || 'DEPARTMENT_ONLY';
                      const isCompany = scope === 'COMPANY_WIDE';
                      const isMulti = scope === 'MULTI_DEPARTMENT';

                      return (
                        <View key={u.user_id} style={styles.userScopeCard}>
                          <View style={styles.userScopeTopRow}>
                            <View style={styles.userAvatarBox}>
                              <Text style={styles.userAvatarInitial}>
                                {u.name ? u.name[0].toUpperCase() : 'U'}
                              </Text>
                            </View>
                            <View style={styles.userScopeInfo}>
                              <Text style={styles.userScopeName}>{u.name}</Text>
                              <Text style={styles.userScopeDept}>
                                {u.department_name || 'No Department'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.configureBtn}
                              onPress={() => handleOpenEditUserScope(u)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.configureBtnText}>Configure</Text>
                              <ChevronRight size={13} color="#2878C7" />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.scopeBadgeRow}>
                            <View
                              style={[
                                styles.scopePill,
                                isCompany
                                  ? styles.scopePillGreen
                                  : isMulti
                                  ? styles.scopePillBlue
                                  : styles.scopePillSlate,
                              ]}
                            >
                              {isCompany ? (
                                <Globe size={11} color="#047857" />
                              ) : isMulti ? (
                                <Layers size={11} color="#2563EB" />
                              ) : (
                                <Lock size={11} color="#475569" />
                              )}
                              <Text
                                style={[
                                  styles.scopePillText,
                                  isCompany
                                    ? styles.scopeTextGreen
                                    : isMulti
                                    ? styles.scopeTextBlue
                                    : styles.scopeTextSlate,
                                ]}
                              >
                                {isCompany
                                  ? 'Company-Wide'
                                  : isMulti
                                  ? `Multi-Department (${(u.allowed_department_ids?.length || 0) + 1})`
                                  : 'Department Only'}
                              </Text>
                            </View>

                            {isMulti && Boolean(u.allowed_department_ids?.length) && (
                              <Text style={styles.allowedDeptsText} numberOfLines={1}>
                                + {u.allowed_department_ids?.map((id) => departmentMap[id] || `Dept #${id}`).join(', ')}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.emptyBox}>
                      <Users size={28} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No employees found</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ────────────────────────────────────────────────────────
          EDIT USER CHAT SCOPE MODAL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Configure Scope</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  {selectedUserScope?.name} • {selectedUserScope?.department_name || 'No Dept'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Scope Selection */}
              <Text style={styles.modalSectionLabel}>Communication Boundary</Text>
              <View style={styles.scopeOptionsBox}>
                <TouchableOpacity
                  style={[
                    styles.scopeRadioOption,
                    modalFormData.chat_scope === 'DEPARTMENT_ONLY' && styles.scopeRadioOptionActive,
                  ]}
                  onPress={() =>
                    setModalFormData({ ...modalFormData, chat_scope: 'DEPARTMENT_ONLY' })
                  }
                >
                  <Lock size={16} color="#64748B" />
                  <View style={styles.scopeRadioTextCol}>
                    <Text style={styles.scopeRadioTitle}>Department Only</Text>
                    <Text style={styles.scopeRadioDesc}>
                      Restricted to colleagues in own department
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeRadioOption,
                    modalFormData.chat_scope === 'COMPANY_WIDE' && styles.scopeRadioOptionActive,
                  ]}
                  onPress={() =>
                    setModalFormData({ ...modalFormData, chat_scope: 'COMPANY_WIDE' })
                  }
                >
                  <Globe size={16} color="#047857" />
                  <View style={styles.scopeRadioTextCol}>
                    <Text style={styles.scopeRadioTitle}>Company-Wide</Text>
                    <Text style={styles.scopeRadioDesc}>
                      Can communicate with all company departments
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeRadioOption,
                    modalFormData.chat_scope === 'MULTI_DEPARTMENT' && styles.scopeRadioOptionActive,
                  ]}
                  onPress={() =>
                    setModalFormData({ ...modalFormData, chat_scope: 'MULTI_DEPARTMENT' })
                  }
                >
                  <Layers size={16} color="#2563EB" />
                  <View style={styles.scopeRadioTextCol}>
                    <Text style={styles.scopeRadioTitle}>Multi-Department (Custom)</Text>
                    <Text style={styles.scopeRadioDesc}>
                      Choose specific accessible departments
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Multi-Department Picker Checklist */}
              {modalFormData.chat_scope === 'MULTI_DEPARTMENT' && (
                <View style={styles.deptChecklistBox}>
                  <Text style={styles.modalSectionLabel}>Accessible Departments</Text>
                  <View style={styles.deptPillsWrap}>
                    {departments.map((d) => {
                      const isSelected = modalFormData.allowed_department_ids.includes(d.id);
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[
                            styles.deptCheckPill,
                            isSelected && styles.deptCheckPillActive,
                          ]}
                          onPress={() => handleToggleAllowedDept(d.id)}
                        >
                          {isSelected && <Check size={12} color="#FFFFFF" />}
                          <Text
                            style={[
                              styles.deptCheckPillText,
                              isSelected && styles.deptCheckPillTextActive,
                            ]}
                          >
                            {d.department_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Feature Toggles */}
              <Text style={styles.modalSectionLabelSpaced}>
                Allowed Capabilities
              </Text>
              <View style={styles.modalTogglesBox}>
                <View style={styles.modalToggleRow}>
                  <Text style={styles.modalToggleLabel}>Can 1-on-1 Direct Chat</Text>
                  <Switch
                    value={modalFormData.can_direct_chat}
                    onValueChange={(val) =>
                      setModalFormData({ ...modalFormData, can_direct_chat: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                  />
                </View>
                <View style={styles.modalToggleRow}>
                  <Text style={styles.modalToggleLabel}>Can Create Group Channels</Text>
                  <Switch
                    value={modalFormData.can_create_group}
                    onValueChange={(val) =>
                      setModalFormData({ ...modalFormData, can_create_group: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                  />
                </View>
                <View style={styles.modalToggleRow}>
                  <Text style={styles.modalToggleLabel}>Can Create Broadcasts</Text>
                  <Switch
                    value={modalFormData.can_create_broadcast}
                    onValueChange={(val) =>
                      setModalFormData({ ...modalFormData, can_create_broadcast: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                  />
                </View>
                <View style={styles.modalToggleRow}>
                  <Text style={styles.modalToggleLabel}>Can Attach Files</Text>
                  <Switch
                    value={modalFormData.can_send_files}
                    onValueChange={(val) =>
                      setModalFormData({ ...modalFormData, can_send_files: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveUserScopeSubmit}
                disabled={savingScope}
              >
                {savingScope ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={14} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.modalSaveBtnText}>Save Scope</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#2878C7',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#2878C7',
    fontWeight: '700',
  },
  screenScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  tabContentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardHeaderBox: {
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  policyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 12,
  },
  policyTextCol: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  policyDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  policySelectBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
  },
  optionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  optionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  optionPillActive: {
    backgroundColor: '#2878C7',
    borderColor: '#2878C7',
  },
  optionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  optionPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  saveSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
  },
  saveSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rolesList: {
    gap: 12,
  },
  rolePermCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleSubtext: {
    fontSize: 10,
    color: '#94A3B8',
  },
  roleSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#17365D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  roleSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  permSwitchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  permSwitchItem: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permSwitchLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 0,
  },
  scopesList: {
    gap: 10,
  },
  userScopeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  userScopeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarInitial: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userScopeInfo: {
    flex: 1,
  },
  userScopeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  userScopeDept: {
    fontSize: 11,
    color: '#64748B',
  },
  configureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  configureBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2878C7',
  },
  scopeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  scopePillGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  scopePillBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  scopePillSlate: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  scopePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scopeTextGreen: {
    color: '#047857',
  },
  scopeTextBlue: {
    color: '#2563EB',
  },
  scopeTextSlate: {
    color: '#475569',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalScroll: {
    marginVertical: 12,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  scopeOptionsBox: {
    gap: 8,
    marginBottom: 10,
  },
  scopeRadioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  scopeRadioOptionActive: {
    borderColor: '#2878C7',
    backgroundColor: '#EFF6FF',
  },
  scopeRadioTextCol: {
    flex: 1,
  },
  scopeRadioTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  scopeRadioDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  deptChecklistBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 6,
  },
  deptPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  deptCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  deptCheckPillActive: {
    backgroundColor: '#2878C7',
    borderColor: '#2878C7',
  },
  deptCheckPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  deptCheckPillTextActive: {
    color: '#FFFFFF',
  },
  modalTogglesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalToggleLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSectionLabelSpaced: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 14,
  },
  allowedDeptsText: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 6,
    flex: 1,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
