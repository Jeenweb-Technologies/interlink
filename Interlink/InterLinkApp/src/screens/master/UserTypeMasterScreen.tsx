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
  fetchUserTypes,
  createUserType,
  updateUserType,
  deleteUserType,
  UserTypeItem,
  UserTypePermission,
} from '../../api/masterApi';
import { MasterStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MasterStackParamList, 'UserTypeMaster'>;

export interface MasterConfig {
  key: string;
  label: string;
  hasUpdateDelete: boolean;
}

export const PERMISSION_MASTERS: MasterConfig[] = [
  { key: 'user_type', label: 'User Type Master', hasUpdateDelete: true },
  { key: 'user_master', label: 'User Master', hasUpdateDelete: true },
  { key: 'device_approval', label: 'Device Approval', hasUpdateDelete: false },
  { key: 'activity_report', label: 'Activity Report', hasUpdateDelete: true },
];

export interface NormalizedPerm {
  masterName: string;
  canRead: boolean;
  canWrite: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const defaultPerms = (): NormalizedPerm[] =>
  PERMISSION_MASTERS.map((m) => ({
    masterName: m.key,
    canRead: false,
    canWrite: false,
    canUpdate: false,
    canDelete: false,
  }));

const normalizePerms = (apiPerms?: UserTypePermission[]): NormalizedPerm[] => {
  if (!apiPerms || apiPerms.length === 0) return defaultPerms();

  return PERMISSION_MASTERS.map((m) => {
    const found = apiPerms.find(
      (p) => (p.masterName || p.master_name) === m.key
    );
    return {
      masterName: m.key,
      canRead: Boolean(found?.canRead ?? found?.can_read),
      canWrite: Boolean(found?.canWrite ?? found?.can_write),
      canUpdate: m.hasUpdateDelete ? Boolean(found?.canUpdate ?? found?.can_update) : false,
      canDelete: m.hasUpdateDelete ? Boolean(found?.canDelete ?? found?.can_delete) : false,
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

  const toggleModalPerm = (
    masterKey: string,
    permKey: 'canRead' | 'canWrite' | 'canUpdate' | 'canDelete'
  ) => {
    setFormPerms((prev) =>
      prev.map((p) =>
        p.masterName === masterKey ? { ...p, [permKey]: !p[permKey] } : p
      )
    );
  };

  const toggleMasterRow = (masterKey: string) => {
    const config = PERMISSION_MASTERS.find((m) => m.key === masterKey);
    const row = formPerms.find((p) => p.masterName === masterKey);
    if (!row) return;

    const allChecked = config?.hasUpdateDelete
      ? row.canRead && row.canWrite && row.canUpdate && row.canDelete
      : row.canRead && row.canWrite;

    setFormPerms((prev) =>
      prev.map((p) =>
        p.masterName === masterKey
          ? {
              ...p,
              canRead: !allChecked,
              canWrite: !allChecked,
              canUpdate: config?.hasUpdateDelete ? !allChecked : false,
              canDelete: config?.hasUpdateDelete ? !allChecked : false,
            }
          : p
      )
    );
  };

  const selectAllPerms = () => {
    setFormPerms(
      PERMISSION_MASTERS.map((m) => ({
        masterName: m.key,
        canRead: true,
        canWrite: true,
        canUpdate: m.hasUpdateDelete,
        canDelete: m.hasUpdateDelete,
      }))
    );
  };

  const clearAllPerms = () => {
    setFormPerms(defaultPerms());
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
          Alert.alert('Success', 'User type created successfully!');
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
                return (
                  total +
                  (p.canRead ? 1 : 0) +
                  (p.canWrite ? 1 : 0) +
                  (!isApproval && p.canUpdate ? 1 : 0) +
                  (!isApproval && p.canDelete ? 1 : 0)
                );
              }, 0);

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

                    {/* Top Right: Status / RBAC Badge */}
                    <StatusBadge
                      label={`${grantedCount}/14 Allowed`}
                      status="warning"
                    />
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

                  {/* Inner Surface: Permission Matrix with Dark Active & Light Deactive Colors */}
                  <View style={styles.innerSurface}>
                    <View style={styles.permHeaderRow}>
                      <Text style={styles.permHeaderTitle}>Module Permissions</Text>
                      {/* <Text style={styles.permCounter}>{grantedCount}/14 Allowed</Text> */}
                    </View>

                    <View style={styles.permList}>
                      {PERMISSION_MASTERS.map((m) => {
                        const p = perms.find((x) => x.masterName === m.key);
                        const canR = Boolean(p?.canRead);
                        const canW = Boolean(p?.canWrite);
                        const canU = Boolean(p?.canUpdate);
                        const canD = Boolean(p?.canDelete);

                        return (
                          <View key={m.key} style={styles.permItemRow}>
                            <Text style={styles.moduleName} numberOfLines={1}>
                              {m.label}
                            </Text>

                            <View style={styles.crudChipsRow}>
                              {/* Read: Blue if granted, Light deactivated if denied */}
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

                              {/* Write / Approval: Green if granted, Light deactivated if denied */}
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
                                  {m.key === 'device_approval' ? 'Approve' : 'Write'}
                                </Text>
                              </View>

                              {/* Update: Yellow / Amber if granted, Light deactivated if denied */}
                              {m.hasUpdateDelete ? (
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
                              ) : null}

                              {/* Delete: Red if granted, Light deactivated if denied */}
                              {m.hasUpdateDelete ? (
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
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Bottom Footer: Edit Button Icon + Delete Button Icon */}
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

      {/* Create / Edit User Type Modal */}
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
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={styles.modalTitle}>
                  {modalMode === 'create' ? 'Create User Type' : 'Edit User Type'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {modalMode === 'create'
                    ? 'Configure role archetype and module permissions'
                    : 'Update role archetype and module permissions'}
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
                  User Type Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Input
                  placeholder="e.g. Supervisor, Technician, Manager"
                  value={typeName}
                  onChangeText={setTypeName}
                  dark={false}
                  leftIcon={<Shield size={16} color={theme.colors.textMuted} />}
                />
              </View>

              {/* Permissions Header & Bulk Actions */}
              <View style={styles.permMatrixHeader}>
                <Text style={styles.formLabel}>Module Permissions Matrix</Text>
                <View style={styles.bulkActionsRow}>
                  <TouchableOpacity
                    style={styles.bulkBtn}
                    onPress={selectAllPerms}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.bulkBtnText}>Select All</Text>
                  </TouchableOpacity>
                  <Text style={styles.bulkDivider}>•</Text>
                  <TouchableOpacity
                    style={styles.bulkBtn}
                    onPress={clearAllPerms}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.bulkBtnText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Module-by-Module Permission Checkers */}
              <View style={styles.modalPermsList}>
                {PERMISSION_MASTERS.map((m) => {
                  const row = formPerms.find((p) => p.masterName === m.key);
                  const isAll = m.hasUpdateDelete
                    ? Boolean(row?.canRead && row?.canWrite && row?.canUpdate && row?.canDelete)
                    : Boolean(row?.canRead && row?.canWrite);

                  return (
                    <View key={m.key} style={styles.modalPermModuleCard}>
                      <View style={styles.moduleCardHeader}>
                        <Text style={styles.modalModuleName}>{m.label}</Text>
                        <TouchableOpacity
                          style={styles.toggleRowBtn}
                          onPress={() => toggleMasterRow(m.key)}
                          activeOpacity={0.7}
                        >
                          {isAll ? (
                            <CheckSquare size={16} color={theme.colors.primary} />
                          ) : (
                            <Square size={16} color={theme.colors.textMuted} />
                          )}
                          <Text style={styles.toggleRowText}>All</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Permission toggle buttons */}
                      <View style={styles.permTogglesRow}>
                        {/* Read */}
                        <TouchableOpacity
                          style={[
                            styles.permToggleBtn,
                            row?.canRead && styles.permToggleBtnActiveRead,
                          ]}
                          onPress={() => toggleModalPerm(m.key, 'canRead')}
                          activeOpacity={0.7}
                        >
                          {row?.canRead ? (
                            <Check size={12} color="#FFFFFF" strokeWidth={2.4} />
                          ) : null}
                          <Text
                            style={[
                              styles.permToggleText,
                              row?.canRead && styles.permToggleTextActive,
                            ]}
                          >
                            Read
                          </Text>
                        </TouchableOpacity>

                        {/* Write / Approval */}
                        <TouchableOpacity
                          style={[
                            styles.permToggleBtn,
                            row?.canWrite && styles.permToggleBtnActiveWrite,
                          ]}
                          onPress={() => toggleModalPerm(m.key, 'canWrite')}
                          activeOpacity={0.7}
                        >
                          {row?.canWrite ? (
                            <Check size={12} color="#FFFFFF" strokeWidth={2.4} />
                          ) : null}
                          <Text
                            style={[
                              styles.permToggleText,
                              row?.canWrite && styles.permToggleTextActive,
                            ]}
                          >
                            {m.key === 'device_approval' ? 'Approval' : 'Write'}
                          </Text>
                        </TouchableOpacity>

                        {/* Update */}
                        {m.hasUpdateDelete ? (
                          <TouchableOpacity
                            style={[
                              styles.permToggleBtn,
                              row?.canUpdate && styles.permToggleBtnActiveUpdate,
                            ]}
                            onPress={() => toggleModalPerm(m.key, 'canUpdate')}
                            activeOpacity={0.7}
                          >
                            {row?.canUpdate ? (
                              <Check size={12} color="#FFFFFF" strokeWidth={2.4} />
                            ) : null}
                            <Text
                              style={[
                                styles.permToggleText,
                                row?.canUpdate && styles.permToggleTextActive,
                              ]}
                            >
                              Update
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                        {/* Delete */}
                        {m.hasUpdateDelete ? (
                          <TouchableOpacity
                            style={[
                              styles.permToggleBtn,
                              row?.canDelete && styles.permToggleBtnActiveDelete,
                            ]}
                            onPress={() => toggleModalPerm(m.key, 'canDelete')}
                            activeOpacity={0.7}
                          >
                            {row?.canDelete ? (
                              <Check size={12} color="#FFFFFF" strokeWidth={2.4} />
                            ) : null}
                            <Text
                              style={[
                                styles.permToggleText,
                                row?.canDelete && styles.permToggleTextActive,
                              ]}
                            >
                              Delete
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
              
                <Button
                  title={modalMode === 'create' ? 'Create User Type' : 'Save Changes'}
                  variant="primary"
                  loading={saving}
                  onPress={handleFormSubmit}
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  searchContainer: {
    marginBottom: 12,
  },
  listContent: {
    gap: 12,
    paddingBottom: theme.spacing.xxxl,
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
    gap: 6,
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
  moduleName: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
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
  },
  // Permission color styles matching frontend PERM_COLORS
  // 1. Read (Blue)
  chipActiveRead: {
    backgroundColor: '#F0F7FF',
    borderColor: '#BCDBFF',
  },
  chipTextRead: {
    color: '#0056CF',
  },

  // 2. Write / Approval (Green)
  chipActiveWrite: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  chipTextWrite: {
    color: '#15803D',
  },

  // 3. Update (Yellow / Amber)
  chipActiveUpdate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  chipTextUpdate: {
    color: '#B45309',
  },

  // 4. Delete (Red)
  chipActiveDelete: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  chipTextDelete: {
    color: '#BE123C',
  },

  // Inactive / Deactivated (Light Gray)
  chipInactiveLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
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
    paddingBottom: 20,
    gap: 14,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  requiredStar: {
    color: '#DC2626',
  },
  permMatrixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  bulkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkBtn: {
    paddingVertical: 2,
  },
  bulkBtnText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
  },
  bulkDivider: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  modalPermsList: {
    gap: 10,
  },
  modalPermModuleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 10,
  },
  moduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalModuleName: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  toggleRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleRowText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
  },
  permTogglesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  permToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  permToggleBtnActiveRead: {
    backgroundColor: '#0056CF',
    borderColor: '#0056CF',
  },
  permToggleBtnActiveWrite: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  permToggleBtnActiveUpdate: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  permToggleBtnActiveDelete: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  permToggleText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#64748B',
  },
  permToggleTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 1.5,
  },
});
