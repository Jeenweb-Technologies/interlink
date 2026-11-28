import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import {
  Shield,
  Search,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  CheckSquare,
  Square,
  Building2,
  Users,
  FolderKanban,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { AppHeader } from '../../components/common/AppHeader';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';
import {
  fetchUserTypes,
  createUserType,
  updateUserType,
  deleteUserType,
  UserTypeItem,
  UserTypePermission,
} from '../../api/masterApi';
import { MasterStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MasterStackParamList, 'UserTypeMaster'>;

export interface MasterItem {
  key: string;
  label: string;
  isApprovalRow?: boolean;
  isReportRow?: boolean;
}

export interface PermissionSection {
  title: string;
  icon: string;
  masters: MasterItem[];
}

export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    title: 'Organization & System Masters',
    icon: 'building',
    masters: [
      { key: 'company_master', label: 'Company Master' },
      { key: 'department_master', label: 'Department Master' },
      { key: 'chat_settings_master', label: 'Chat Settings Master' },
    ],
  },
  {
    title: 'User & Access Management',
    icon: 'users',
    masters: [
      { key: 'user_type', label: 'User Type Master' },
      { key: 'user_master', label: 'User Master' },
      { key: 'device_approval', label: 'Device Approval', isApprovalRow: true },
      { key: 'activity_report', label: 'Activity Report', isReportRow: true },
    ],
  },
  {
    title: 'Workspace & Collaboration',
    icon: 'workspace',
    masters: [
      { key: 'projects', label: 'Projects & Portfolio' },
      { key: 'tasks', label: 'Task Management' },
      { key: 'notes', label: 'Notes & Scratchpad' },
      { key: 'chat', label: 'Chat & Communication' },
      { key: 'meetings', label: 'Meetings & Whiteboard' },
    ],
  },
  {
    title: 'Operations & HR',
    icon: 'clock',
    masters: [
      { key: 'attendance', label: 'Attendance & Shifts' },
      { key: 'timesheets', label: 'Timesheets' },
    ],
  },
];

export const ALL_MASTERS: MasterItem[] = PERMISSION_SECTIONS.flatMap((s) => s.masters);
export const PERMISSION_MASTERS = ALL_MASTERS;

export type PermKey = 'canRead' | 'canWrite' | 'canUpdate' | 'canDelete';

export const isApprovalRow = (key: string): boolean => key.endsWith('_approval');
export const isReportRow = (key: string): boolean => key === 'activity_report';

export const getApplicablePerms = (key: string): PermKey[] => {
  if (isApprovalRow(key)) return ['canRead', 'canWrite'];
  if (isReportRow(key)) return ['canRead'];
  return ['canRead', 'canWrite', 'canUpdate', 'canDelete'];
};

export const TOTAL_APPLICABLE_PERMS = ALL_MASTERS.reduce(
  (sum, m) => sum + getApplicablePerms(m.key).length,
  0
); // 51 total

export interface NormalizedPerm {
  masterName: string;
  canRead: boolean;
  canWrite: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const defaultPerms = (): NormalizedPerm[] =>
  ALL_MASTERS.map((m) => ({
    masterName: m.key,
    canRead: false,
    canWrite: false,
    canUpdate: false,
    canDelete: false,
  }));

const normalizePerms = (apiPerms?: UserTypePermission[]): NormalizedPerm[] => {
  if (!apiPerms || apiPerms.length === 0) return defaultPerms();

  return ALL_MASTERS.map((m) => {
    const found = apiPerms.find(
      (p) => (p.masterName || p.master_name) === m.key
    );
    const applicable = getApplicablePerms(m.key);
    return {
      masterName: m.key,
      canRead: Boolean(found?.canRead ?? found?.can_read),
      canWrite: applicable.includes('canWrite') ? Boolean(found?.canWrite ?? found?.can_write) : false,
      canUpdate: applicable.includes('canUpdate') ? Boolean(found?.canUpdate ?? found?.can_update) : false,
      canDelete: applicable.includes('canDelete') ? Boolean(found?.canDelete ?? found?.can_delete) : false,
    };
  });
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
  } catch {
    return dateStr;
  }
};

