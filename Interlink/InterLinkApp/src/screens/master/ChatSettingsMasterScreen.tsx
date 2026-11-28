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
  ChevronDown,
  Users,
  Scale,
  MessageSquare,
  Paperclip,
  Download,
  Radio,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { usePermissionStore } from '../../store/permissionStore';
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
import {
  fetchDepartments,
  DepartmentItem,
  fetchCompanies,
  switchCompanyApi,
  CompanyItem,
} from '../../api/masterApi';
import { useAuthStore } from '../../store/authStore';

type ActiveTab = 'policies' | 'user_types' | 'user_scopes';

const GROUP_CREATION_OPTIONS = [
  { label: 'All Active Employees', value: 'ALL' },
  { label: 'Administrators Only', value: 'ADMIN_ONLY' },
  { label: 'Completely Disabled', value: 'DISABLED' },
];

const BROADCAST_CREATION_OPTIONS = [
  { label: 'Administrators Only (Recommended)', value: 'ADMIN_ONLY' },
  { label: 'All Active Employees', value: 'ALL' },
  { label: 'Completely Disabled', value: 'DISABLED' },
];

export const ChatSettingsMasterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { activeCompanyId, activeCompany, user, switchCompany: storeSwitchCompany } = useAuthStore();
  const { hasPermission, isAdmin } = usePermissionStore();

  const canReadChatSettings =
    isAdmin ||
    user?.role === 'admin' ||
    user?.role === 'super admin' ||
    hasPermission('chat_settings_master', 'read');

  if (!canReadChatSettings) {
    return (
      <NoPermissionView
        moduleName="Chat Settings Master"
        headerTitle="Chat Settings"
        onBackPress={() => navigation.goBack()}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<ActiveTab>('policies');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPermId, setSavingPermId] = useState<number | null>(null);

  // Active Workspace / Company Selection State
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<number>(
    activeCompanyId || user?.company_id || 1
  );

  // Tab 1: Global Governance Policies
  const [settings, setSettings] = useState<ChatSettings>({
    allow_direct_messaging: true,
    allow_file_sharing: true,
    allow_file_downloads: true,
    allow_group_creation: 'ALL',
    allow_broadcast_creation: 'ADMIN_ONLY',
    max_file_size_mb: 25,
    cross_department_chat: true,
    read_receipts_enabled: true,
    typing_indicators_enabled: true,
    message_retention_days: 0,
    legal_hold_enabled: false,
    allow_message_editing: true,
    allow_message_deletion: true,
  });

  const [fileSizeInput, setFileSizeInput] = useState('25');
  const [retentionInput, setRetentionInput] = useState('0');

  // Custom Dropdown Modal State
  const [activeDropdown, setActiveDropdown] = useState<{
    title: string;
    description?: string;
    options: { label: string; value: string }[];
    selectedValue: string;
    onSelect: (val: string) => void;
  } | null>(null);

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
    can_download_files: true,
  });

  // Sync currentCompanyId when activeCompanyId changes externally
  useEffect(() => {
    if (activeCompanyId && activeCompanyId !== currentCompanyId) {
      setCurrentCompanyId(activeCompanyId);
    }
  }, [activeCompanyId]);

  const currentCompanyObj = useMemo(() => {
    return (
      companies.find((c) => c.id === currentCompanyId) ||
      user?.companies?.find((c) => c.id === currentCompanyId) ||
      activeCompany ||
      null
    );
  }, [companies, currentCompanyId, user?.companies, activeCompany]);

  const loadData = useCallback(async (targetCompanyId?: number) => {
    const compId =
      targetCompanyId || currentCompanyId || activeCompanyId || user?.company_id || 1;
    try {
      setLoading(true);
      const [settingsRes, permsRes, userScopesRes, deptRes, compRes] = await Promise.all([
        getChatSettings(compId).catch(() => null),
        getChatUserTypePermissions(compId).catch(() => null),
        getAllUserChatPermissions(compId).catch(() => null),
        fetchDepartments(false, compId).catch(() => null),
        fetchCompanies().catch(() => null),
      ]);

      if (compRes?.success && Array.isArray((compRes as any).companies)) {
        setCompanies((compRes as any).companies);
      } else if (compRes?.success && Array.isArray((compRes as any).data)) {
        setCompanies((compRes as any).data);
      } else if (Array.isArray(compRes)) {
        setCompanies(compRes as any);
      }

      if (settingsRes?.success && (settingsRes as any).settings) {
        const s = (settingsRes as any).settings;
        const maxFileSize =
          s.max_file_size_mb !== undefined && s.max_file_size_mb !== null
            ? Math.max(1, Number(s.max_file_size_mb))
            : 25;
        const retentionDays =
          s.message_retention_days !== undefined && s.message_retention_days !== null
            ? Math.max(0, Number(s.message_retention_days))
            : 0;
        setSettings({
          ...s,
          allow_direct_messaging:
            s.allow_direct_messaging !== undefined ? Boolean(s.allow_direct_messaging) : true,
          allow_file_sharing:
            s.allow_file_sharing !== undefined ? Boolean(s.allow_file_sharing) : true,
          allow_file_downloads:
            s.allow_file_downloads !== undefined ? Boolean(s.allow_file_downloads) : true,
          allow_group_creation: s.allow_group_creation || 'ALL',
          allow_broadcast_creation: s.allow_broadcast_creation || 'ADMIN_ONLY',
          cross_department_chat:
            s.cross_department_chat !== undefined ? Boolean(s.cross_department_chat) : true,
          read_receipts_enabled:
            s.read_receipts_enabled !== undefined ? Boolean(s.read_receipts_enabled) : true,
          typing_indicators_enabled:
            s.typing_indicators_enabled !== undefined ? Boolean(s.typing_indicators_enabled) : true,
          max_file_size_mb: maxFileSize,
          message_retention_days: retentionDays,
          legal_hold_enabled: Boolean(s.legal_hold_enabled),
          allow_message_editing:
            s.allow_message_editing !== undefined ? Boolean(s.allow_message_editing) : true,
          allow_message_deletion:
            s.allow_message_deletion !== undefined ? Boolean(s.allow_message_deletion) : true,
        });
        setFileSizeInput(String(maxFileSize));
        setRetentionInput(String(retentionDays));
      }

      if (permsRes?.success && Array.isArray((permsRes as any).permissions)) {
        const rawPerms = (permsRes as any).permissions;
        setUserTypePerms(
          rawPerms.map((p: any) => ({
            ...p,
            can_direct_chat: Boolean(p.can_direct_chat),
            can_create_group: Boolean(p.can_create_group),
            can_create_broadcast: Boolean(p.can_create_broadcast),
            can_send_files: Boolean(p.can_send_files),
            can_download_files: p.can_download_files !== false,
          }))
        );
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
  }, [currentCompanyId, activeCompanyId, user?.company_id]);

  useEffect(() => {
    loadData(currentCompanyId);
  }, [loadData, currentCompanyId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(currentCompanyId);
  };

  // Switch Company / Workspace
  const handleSelectCompany = async (comp: CompanyItem) => {
    try {
      setCurrentCompanyId(comp.id);
      setIsCompanyModalOpen(false);
      await switchCompanyApi(comp.id).catch(() => null);
      await storeSwitchCompany(comp.id).catch(() => null);
      loadData(comp.id);
    } catch (err) {
      console.error('Failed to switch workspace in Chat Settings Master:', err);
    }
  };

  // Save Tab 1: Global Policies
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const payload: ChatSettings = {
        ...settings,
        max_file_size_mb: Math.max(1, parseInt(fileSizeInput, 10) || settings.max_file_size_mb || 25),
        message_retention_days: Math.max(0, parseInt(retentionInput, 10) || settings.message_retention_days || 0),
      };
      const res = await updateChatSettings(payload, currentCompanyId);
      if (res.success) {
        if ((res as any).settings) {
          const s = (res as any).settings;
          setSettings((prev) => ({
            ...prev,
            ...s,
            allow_direct_messaging: Boolean(s.allow_direct_messaging),
            allow_file_sharing: Boolean(s.allow_file_sharing),
            allow_file_downloads: Boolean(s.allow_file_downloads),
            cross_department_chat: Boolean(s.cross_department_chat),
            read_receipts_enabled: Boolean(s.read_receipts_enabled),
            typing_indicators_enabled: Boolean(s.typing_indicators_enabled),
          }));
        }
        Alert.alert('Success', 'Global chat governance policies updated successfully.');
        loadData(currentCompanyId);
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
      const res = await saveChatUserTypePermission(
        perm.user_type_id,
        {
          can_direct_chat: Boolean(perm.can_direct_chat),
          can_create_group: Boolean(perm.can_create_group),
          can_create_broadcast: Boolean(perm.can_create_broadcast),
          can_send_files: Boolean(perm.can_send_files),
          can_download_files: perm.can_download_files !== false,
        },
        currentCompanyId
      );
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
      can_download_files: u.can_download_files !== false,
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
        can_download_files: modalFormData.can_download_files !== false,
      };

      const res = await saveUserChatPermission(
        selectedUserScope.user_id,
        payload,
        currentCompanyId
      );
      if (res.success) {
        Alert.alert('Success', `Chat scope updated for ${selectedUserScope.name}.`);
        setIsEditModalOpen(false);
        // Refresh list
        const refreshed = await getAllUserChatPermissions(currentCompanyId);
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

      {/* Active Workspace / Company Context Banner with Switcher */}
      <TouchableOpacity
        style={styles.workspaceBanner}
        onPress={() => setIsCompanyModalOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.workspaceBannerLeft}>
          <Building size={14} color="#2878C7" />
          <Text style={styles.workspaceBannerText}>
            Active Workspace:{' '}
            <Text style={styles.workspaceBannerHighlight}>
              {currentCompanyObj?.name || 'Default Company'}
            </Text>
          </Text>
        </View>
        <View style={styles.switchCompanyPill}>
          <Text style={styles.switchCompanyText}>Switch</Text>
          <ChevronDown size={12} color="#2878C7" />
        </View>
      </TouchableOpacity>

      {/* Segmented Top Navigation Tabs */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScrollContent}
        >
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
              User Role Permissions
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
              User Department Permissions
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
                      Permit sharing documents, images, and audio files in chat.
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

                {/* Switch 3: File Downloads */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>File & Document Downloads</Text>
                    <Text style={styles.policyDesc}>
                      Permit downloading raw attachments. When disabled, users can only preview in-app.
                    </Text>
                  </View>
                  <Switch
                    value={settings.allow_file_downloads !== false}
                    onValueChange={(val) =>
                      setSettings({ ...settings, allow_file_downloads: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Switch 3B: Cross-Department Communication */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>Allow Cross-Department Communication</Text>
                    <Text style={styles.policyDesc}>
                      Enable employees from different departments to message each other unless restricted individually.
                    </Text>
                  </View>
                  <Switch
                    value={settings.cross_department_chat !== false}
                    onValueChange={(val) =>
                      setSettings({ ...settings, cross_department_chat: val })
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Dropdown 1: Group Creation Policy */}
                <View style={styles.policyCardBox}>
                  <Text style={styles.policyTitle}>Group Creation Policy</Text>
                  <Text style={styles.policyDesc}>
                    Who is authorized to create project and team group channels.
                  </Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() =>
                      setActiveDropdown({
                        title: 'Group Creation Policy',
                        description: 'Who is authorized to create project and team group channels.',
                        options: GROUP_CREATION_OPTIONS,
                        selectedValue: settings.allow_group_creation,
                        onSelect: (val) => setSettings((prev) => ({ ...prev, allow_group_creation: val })),
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {GROUP_CREATION_OPTIONS.find((o) => o.value === settings.allow_group_creation)?.label ||
                        settings.allow_group_creation}
                    </Text>
                    <ChevronDown size={18} color="#64748B" strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {/* Dropdown 2: Broadcast Creation Policy */}
                <View style={styles.policyCardBox}>
                  <Text style={styles.policyTitle}>Broadcast Channel Creation</Text>
                  <Text style={styles.policyDesc}>
                    Who is authorized to post corporate-wide announcements.
                  </Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() =>
                      setActiveDropdown({
                        title: 'Broadcast Channel Creation',
                        description: 'Who is authorized to post corporate-wide announcements.',
                        options: BROADCAST_CREATION_OPTIONS,
                        selectedValue: settings.allow_broadcast_creation,
                        onSelect: (val) => setSettings((prev) => ({ ...prev, allow_broadcast_creation: val })),
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {BROADCAST_CREATION_OPTIONS.find((o) => o.value === settings.allow_broadcast_creation)?.label ||
                        settings.allow_broadcast_creation}
                    </Text>
                    <ChevronDown size={18} color="#64748B" strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {/* Number Input 1: Maximum Attachment Size (MB) - min 1 */}
                <View style={styles.policyCardBox}>
                  <Text style={styles.policyTitle}>Maximum Attachment Size (MB)</Text>
                  <Text style={styles.policyDesc}>
                    Limit individual file upload size per message (min: 1 MB, max: 100 MB).
                  </Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.numberInput}
                      keyboardType="number-pad"
                      value={fileSizeInput}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '');
                        setFileSizeInput(cleaned);
                        if (cleaned !== '') {
                          const num = Math.min(100, Math.max(1, parseInt(cleaned, 10)));
                          setSettings((prev) => ({ ...prev, max_file_size_mb: num }));
                        }
                      }}
                      onBlur={() => {
                        const parsed = parseInt(fileSizeInput, 10);
                        if (isNaN(parsed) || parsed < 1) {
                          setFileSizeInput('1');
                          setSettings((prev) => ({ ...prev, max_file_size_mb: 1 }));
                        } else if (parsed > 100) {
                          setFileSizeInput('100');
                          setSettings((prev) => ({ ...prev, max_file_size_mb: 100 }));
                        } else {
                          setFileSizeInput(String(parsed));
                          setSettings((prev) => ({ ...prev, max_file_size_mb: parsed }));
                        }
                      }}
                      placeholder="25"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={styles.inputUnitText}>MB</Text>
                  </View>
                </View>

                {/* Switch 4: Read Receipts */}
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

                {/* Number Input 2: Message Retention Policy (Days) - min 0 */}
                <View style={styles.policyCardBox}>
                  <Text style={styles.policyTitle}>Message Retention (Days)</Text>
                  <Text style={styles.policyDesc}>
                    Auto-delete messages older than N days (0 = retain indefinitely).
                  </Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.numberInput}
                      keyboardType="number-pad"
                      value={retentionInput}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '');
                        setRetentionInput(cleaned);
                        if (cleaned !== '') {
                          const num = Math.min(3650, Math.max(0, parseInt(cleaned, 10)));
                          setSettings((prev) => ({ ...prev, message_retention_days: num }));
                        }
                      }}
                      onBlur={() => {
                        const parsed = parseInt(retentionInput, 10);
                        if (isNaN(parsed) || parsed < 0) {
                          setRetentionInput('0');
                          setSettings((prev) => ({ ...prev, message_retention_days: 0 }));
                        } else if (parsed > 3650) {
                          setRetentionInput('3650');
                          setSettings((prev) => ({ ...prev, message_retention_days: 3650 }));
                        } else {
                          setRetentionInput(String(parsed));
                          setSettings((prev) => ({ ...prev, message_retention_days: parsed }));
                        }
                      }}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={styles.inputUnitText}>Days</Text>
                  </View>
                </View>

                {/* Switch 5: Corporate Legal Hold */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <View style={styles.titleWithIconRow}>
                      <Scale size={15} color="#D97706" strokeWidth={2.2} />
                      <Text style={styles.policyTitle}>Corporate Legal Hold</Text>
                    </View>
                    <Text style={styles.policyDesc}>
                      Freezes message retention & deletion policies for audit compliance.
                    </Text>
                  </View>
                  <Switch
                    value={Boolean(settings.legal_hold_enabled)}
                    onValueChange={(val) =>
                      setSettings((prev) => ({ ...prev, legal_hold_enabled: val }))
                    }
                    trackColor={{ false: '#E2E8F0', true: '#D97706' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Switch 6: Message Editing */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>Allow Message Editing</Text>
                    <Text style={styles.policyDesc}>
                      Permit senders to edit message text with visible (edited) badge.
                    </Text>
                  </View>
                  <Switch
                    value={settings.allow_message_editing !== false}
                    onValueChange={(val) =>
                      setSettings((prev) => ({ ...prev, allow_message_editing: val }))
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Switch 7: Message Deletion */}
                <View style={styles.policyRow}>
                  <View style={styles.policyTextCol}>
                    <Text style={styles.policyTitle}>Allow Message Deletion</Text>
                    <Text style={styles.policyDesc}>
                      Permit senders and group admins to recall/soft-delete messages.
                    </Text>
                  </View>
                  <Switch
                    value={settings.allow_message_deletion !== false}
                    onValueChange={(val) =>
                      setSettings((prev) => ({ ...prev, allow_message_deletion: val }))
                    }
                    trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                  />
                </View>

                {/* Switch 8: Typing Indicators */}
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
                      <Text style={styles.saveSubmitBtnText}>Save Global Policies</Text>
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
                          <View style={styles.permSwitchInfoCol}>
                            <Text style={styles.permSwitchLabel} numberOfLines={1}>Direct Chat</Text>
                            <Text
                              style={[
                                styles.permStatusBadge,
                                perm.can_direct_chat ? styles.permStatusAllowed : styles.permStatusDisabled,
                              ]}
                            >
                              {perm.can_direct_chat ? 'Allowed' : 'Disabled'}
                            </Text>
                          </View>
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
                          <View style={styles.permSwitchInfoCol}>
                            <Text style={styles.permSwitchLabel} numberOfLines={1}>Create Groups</Text>
                            <Text
                              style={[
                                styles.permStatusBadge,
                                perm.can_create_group ? styles.permStatusAllowed : styles.permStatusDisabled,
                              ]}
                            >
                              {perm.can_create_group ? 'Allowed' : 'Disabled'}
                            </Text>
                          </View>
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
                          <View style={styles.permSwitchInfoCol}>
                            <Text style={styles.permSwitchLabel} numberOfLines={1}>Broadcasts</Text>
                            <Text
                              style={[
                                styles.permStatusBadge,
                                perm.can_create_broadcast ? styles.permStatusAllowed : styles.permStatusDisabled,
                              ]}
                            >
                              {perm.can_create_broadcast ? 'Allowed' : 'Disabled'}
                            </Text>
                          </View>
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
                          <View style={styles.permSwitchInfoCol}>
                            <Text style={styles.permSwitchLabel} numberOfLines={1}>Attach Files</Text>
                            <Text
                              style={[
                                styles.permStatusBadge,
                                perm.can_send_files ? styles.permStatusAllowed : styles.permStatusDisabled,
                              ]}
                            >
                              {perm.can_send_files ? 'Allowed' : 'Disabled'}
                            </Text>
                          </View>
                          <Switch
                            value={Boolean(perm.can_send_files)}
                            onValueChange={() =>
                              handleTogglePerm(perm.user_type_id, 'can_send_files')
                            }
                            trackColor={{ false: '#E2E8F0', true: '#2878C7' }}
                            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                          />
                        </View>

                        {/* Download Files */}
                        <View style={styles.permSwitchItem}>
                          <View style={styles.permSwitchInfoCol}>
                            <Text style={styles.permSwitchLabel} numberOfLines={1}>Download Files</Text>
                            <Text
                              style={[
                                styles.permStatusBadge,
                                perm.can_download_files !== false ? styles.permStatusAllowed : styles.permStatusDisabled,
                              ]}
                            >
                              {perm.can_download_files !== false ? 'Allowed' : 'Disabled'}
                            </Text>
                          </View>
                          <Switch
                            value={perm.can_download_files !== false}
                            onValueChange={() =>
                              handleTogglePerm(perm.user_type_id, 'can_download_files')
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
                  <Text style={styles.cardTitle}>User Department Permissions</Text>
                  <Text style={styles.cardSubtitle}>
                    Configure individual cross-department chat permissions and communication boundaries.
                  </Text>
                </View>

                {/* Search Input */}
                <View style={styles.searchBarBox}>
                  <Search size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Search employee by name, username or department..."
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

                {/* User Department Permissions List */}
                <View style={styles.scopesList}>
                  {filteredUserScopes.length > 0 ? (
                    filteredUserScopes.map((u) => {
                      const scope = u.chat_scope || 'DEPARTMENT_ONLY';
                      const isCompany = scope === 'COMPANY_WIDE';
                      const isMulti = scope === 'MULTI_DEPARTMENT';
                      const allowedIds: number[] = Array.isArray(u.allowed_department_ids)
                        ? u.allowed_department_ids
                        : typeof u.allowed_department_ids === 'string'
                        ? JSON.parse(u.allowed_department_ids || '[]')
                        : [];

                      return (
                        <View key={u.user_id} style={styles.userScopeCard}>
                          {/* Top Row: User Avatar, Name, Role badge, Configure action */}
                          <View style={styles.userScopeTopRow}>
                            <View style={styles.userAvatarBox}>
                              <Text style={styles.userAvatarInitial}>
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </Text>
                            </View>
                            <View style={styles.userScopeInfo}>
                              <View style={styles.userNameBadgeRow}>
                                <Text style={styles.userScopeName} numberOfLines={1}>
                                  {u.name}
                                </Text>
                                <View style={styles.userRolePill}>
                                  <Text style={styles.userRolePillText}>
                                    {u.type_name || u.role || 'User'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.userScopeUsername} numberOfLines={1}>
                                @{u.username || 'user'}{u.email ? ` • ${u.email}` : ''}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.configureBtn}
                              onPress={() => handleOpenEditUserScope(u)}
                              activeOpacity={0.7}
                            >
                              <Sliders size={12} color="#17365D" />
                              <Text style={styles.configureBtnText}>Configure</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Assigned Department */}
                          <View style={styles.userDeptRow}>
                            <Building size={12} color="#64748B" />
                            <Text style={styles.userDeptLabel}>Assigned Department:</Text>
                            <Text style={styles.userDeptValue} numberOfLines={1}>
                              {u.department_name || 'None (Unassigned)'}
                            </Text>
                          </View>

                          {/* Communication Boundary Scope Box */}
                          <View style={styles.scopeSectionBox}>
                            <View style={styles.scopeHeaderRow}>
                              <Text style={styles.scopeSectionLabel}>Communication Scope:</Text>
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
                                    ? `Multi-Department (${allowedIds.length + (u.department_id ? 1 : 0)})`
                                    : 'Department Only'}
                                </Text>
                              </View>
                            </View>

                            {/* Accessible Departments Detail */}
                            {isCompany ? (
                              <Text style={styles.scopeDescGreen}>
                                All Departments (Entire Company)
                              </Text>
                            ) : isMulti ? (
                              <View style={styles.multiDeptWrap}>
                                <Text style={styles.multiDeptLabel}>Accessible Cross-Departments:</Text>
                                {allowedIds.length > 0 ? (
                                  <View style={styles.deptChipsRow}>
                                    {allowedIds.map((id) => (
                                      <View key={id} style={styles.deptChip}>
                                        <Text style={styles.deptChipText}>
                                          + {departmentMap[id] || `Dept #${id}`}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : (
                                  <Text style={styles.scopeDescItalic}>None selected</Text>
                                )}
                              </View>
                            ) : (
                              <Text style={styles.scopeDescSlate}>
                                Restricted to {u.department_name || 'own department'}
                              </Text>
                            )}
                          </View>

                          {/* Feature Access Capabilities for this User */}
                          <View style={styles.userCapabilitiesContainer}>
                            <Text style={styles.capabilitiesHeaderTitle}>Feature Access Capabilities</Text>
                            <View style={styles.capabilitiesGrid}>
                              {/* 1-on-1 Direct Chat */}
                              <View
                                style={[
                                  styles.capChip,
                                  u.can_direct_chat !== false ? styles.capChipActive : styles.capChipInactive,
                                ]}
                              >
                                <MessageSquare
                                  size={11}
                                  color={u.can_direct_chat !== false ? '#047857' : '#94A3B8'}
                                />
                                <Text
                                  style={[
                                    styles.capChipText,
                                    u.can_direct_chat !== false ? styles.capTextActive : styles.capTextInactive,
                                  ]}
                                >
                                  Direct Chat
                                </Text>
                                {u.can_direct_chat !== false ? (
                                  <Check size={10} color="#047857" strokeWidth={2.5} />
                                ) : (
                                  <X size={10} color="#94A3B8" strokeWidth={2.5} />
                                )}
                              </View>

                              {/* Create Groups */}
                              <View
                                style={[
                                  styles.capChip,
                                  u.can_create_group !== false ? styles.capChipActive : styles.capChipInactive,
                                ]}
                              >
                                <Users
                                  size={11}
                                  color={u.can_create_group !== false ? '#047857' : '#94A3B8'}
                                />
                                <Text
                                  style={[
                                    styles.capChipText,
                                    u.can_create_group !== false ? styles.capTextActive : styles.capTextInactive,
                                  ]}
                                >
                                  Groups
                                </Text>
                                {u.can_create_group !== false ? (
                                  <Check size={10} color="#047857" strokeWidth={2.5} />
                                ) : (
                                  <X size={10} color="#94A3B8" strokeWidth={2.5} />
                                )}
                              </View>

                              {/* Create Broadcasts */}
                              <View
                                style={[
                                  styles.capChip,
                                  Boolean(u.can_create_broadcast) ? styles.capChipActive : styles.capChipInactive,
                                ]}
                              >
                                <Radio
                                  size={11}
                                  color={Boolean(u.can_create_broadcast) ? '#047857' : '#94A3B8'}
                                />
                                <Text
                                  style={[
                                    styles.capChipText,
                                    Boolean(u.can_create_broadcast) ? styles.capTextActive : styles.capTextInactive,
                                  ]}
                                >
                                  Broadcast
                                </Text>
                                {Boolean(u.can_create_broadcast) ? (
                                  <Check size={10} color="#047857" strokeWidth={2.5} />
                                ) : (
                                  <X size={10} color="#94A3B8" strokeWidth={2.5} />
                                )}
                              </View>

                              {/* Send Attachments */}
                              <View
                                style={[
                                  styles.capChip,
                                  u.can_send_files !== false ? styles.capChipActive : styles.capChipInactive,
                                ]}
                              >
                                <Paperclip
                                  size={11}
                                  color={u.can_send_files !== false ? '#047857' : '#94A3B8'}
                                />
                                <Text
                                  style={[
                                    styles.capChipText,
                                    u.can_send_files !== false ? styles.capTextActive : styles.capTextInactive,
                                  ]}
                                >
                                  Send Files
                                </Text>
                                {u.can_send_files !== false ? (
                                  <Check size={10} color="#047857" strokeWidth={2.5} />
                                ) : (
                                  <X size={10} color="#94A3B8" strokeWidth={2.5} />
                                )}
                              </View>

                              {/* Download Files */}
                              <View
                                style={[
                                  styles.capChip,
                                  u.can_download_files !== false ? styles.capChipActive : styles.capChipInactive,
                                ]}
                              >
                                <Download
                                  size={11}
                                  color={u.can_download_files !== false ? '#047857' : '#94A3B8'}
                                />
                                <Text
                                  style={[
                                    styles.capChipText,
                                    u.can_download_files !== false ? styles.capTextActive : styles.capTextInactive,
                                  ]}
                                >
                                  Download
                                </Text>
                                {u.can_download_files !== false ? (
                                  <Check size={10} color="#047857" strokeWidth={2.5} />
                                ) : (
                                  <X size={10} color="#94A3B8" strokeWidth={2.5} />
                                )}
                              </View>
                            </View>
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
                <Text style={styles.modalHeaderTitle}>Configure User Department Permissions</Text>
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
                <View style={styles.modalToggleRow}>
                  <Text style={styles.modalToggleLabel}>Can Download Files</Text>
                  <Switch
                    value={modalFormData.can_download_files !== false}
                    onValueChange={(val) =>
                      setModalFormData({ ...modalFormData, can_download_files: val })
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

      {/* ────────────────────────────────────────────────────────
          DROPDOWN SELECTION MODAL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={activeDropdown !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveDropdown(null)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setActiveDropdown(null)}
        >
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>{activeDropdown?.title}</Text>
              <TouchableOpacity
                onPress={() => setActiveDropdown(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            {activeDropdown?.description ? (
              <Text style={styles.dropdownModalSubtitle}>
                {activeDropdown.description}
              </Text>
            ) : null}
            <View style={styles.dropdownOptionsList}>
              {activeDropdown?.options.map((opt) => {
                const isSelected = activeDropdown.selectedValue === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.dropdownOptionItem,
                      isSelected && styles.dropdownOptionItemActive,
                    ]}
                    onPress={() => {
                      activeDropdown.onSelect(opt.value);
                      setActiveDropdown(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionItemText,
                        isSelected && styles.dropdownOptionItemTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <Check size={16} color="#2878C7" strokeWidth={2.4} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          COMPANY / WORKSPACE SELECTOR MODAL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isCompanyModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCompanyModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCompanyModalOpen(false)}
        >
          <View style={styles.dropdownModalBox}>
            <View style={styles.dropdownModalHeader}>
              <View>
                <Text style={styles.dropdownModalTitle}>Select Workspace / Company</Text>
                <Text style={styles.dropdownModalSubtitle}>
                  Choose which company chat settings and policies to configure
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCompanyModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.dropdownScrollBox}>
              {(companies.length > 0 ? companies : (user?.companies || [])).map((c: any) => {
                const isSelected = c.id === currentCompanyId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.companySelectOption,
                      isSelected && styles.companySelectOptionActive,
                    ]}
                    onPress={() => handleSelectCompany(c)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.companySelectLeft}>
                      <View
                        style={[
                          styles.companyIconCircle,
                          isSelected && styles.companyIconCircleActive,
                        ]}
                      >
                        <Building
                          size={15}
                          color={isSelected ? '#FFFFFF' : '#2878C7'}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.companyOptionName,
                            isSelected && styles.companyOptionNameActive,
                          ]}
                        >
                          {c.name}
                        </Text>
                        <Text style={styles.companyOptionSub}>
                          Company ID: #{c.id} {c.email ? `• ${c.email}` : ''}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.activeCheckPill}>
                        <Check size={12} color="#FFFFFF" strokeWidth={2.8} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBarScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
  policyCardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 4,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  dropdownTriggerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    height: 42,
  },
  numberInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 0,
  },
  inputUnitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 8,
  },
  titleWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dropdownModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownModalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  dropdownOptionsList: {
    gap: 8,
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  dropdownOptionItemActive: {
    borderColor: '#2878C7',
    backgroundColor: '#EFF6FF',
  },
  dropdownOptionItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownOptionItemTextActive: {
    color: '#2878C7',
    fontWeight: '700',
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
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permSwitchInfoCol: {
    flex: 1,
    marginRight: 4,
  },
  permSwitchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  permStatusBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  permStatusAllowed: {
    color: '#059669',
  },
  permStatusDisabled: {
    color: '#94A3B8',
  },
  workspaceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  workspaceBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  workspaceBannerText: {
    fontSize: 11,
    color: '#475569',
  },
  workspaceBannerHighlight: {
    fontWeight: '700',
    color: '#1D4ED8',
  },
  switchCompanyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  switchCompanyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  dropdownModalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  dropdownScrollBox: {
    marginTop: 14,
  },
  companySelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  companySelectOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  companySelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  companyIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyIconCircleActive: {
    backgroundColor: '#2878C7',
  },
  companyOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  companyOptionNameActive: {
    color: '#1D4ED8',
  },
  companyOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  activeCheckPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2878C7',
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 12,
  },
  userScopeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userScopeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userScopeInfo: {
    flex: 1,
  },
  userNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userScopeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  userRolePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userRolePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  userScopeUsername: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  configureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  configureBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17365D',
  },
  userDeptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  userDeptLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  userDeptValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
    flex: 1,
  },
  scopeSectionBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 10,
    gap: 6,
  },
  scopeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  scopeSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
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
  scopeDescGreen: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  scopeDescSlate: {
    fontSize: 11,
    color: '#64748B',
  },
  scopeDescItalic: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  multiDeptWrap: {
    gap: 4,
  },
  multiDeptLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  deptChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  deptChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  deptChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  userCapabilitiesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 6,
  },
  capabilitiesHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  capabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  capChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  capChipActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  capChipInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  capChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  capTextActive: {
    color: '#047857',
  },
  capTextInactive: {
    color: '#94A3B8',
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