export const UserTypeMasterScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission, isAdmin } = usePermissionStore();

  const canReadUserType =
    isAdmin ||
    user?.role === 'admin' ||
    user?.role === 'super admin' ||
    hasPermission('user_type', 'read');

  if (!canReadUserType) {
    return (
      <NoPermissionView
        moduleName="UserType Master"
        headerTitle="UserType Master"
        onBackPress={() => navigation.goBack()}
      />
    );
  }
  const [userTypes, setUserTypes] = useState<UserTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUserType, setSelectedUserType] = useState<UserTypeItem | null>(null);
  const [typeName, setTypeName] = useState('');
  const [formPerms, setFormPerms] = useState<NormalizedPerm[]>(defaultPerms());
  const [saving, setSaving] = useState(false);

  const loadUserTypes = useCallback(async () => {
    try {
      const res = await fetchUserTypes();
      if (res.success && Array.isArray(res.data)) {
        setUserTypes(res.data);
      } else if (res.success && Array.isArray(res.userTypes)) {
        setUserTypes(res.userTypes);
      } else if (Array.isArray(res)) {
        setUserTypes(res);
      }
    } catch (error) {
      console.error('Failed to load user types:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUserTypes();
  }, [loadUserTypes]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUserTypes();
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedUserType(null);
    setTypeName('');
    setFormPerms(defaultPerms());
    setIsModalOpen(true);
  };

  const openEditModal = (item: UserTypeItem) => {
    setModalMode('edit');
    setSelectedUserType(item);
    setTypeName(item.type_name || '');
    setFormPerms(normalizePerms(item.permissions));
    setIsModalOpen(true);
  };

  // Toggle single permission for a master
  const toggleModalPerm = (masterKey: string, permKey: PermKey) => {
    if (!getApplicablePerms(masterKey).includes(permKey)) return;
    setFormPerms((prev) =>
      prev.map((p) =>
        p.masterName === masterKey ? { ...p, [permKey]: !p[permKey] } : p
      )
    );
  };

  // Toggle entire row (all applicable perms for one master)
  const toggleMasterRow = (masterKey: string) => {
    const applicable = getApplicablePerms(masterKey);
    const row = formPerms.find((p) => p.masterName === masterKey);
    if (!row) return;

    const allChecked = applicable.every((perm) => row[perm]);
    setFormPerms((prev) =>
      prev.map((p) => {
        if (p.masterName !== masterKey) return p;
        const next = { ...p };
        applicable.forEach((perm) => {
          next[perm] = !allChecked;
        });
        return next;
      })
    );
  };

  // Toggle entire section (all masters under this section)
  const toggleSection = (section: PermissionSection) => {
    const sectionKeys = section.masters.map((m) => m.key);
    const allSectionChecked = section.masters.every((m) => {
      const row = formPerms.find((p) => p.masterName === m.key);
      const applicable = getApplicablePerms(m.key);
      return row && applicable.every((perm) => row[perm]);
    });

    setFormPerms((prev) =>
      prev.map((p) => {
        if (!sectionKeys.includes(p.masterName)) return p;
        const applicable = getApplicablePerms(p.masterName);
        const next = { ...p };
        applicable.forEach((perm) => {
          next[perm] = !allSectionChecked;
        });
        return next;
      })
    );
  };

  // Toggle entire column across all applicable masters
  const toggleColumnPerm = (permKey: PermKey) => {
    const applicableRows = formPerms.filter((p) =>
      getApplicablePerms(p.masterName).includes(permKey)
    );
    const allChecked =
      applicableRows.length > 0 && applicableRows.every((p) => p[permKey]);

    setFormPerms((prev) =>
      prev.map((p) => {
        if (!getApplicablePerms(p.masterName).includes(permKey)) return p;
        return { ...p, [permKey]: !allChecked };
      })
    );
  };

  // Select all applicable permissions across all 14 masters
  const selectAllPerms = () => {
    setFormPerms((prev) =>
      prev.map((p) => {
        const applicable = getApplicablePerms(p.masterName);
        const next = { ...p };
        applicable.forEach((perm) => {
          next[perm] = true;
        });
        return next;
      })
    );
  };

  // Clear all permissions
  const clearAllPerms = () => {
    setFormPerms(defaultPerms());
  };

  // Inspection helpers
  const isRowAll = (masterKey: string): boolean => {
    const applicable = getApplicablePerms(masterKey);
    const row = formPerms.find((p) => p.masterName === masterKey);
    return row ? applicable.every((perm) => row[perm]) : false;
  };

  const isSectionAll = (section: PermissionSection): boolean => {
    return section.masters.every((m) => isRowAll(m.key));
  };

  const isColAll = (permKey: PermKey): boolean => {
    const applicableRows = formPerms.filter((p) =>
      getApplicablePerms(p.masterName).includes(permKey)
    );
    return applicableRows.length > 0 && applicableRows.every((p) => p[permKey]);
  };

  const isAllAll = (): boolean =>
    ALL_MASTERS.every((m) => isRowAll(m.key));

  const getColCheckedCount = (permKey: PermKey): { checked: number; total: number } => {
    const applicableRows = formPerms.filter((p) =>
      getApplicablePerms(p.masterName).includes(permKey)
    );
    const checked = applicableRows.filter((p) => p[permKey]).length;
    return { checked, total: applicableRows.length };
  };

  const handleFormSubmit = async () => {
    if (!typeName.trim()) {
      Alert.alert('Required Field', 'User type name is required');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const res = await createUserType({
          typeName: typeName.trim(),
          permissions: formPerms,
        });

        if (res.success) {
          Alert.alert('Success', `User type '${typeName.trim()}' created successfully!`);
          setIsModalOpen(false);
          await loadUserTypes();
        } else {
          Alert.alert('Error', res.message || 'Failed to create user type');
        }
      } else if (selectedUserType) {
        const res = await updateUserType(selectedUserType.id, {
          typeName: typeName.trim(),
          permissions: formPerms,
        });

        if (res.success) {
          Alert.alert('Success', 'User type updated successfully!');
          setIsModalOpen(false);
          await loadUserTypes();
        } else {
          Alert.alert('Error', res.message || 'Failed to update user type');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save user type');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = (item: UserTypeItem) => {
    Alert.alert(
      'Delete User Type?',
      `Are you sure you want to delete "${item.type_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteUserType(item.id);
              if (res.success) {
                Alert.alert('Success', 'User type deleted successfully');
                await loadUserTypes();
              } else {
                Alert.alert('Error', res.message || 'Failed to delete user type');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete user type');
            }
          },
        },
      ]
    );
  };

  const filteredUserTypes = userTypes.filter((ut) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      ut.type_name?.toLowerCase().includes(q) ||
      ut.description?.toLowerCase().includes(q) ||
      ut.added_by_name?.toLowerCase().includes(q)
    );
  });

  const readCount = getColCheckedCount('canRead');
  const writeCount = getColCheckedCount('canWrite');
  const updateCount = getColCheckedCount('canUpdate');
  const deleteCount = getColCheckedCount('canDelete');

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Reusable Curved Header matching Master Screen: Deep theme navy, back arrow, centered title, right "+" button */}
      <AppHeader
        title="User Type Master"
        onBackPress={() => navigation.goBack()}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={openCreateModal}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Create User Type"
          >
            <Plus size={22} color={theme.colors.textWhite} strokeWidth={2.4} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Search Bar */}
        <Input
          placeholder="Search by role name or description..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={16} color={theme.colors.textMuted} />}
          dark={false}
          containerStyle={styles.searchContainer}
        />

        {/* User Type Cards List */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Loading role matrix...</Text>
          </View>
        ) : filteredUserTypes.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyTitle}>No user types found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try matching another role archetype'
                : 'Tap the + button in the header to create a user type'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUserTypes}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
            renderItem={({ item }) => {
              const perms = normalizePerms(item.permissions);
              const grantedCount = perms.reduce((total, p) => {
                const isApproval = p.masterName === 'device_approval';
                const isReport = p.masterName === 'activity_report';
                return (
                  total +
                  (p.canRead ? 1 : 0) +
                  (!isReport && p.canWrite ? 1 : 0) +
                  (!isApproval && !isReport && p.canUpdate ? 1 : 0) +
                  (!isApproval && !isReport && p.canDelete ? 1 : 0)
                );
              }, 0);

              const isFullAccess = grantedCount === TOTAL_APPLICABLE_PERMS;

              return (
                <Card variant="light" dark={false} style={styles.roleCard}>
                  {/* Card Header: Role Icon + Type Name & Subtitle + RBAC Badge */}
                  <View style={styles.cardHeader}>
                    <View style={styles.roleMainInfo}>
                      <View style={styles.roleIconBox}>
                        <Shield size={20} color="#7C3AED" />
                      </View>
                      <View style={styles.nameBlock}>
                        <View style={styles.nameRow}>
                          <Text style={styles.roleName} numberOfLines={1}>
                            {item.type_name}
                          </Text>
                        </View>
                        <View style={styles.subInfoRow}>
                          <Text style={styles.roleCode}>Code: #{item.id}</Text>
                          {item.created_at ? (
                            <View style={styles.dateBadge}>
                              <Calendar size={11} color={theme.colors.textMuted} />
                              <Text style={styles.metaDate}>
                                {formatDate(item.created_at)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {/* Top Right: Status / RBAC Badge matching frontend */}
                    {isFullAccess ? (
                      <View style={styles.fullAccessBadge}>
                        <Check size={11} color="#059669" strokeWidth={2.5} />
                        <Text style={styles.fullAccessText}>Full Access (14)</Text>
                      </View>
                    ) : grantedCount === 0 ? (
                      <StatusBadge label="No Access" status="neutral" />
                    ) : (
                      <StatusBadge
                        label={`${grantedCount}/${TOTAL_APPLICABLE_PERMS} Perms`}
                        status="warning"
                      />
                    )}
                  </View>

                  {/* Added by / Description information */}
                  {item.added_by_name ? (
                    <Text style={styles.addedByText}>
                      Added by: <Text style={styles.boldText}>{item.added_by_name}</Text>
                    </Text>
                  ) : null}

                  {item.description ? (
                    <Text style={styles.description}>{item.description}</Text>
                  ) : null}

                  {/* Inner Surface: Permission Matrix grouped by Section */}
                  <View style={styles.innerSurface}>
                    <View style={styles.permHeaderRow}>
                      <Text style={styles.permHeaderTitle}>Module Permissions</Text>
                      <Text style={styles.permCounter}>
                        {grantedCount} Granted
                      </Text>
                    </View>

                    <View style={styles.permList}>
                      {PERMISSION_SECTIONS.map((section, sIdx) => {
                        const sectionMasters = section.masters;
                        return (
                          <View key={`list-sec-${sIdx}`} style={styles.listSectionBox}>
                            <View style={styles.listSectionHeader}>
                              <Text style={styles.listSectionTitle}>
                                {section.title}
                              </Text>
                            </View>

                            <View style={styles.listSectionMasters}>
                              {sectionMasters.map((m) => {
                                const p = perms.find((x) => x.masterName === m.key);
                                const applicable = getApplicablePerms(m.key);
                                const canR = Boolean(p?.canRead);
                                const canW = applicable.includes('canWrite') && Boolean(p?.canWrite);
                                const canU = applicable.includes('canUpdate') && Boolean(p?.canUpdate);
                                const canD = applicable.includes('canDelete') && Boolean(p?.canDelete);

                                return (
                                  <View key={m.key} style={styles.permItemRow}>
                                    <View style={styles.moduleNameWrap}>
                                      <View style={styles.bulletDot} />
                                      <Text style={styles.moduleName} numberOfLines={1}>
                                        {m.label}
                                      </Text>
                                    </View>

                                    <View style={styles.crudChipsRow}>
                                      {/* Read */}
                                      <View
                                        style={[
                                          styles.crudChip,
                                          canR ? styles.chipActiveRead : styles.chipInactiveLight,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.crudChipText,
                                            canR ? styles.chipTextRead : styles.chipTextLight,
                                          ]}
                                        >
                                          Read
                                        </Text>
                                      </View>

                                      {/* Write / Approval */}
                                      {applicable.includes('canWrite') ? (
                                        <View
                                          style={[
                                            styles.crudChip,
                                            canW ? styles.chipActiveWrite : styles.chipInactiveLight,
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.crudChipText,
                                              canW ? styles.chipTextWrite : styles.chipTextLight,
                                            ]}
                                          >
                                            {m.key === 'device_approval' ? 'Approval' : 'Write'}
                                          </Text>
                                        </View>
                                      ) : (
                                        <View style={[styles.crudChip, styles.chipDisabled]}>
                                          <Text style={styles.chipTextDisabled}>—</Text>
                                        </View>
                                      )}

                                      {/* Update */}
                                      {applicable.includes('canUpdate') ? (
                                        <View
                                          style={[
                                            styles.crudChip,
                                            canU ? styles.chipActiveUpdate : styles.chipInactiveLight,
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.crudChipText,
                                              canU ? styles.chipTextUpdate : styles.chipTextLight,
                                            ]}
                                          >
                                            Update
                                          </Text>
                                        </View>
                                      ) : (
                                        <View style={[styles.crudChip, styles.chipDisabled]}>
                                          <Text style={styles.chipTextDisabled}>—</Text>
                                        </View>
                                      )}

                                      {/* Delete */}
                                      {applicable.includes('canDelete') ? (
                                        <View
                                          style={[
                                            styles.crudChip,
                                            canD ? styles.chipActiveDelete : styles.chipInactiveLight,
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.crudChipText,
                                              canD ? styles.chipTextDelete : styles.chipTextLight,
                                            ]}
                                          >
                                            Delete
                                          </Text>
                                        </View>
                                      ) : (
                                        <View style={[styles.crudChip, styles.chipDisabled]}>
                                          <Text style={styles.chipTextDisabled}>—</Text>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Bottom Footer: Edit & Delete Action Buttons */}
                  <View style={styles.cardFooter}>
                    <View style={styles.flexOne} />
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => openEditModal(item)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Edit user type"
                      >
                        <Pencil size={15} color="#475569" strokeWidth={2} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionIconBtn, styles.deleteIconBtn]}
                        onPress={() => handleDeletePrompt(item)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Delete user type"
                      >
                        <Trash2 size={15} color="#DC2626" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>

      {/* =========================================================================
          Create / Edit User Type Modal with Categorized Sections & Column Toggles
         ========================================================================= */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>
                  {modalMode === 'create' ? 'Create User Type' : 'Edit User Type'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {modalMode === 'create'
                    ? 'Define user group name and configure module permissions'
                    : 'Update user group name and configure module permissions'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
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
              {/* Type Name Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  USER TYPE NAME <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Input
                  placeholder="e.g. Supervisor, Technician, Manager"
                  value={typeName}
                  onChangeText={setTypeName}
                  dark={false}
                  leftIcon={<Shield size={16} color={theme.colors.textMuted} />}
                />
              </View>

              {/* Module Permissions Matrix Header */}
              <View style={styles.permMatrixHeader}>
                <View style={styles.matrixTitleBlock}>
                  <Text style={styles.matrixTitle}>Module Permissions Matrix</Text>
                  <Text style={styles.matrixSubtitle}>
                    Set read, write, update and delete access across all 14 modules
                  </Text>
                </View>

                {/* Global Select All / Clear All */}
                <TouchableOpacity
                  style={[styles.toggleAllBtn, isAllAll() && styles.toggleAllBtnActive]}
                  onPress={isAllAll() ? clearAllPerms : selectAllPerms}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleAllBtnText, isAllAll() && styles.toggleAllBtnTextActive]}>
                    {isAllAll() ? '✓ Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Quick Column Bulk Toggles Bar (Read, Write/Appr, Update, Delete) */}
              <View style={styles.columnBarContainer}>
                <Text style={styles.columnBarTitle}>COLUMN QUICK TOGGLE (APPLY TO ALL):</Text>
                <View style={styles.columnBarRow}>
                  {/* Read Column */}
                  <TouchableOpacity
                    style={[
                      styles.colToggleChip,
                      styles.colToggleRead,
                      isColAll('canRead') && styles.colToggleActiveRead,
                    ]}
                    onPress={() => toggleColumnPerm('canRead')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.colCheckbox,
                        isColAll('canRead') && styles.colCheckboxActiveRead,
                      ]}
                    >
                      {isColAll('canRead') && (
                        <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.colToggleText,
                        styles.colToggleTextRead,
                        isColAll('canRead') && styles.colToggleTextActiveLight,
                      ]}
                    >
                      Read ({readCount.checked}/{readCount.total})
                    </Text>
                  </TouchableOpacity>

                  {/* Write Column */}
                  <TouchableOpacity
                    style={[
                      styles.colToggleChip,
                      styles.colToggleWrite,
                      isColAll('canWrite') && styles.colToggleActiveWrite,
                    ]}
                    onPress={() => toggleColumnPerm('canWrite')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.colCheckbox,
                        isColAll('canWrite') && styles.colCheckboxActiveWrite,
                      ]}
                    >
                      {isColAll('canWrite') && (
                        <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.colToggleText,
                        styles.colToggleTextWrite,
                        isColAll('canWrite') && styles.colToggleTextActiveLight,
                      ]}
                    >
                      Write ({writeCount.checked}/{writeCount.total})
                    </Text>
                  </TouchableOpacity>

                  {/* Update Column */}
                  <TouchableOpacity
                    style={[
                      styles.colToggleChip,
                      styles.colToggleUpdate,
                      isColAll('canUpdate') && styles.colToggleActiveUpdate,
                    ]}
                    onPress={() => toggleColumnPerm('canUpdate')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.colCheckbox,
                        isColAll('canUpdate') && styles.colCheckboxActiveUpdate,
                      ]}
                    >
                      {isColAll('canUpdate') && (
                        <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.colToggleText,
                        styles.colToggleTextUpdate,
                        isColAll('canUpdate') && styles.colToggleTextActiveLight,
                      ]}
                    >
                      Update ({updateCount.checked}/{updateCount.total})
                    </Text>
                  </TouchableOpacity>

                  {/* Delete Column */}
                  <TouchableOpacity
                    style={[
                      styles.colToggleChip,
                      styles.colToggleDelete,
                      isColAll('canDelete') && styles.colToggleActiveDelete,
                    ]}
                    onPress={() => toggleColumnPerm('canDelete')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.colCheckbox,
                        isColAll('canDelete') && styles.colCheckboxActiveDelete,
                      ]}
                    >
                      {isColAll('canDelete') && (
                        <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.colToggleText,
                        styles.colToggleTextDelete,
                        isColAll('canDelete') && styles.colToggleTextActiveLight,
                      ]}
                    >
                      Delete ({deleteCount.checked}/{deleteCount.total})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Categorized Sections List */}
              <View style={styles.modalSectionsContainer}>
                {PERMISSION_SECTIONS.map((section, sIdx) => {
                  const sectionAll = isSectionAll(section);

                  return (
                    <View key={`sec-${sIdx}`} style={styles.modalSectionCard}>
                      {/* Section Header Banner */}
                      <View style={styles.modalSectionBanner}>
                        <View style={styles.sectionTitleRow}>
                          <View style={styles.sectionIconBadge}>
                            {section.icon === 'building' ? (
                              <Building2 size={13} color="#0056CF" />
                            ) : section.icon === 'users' ? (
                              <Users size={13} color="#0056CF" />
                            ) : section.icon === 'workspace' ? (
                              <FolderKanban size={13} color="#0056CF" />
                            ) : (
                              <Clock size={13} color="#0056CF" />
                            )}
                          </View>
                          <Text style={styles.modalSectionTitle}>
                            {section.title}
                          </Text>
                        </View>

                        {/* Section All Toggle Button */}
                        <TouchableOpacity
                          style={[
                            styles.sectionToggleBtn,
                            sectionAll && styles.sectionToggleBtnActive,
                          ]}
                          onPress={() => toggleSection(section)}
                          activeOpacity={0.7}
                        >
                          {sectionAll ? (
                            <CheckSquare size={13} color="#0056CF" />
                          ) : (
                            <Square size={13} color="#94A3B8" />
                          )}
                          <Text
                            style={[
                              styles.sectionToggleBtnText,
                              sectionAll && styles.sectionToggleBtnTextActive,
                            ]}
                          >
                            {sectionAll ? '✓ All' : 'Section All'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Masters in this Section */}
                      <View style={styles.modalSectionBody}>
                        {section.masters.map((m) => {
                          const row = formPerms.find((p) => p.masterName === m.key);
                          const applicable = getApplicablePerms(m.key);
                          const rowAll = isRowAll(m.key);

                          return (
                            <View key={m.key} style={styles.moduleRowCard}>
                              {/* Master Title & Row Toggle */}
                              <View style={styles.moduleRowHeader}>
                                <View style={styles.moduleTitleBlock}>
                                  <View style={styles.moduleDot} />
                                  <Text style={styles.moduleRowTitle}>{m.label}</Text>
                                </View>

                                <TouchableOpacity
                                  style={[
                                    styles.rowAllToggleBtn,
                                    rowAll && styles.rowAllToggleBtnActive,
                                  ]}
                                  onPress={() => toggleMasterRow(m.key)}
                                  activeOpacity={0.7}
                                >
                                  {rowAll ? (
                                    <CheckSquare size={13} color="#0056CF" />
                                  ) : (
                                    <Square size={13} color="#94A3B8" />
                                  )}
                                  <Text
                                    style={[
                                      styles.rowAllToggleText,
                                      rowAll && styles.rowAllToggleTextActive,
                                    ]}
                                  >
                                    {rowAll ? '✓ All' : 'All'}
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {/* Permission Toggle Buttons for this master */}
                              <View style={styles.permButtonsGrid}>
                                {/* 1. READ */}
                                <TouchableOpacity
                                  style={[
                                    styles.permBtn,
                                    row?.canRead && styles.permBtnActiveRead,
                                  ]}
                                  onPress={() => toggleModalPerm(m.key, 'canRead')}
                                  activeOpacity={0.7}
                                >
                                  <View
                                    style={[
                                      styles.permBtnCheckCircle,
                                      row?.canRead && styles.permBtnCheckCircleActiveRead,
                                    ]}
                                  >
                                    {row?.canRead && (
                                      <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                                    )}
                                  </View>
                                  <Text
                                    style={[
                                      styles.permBtnLabel,
                                      row?.canRead && styles.permBtnLabelActiveRead,
                                    ]}
                                  >
                                    Read
                                  </Text>
                                </TouchableOpacity>

                                {/* 2. WRITE / APPROVAL */}
                                {applicable.includes('canWrite') ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.permBtn,
                                      row?.canWrite && styles.permBtnActiveWrite,
                                    ]}
                                    onPress={() => toggleModalPerm(m.key, 'canWrite')}
                                    activeOpacity={0.7}
                                  >
                                    <View
                                      style={[
                                        styles.permBtnCheckCircle,
                                        row?.canWrite && styles.permBtnCheckCircleActiveWrite,
                                      ]}
                                    >
                                      {row?.canWrite && (
                                        <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                                      )}
                                    </View>
                                    <Text
                                      style={[
                                        styles.permBtnLabel,
                                        row?.canWrite && styles.permBtnLabelActiveWrite,
                                      ]}
                                    >
                                      {m.key === 'device_approval' ? 'Approval' : 'Write'}
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <View style={[styles.permBtn, styles.permBtnDisabled]}>
                                    <Text style={styles.permBtnDisabledText}>—</Text>
                                  </View>
                                )}

                                {/* 3. UPDATE */}
                                {applicable.includes('canUpdate') ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.permBtn,
                                      row?.canUpdate && styles.permBtnActiveUpdate,
                                    ]}
                                    onPress={() => toggleModalPerm(m.key, 'canUpdate')}
                                    activeOpacity={0.7}
                                  >
                                    <View
                                      style={[
                                        styles.permBtnCheckCircle,
                                        row?.canUpdate && styles.permBtnCheckCircleActiveUpdate,
                                      ]}
                                    >
                                      {row?.canUpdate && (
                                        <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                                      )}
                                    </View>
                                    <Text
                                      style={[
                                        styles.permBtnLabel,
                                        row?.canUpdate && styles.permBtnLabelActiveUpdate,
                                      ]}
                                    >
                                      Update
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <View style={[styles.permBtn, styles.permBtnDisabled]}>
                                    <Text style={styles.permBtnDisabledText}>—</Text>
                                  </View>
                                )}

                                {/* 4. DELETE */}
                                {applicable.includes('canDelete') ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.permBtn,
                                      row?.canDelete && styles.permBtnActiveDelete,
                                    ]}
                                    onPress={() => toggleModalPerm(m.key, 'canDelete')}
                                    activeOpacity={0.7}
                                  >
                                    <View
                                      style={[
                                        styles.permBtnCheckCircle,
                                        row?.canDelete && styles.permBtnCheckCircleActiveDelete,
                                      ]}
                                    >
                                      {row?.canDelete && (
                                        <Check size={10} color="#FFFFFF" strokeWidth={2.5} />
                                      )}
                                    </View>
                                    <Text
                                      style={[
                                        styles.permBtnLabel,
                                        row?.canDelete && styles.permBtnLabelActiveDelete,
                                      ]}
                                    >
                                      Delete
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <View style={[styles.permBtn, styles.permBtnDisabled]}>
                                    <Text style={styles.permBtnDisabledText}>—</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Legend matching frontend */}
              <View style={styles.legendCard}>
                <Text style={styles.legendTitle}>PERMISSION COLOR LEGEND:</Text>
                <View style={styles.legendItemsRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#0056CF' }]} />
                    <Text style={styles.legendText}>Read (Blue)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#15803D' }]} />
                    <Text style={styles.legendText}>Write / Approval (Green)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
                    <Text style={styles.legendText}>Update (Amber)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#E11D48' }]} />
                    <Text style={styles.legendText}>Delete (Rose)</Text>
                  </View>
                </View>
              </View>

              {/* Modal Action Buttons */}
              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsModalOpen(false)}
                  style={styles.modalCancelBtn}
                  disabled={saving}
                />
                <Button
                  title={
                    saving
                      ? 'Saving...'
                      : modalMode === 'create'
                        ? 'Create User Type'
                        : 'Save Changes'
                  }
                  variant="primary"
                  onPress={handleFormSubmit}
                  style={styles.modalSubmitBtn}
                  disabled={saving}
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
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 28,
    gap: 14,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    gap: 10,
  },
  loadingText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 4,
  },
  roleCard: {
    padding: 15,
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
    paddingBottom: 8,
  },
  roleMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  roleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  roleCode: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  fullAccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fullAccessText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.heavy,
    color: '#059669',
  },
  addedByText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  description: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  innerSurface: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginTop: 4,
  },
  permHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  permHeaderTitle: {
    fontSize: 11,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permCounter: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
  },
  permList: {
    gap: 10,
  },
  listSectionBox: {
    gap: 4,
  },
  listSectionHeader: {
    paddingVertical: 3,
  },
  listSectionTitle: {
    fontSize: 10,
    fontWeight: theme.typography.weights.heavy,
    color: '#0056CF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listSectionMasters: {
    gap: 5,
  },
  permItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moduleNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0056CF',
  },
  moduleName: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  crudChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crudChip: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActiveRead: {
    backgroundColor: '#F0F7FF',
    borderColor: '#BCDBFF',
  },
  chipTextRead: {
    color: '#0056CF',
  },
  chipActiveWrite: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  chipTextWrite: {
    color: '#15803D',
  },
  chipActiveUpdate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  chipTextUpdate: {
    color: '#B45309',
  },
  chipActiveDelete: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  chipTextDelete: {
    color: '#BE123C',
  },
  chipInactiveLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  chipDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: 'transparent',
  },
  chipTextDisabled: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  crudChipText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.2,
  },
  chipTextLight: {
    color: '#94A3B8',
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteIconBtn: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
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
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  modalTitleBlock: {
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: 0.4,
  },
  requiredStar: {
    color: '#DC2626',
  },

  // Permissions Matrix Header
  permMatrixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  matrixTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  matrixTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matrixSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  toggleAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0056CF',
    backgroundColor: '#F0F7FF',
  },
  toggleAllBtnActive: {
    backgroundColor: '#0056CF',
    borderColor: '#0056CF',
  },
  toggleAllBtnText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#0056CF',
  },
  toggleAllBtnTextActive: {
    color: '#FFFFFF',
  },

  // Column Bar
  columnBarContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  columnBarTitle: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.heavy,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  columnBarRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  colToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    minWidth: '22%',
    justifyContent: 'center',
  },
  colCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colToggleRead: {
    backgroundColor: '#F0F7FF',
    borderColor: '#BCDBFF',
  },
  colToggleActiveRead: {
    backgroundColor: '#0056CF',
    borderColor: '#0056CF',
  },
  colCheckboxActiveRead: {
    backgroundColor: '#0056CF',
    borderColor: '#0056CF',
  },
  colToggleTextRead: {
    color: '#0056CF',
  },
  colToggleWrite: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  colToggleActiveWrite: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  colCheckboxActiveWrite: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  colToggleTextWrite: {
    color: '#15803D',
  },
  colToggleUpdate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  colToggleActiveUpdate: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  colCheckboxActiveUpdate: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  colToggleTextUpdate: {
    color: '#B45309',
  },
  colToggleDelete: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  colToggleActiveDelete: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  colCheckboxActiveDelete: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  colToggleTextDelete: {
    color: '#BE123C',
  },
  colToggleText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.heavy,
  },
  colToggleTextActiveLight: {
    color: '#FFFFFF',
  },

  // Modal Section Cards
  modalSectionsContainer: {
    gap: 14,
  },
  modalSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  modalSectionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#E0EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSectionTitle: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.heavy,
    color: '#0056CF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  sectionToggleBtnActive: {
    backgroundColor: '#F0F7FF',
    borderColor: '#0056CF',
  },
  sectionToggleBtnText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#64748B',
  },
  sectionToggleBtnTextActive: {
    color: '#0056CF',
  },
  modalSectionBody: {
    padding: 10,
    gap: 10,
  },

  // Individual Module Row Card in Modal
  moduleRowCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 10,
    gap: 8,
  },
  moduleRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  moduleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0056CF',
  },
  moduleRowTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  rowAllToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  rowAllToggleBtnActive: {
    backgroundColor: '#F0F7FF',
    borderColor: '#0056CF',
  },
  rowAllToggleText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: '#64748B',
  },
  rowAllToggleTextActive: {
    color: '#0056CF',
  },

  // Permission Buttons 4-Grid
  permButtonsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  permBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  permBtnCheckCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnLabel: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: '#64748B',
  },
  // Read active
  permBtnActiveRead: {
    backgroundColor: '#F0F7FF',
    borderColor: '#0056CF',
  },
  permBtnCheckCircleActiveRead: {
    backgroundColor: '#0056CF',
    borderColor: '#0056CF',
  },
  permBtnLabelActiveRead: {
    color: '#0056CF',
  },
  // Write active
  permBtnActiveWrite: {
    backgroundColor: '#F0FDF4',
    borderColor: '#15803D',
  },
  permBtnCheckCircleActiveWrite: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  permBtnLabelActiveWrite: {
    color: '#15803D',
  },
  // Update active
  permBtnActiveUpdate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },
  permBtnCheckCircleActiveUpdate: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  permBtnLabelActiveUpdate: {
    color: '#B45309',
  },
  // Delete active
  permBtnActiveDelete: {
    backgroundColor: '#FFF1F2',
    borderColor: '#E11D48',
  },
  permBtnCheckCircleActiveDelete: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  permBtnLabelActiveDelete: {
    color: '#BE123C',
  },
  // Disabled
  permBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  permBtnDisabledText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '700',
  },

  // Legend
  legendCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 6,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: theme.typography.weights.heavy,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  legendItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.semibold,
    color: '#475569',
  },

  // Actions
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 1.5,
  },
});
