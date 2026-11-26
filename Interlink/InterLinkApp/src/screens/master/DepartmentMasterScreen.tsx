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
  Network,
  Search,
  User,
  Users,
  Building2,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  X,
  Power,
  FileText,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Input } from '../../components/common/Input';
import { AppHeader } from '../../components/common/AppHeader';
import {
  fetchDepartments,
  createDepartmentApi,
  updateDepartmentApi,
  deleteDepartmentApi,
  toggleDepartmentStatusApi,
  fetchDepartmentMembers,
  DepartmentItem,
  DepartmentMemberItem,
} from '../../api/masterApi';
import { useAuthStore } from '../../store/authStore';
import { MasterStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MasterStackParamList, 'DepartmentMaster'>;

interface FormData {
  department_name: string;
  head_of_department: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
  } catch {
    return dateStr;
  }
};

export const DepartmentMasterScreen: React.FC<Props> = ({ navigation }) => {
  const { activeCompanyId, user } = useAuthStore();
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Modal State (Create / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedDept, setSelectedDept] = useState<DepartmentItem | null>(null);
  const [formData, setFormData] = useState<FormData>({
    department_name: '',
    head_of_department: '',
    description: '',
    status: 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);

  // Members Modal State
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [membersDept, setMembersDept] = useState<DepartmentItem | null>(null);
  const [membersList, setMembersList] = useState<DepartmentMemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadDepartments = useCallback(async () => {
    try {
      const companyId = activeCompanyId || user?.company_id || null;
      const res = await fetchDepartments(true, companyId);
      if (res.success && Array.isArray(res.data)) {
        setDepartments(res.data);
      } else if (res.success && Array.isArray(res.departments)) {
        setDepartments(res.departments);
      } else if (Array.isArray(res)) {
        setDepartments(res);
      } else {
        setDepartments([]);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCompanyId, user?.company_id]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDepartments();
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('create');
    setSelectedDept(null);
    setFormData({
      department_name: '',
      head_of_department: '',
      description: '',
      status: 'ACTIVE',
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (dept: DepartmentItem) => {
    setModalMode('edit');
    setSelectedDept(dept);
    setFormData({
      department_name: dept.department_name || '',
      head_of_department: dept.head_of_department || '',
      description: dept.description || '',
      status: dept.status || 'ACTIVE',
    });
    setIsFormModalOpen(true);
  };

  // Open Members Modal
  const openMembersModal = async (dept: DepartmentItem) => {
    setMembersDept(dept);
    setIsMembersModalOpen(true);
    setLoadingMembers(true);
    try {
      const res = await fetchDepartmentMembers(dept.id);
      if (res.success && Array.isArray(res.data)) {
        setMembersList(res.data);
      } else if (res.success && Array.isArray((res as any).members)) {
        setMembersList((res as any).members);
      } else {
        setMembersList([]);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
      setMembersList([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Handle Create or Update
  const handleFormSubmit = async () => {
    const trimmedName = formData.department_name.trim();
    if (!trimmedName) {
      Alert.alert('Required Field', 'Department name is required');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const res = await createDepartmentApi({
          department_name: trimmedName,
          head_of_department: formData.head_of_department.trim() || null,
          description: formData.description.trim() || null,
          status: formData.status,
          company_id: activeCompanyId ? Number(activeCompanyId) : (user?.company_id || 1),
        });

        if (res.success) {
          Alert.alert('Success', 'Department created successfully!');
          setIsFormModalOpen(false);
          await loadDepartments();
        } else {
          Alert.alert('Error', res.message || 'Failed to create department');
        }
      } else if (selectedDept) {
        const res = await updateDepartmentApi(selectedDept.id, {
          department_name: trimmedName,
          head_of_department: formData.head_of_department.trim() || null,
          description: formData.description.trim() || null,
          status: formData.status,
          company_id: selectedDept.company_id,
        });

        if (res.success) {
          Alert.alert('Success', 'Department updated successfully!');
          setIsFormModalOpen(false);
          await loadDepartments();
        } else {
          Alert.alert('Error', res.message || 'Failed to update department');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  // Toggle status (ACTIVE <-> INACTIVE)
  const handleToggleStatus = async (dept: DepartmentItem) => {
    try {
      const res = await toggleDepartmentStatusApi(dept.id, dept.status);
      if (res.success) {
        const nextStatus = dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        setDepartments((prev) =>
          prev.map((d) => (d.id === dept.id ? { ...d, status: nextStatus } : d))
        );
      } else {
        Alert.alert('Error', res.message || 'Failed to toggle status');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to toggle department status');
    }
  };

  // Delete Department
  const handleDeleteDepartment = (dept: DepartmentItem) => {
    Alert.alert(
      'Delete Department',
      `Are you sure you want to delete "${dept.department_name}"? Assigned members will have their department cleared to Unassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteDepartmentApi(dept.id);
              if (res.success) {
                setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
              } else {
                Alert.alert('Error', res.message || 'Failed to delete department');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete department');
            }
          },
        },
      ]
    );
  };

  // Filter departments by search query
  const filteredDepartments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        (d.department_name && d.department_name.toLowerCase().includes(q)) ||
        (d.head_of_department && d.head_of_department.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.company_name && d.company_name.toLowerCase().includes(q))
    );
  }, [departments, searchQuery]);

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Reusable Curved AppHeader: Title "Department Master", back arrow, plus button */}
      <AppHeader
        title="Department Master"
        onBackPress={() => navigation.goBack()}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={openCreateModal}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Add new department"
          >
            <Plus size={22} color={theme.colors.textWhite} strokeWidth={2.4} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Search Input Bar */}
        <Input
          placeholder="Search by department, HOD, or description..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={16} color={theme.colors.textMuted} />}
          dark={false}
          containerStyle={styles.searchContainer}
        />

        {/* Department Cards List */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Loading departments...</Text>
          </View>
        ) : filteredDepartments.length === 0 ? (
          <View style={styles.centerBox}>
            <Network size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No departments found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try matching another department name or HOD'
                : 'Tap the + button in the header to create a new department'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDepartments}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
              />
            }
            renderItem={({ item }) => {
              const isActive = item.status === 'ACTIVE';

              return (
                <Card variant="light" dark={false} style={styles.deptCard}>
                  {/* Top Header Row: Icon + Name + Status Badge */}
                  <View style={styles.cardHeader}>
                    <View style={styles.deptMainInfo}>
                      <View style={styles.deptIconBox}>
                        <Network size={20} color="#0D9488" strokeWidth={2.2} />
                      </View>
                      <View style={styles.deptTitleWrap}>
                        <Text style={styles.deptName} numberOfLines={1}>
                          {item.department_name}
                        </Text>
                        {item.company_name ? (
                          <View style={styles.companyRow}>
                            <Building2 size={11} color="#64748B" />
                            <Text style={styles.companyText} numberOfLines={1}>
                              {item.company_name}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Status Badge */}
                    <StatusBadge
                      label={isActive ? 'Active' : 'Inactive'}
                      status={isActive ? 'success' : 'neutral'}
                    />
                  </View>

                  {/* Body Info: HOD & Description */}
                  <View style={styles.cardBody}>
                    {item.head_of_department ? (
                      <View style={styles.infoRow}>
                        <User size={13} color="#0D9488" />
                        <Text style={styles.infoLabel}>HOD:</Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {item.head_of_department}
                        </Text>
                      </View>
                    ) : null}

                    {item.description ? (
                      <View style={styles.infoRow}>
                        <FileText size={13} color="#64748B" />
                        <Text style={styles.descText} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.metaRow}>
                      {/* Member count pill */}
                      <TouchableOpacity
                        style={styles.memberPill}
                        onPress={() => openMembersModal(item)}
                        activeOpacity={0.7}
                      >
                        <Users size={12} color="#0284C7" />
                        <Text style={styles.memberPillText}>
                          {item.member_count ?? 0} {item.member_count === 1 ? 'Member' : 'Members'}
                        </Text>
                      </TouchableOpacity>

                      {/* Date */}
                      {item.created_at ? (
                        <View style={styles.dateWrap}>
                          <Calendar size={11} color="#94A3B8" />
                          <Text style={styles.dateText}>
                            Added {formatDate(item.created_at)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Bottom Footer: Actions (Status Toggle, Edit, Delete) */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={[
                        styles.toggleStatusBtn,
                        isActive ? styles.toggleBtnActive : styles.toggleBtnInactive,
                      ]}
                      onPress={() => handleToggleStatus(item)}
                      activeOpacity={0.7}
                    >
                      <Power
                        size={12}
                        color={isActive ? '#15803D' : '#64748B'}
                        strokeWidth={2.4}
                      />
                      <Text
                        style={[
                          styles.toggleStatusText,
                          isActive ? styles.toggleTextActive : styles.toggleTextInactive,
                        ]}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.footerActionBtns}>
                      {/* Edit Button */}
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openEditModal(item)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Pencil size={15} color={theme.colors.accent} />
                        <Text style={styles.actionBtnText}>Edit</Text>
                      </TouchableOpacity>

                      {/* Delete Button */}
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => handleDeleteDepartment(item)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={15} color="#EF4444" />
                        <Text style={[styles.actionBtnText, styles.deleteBtnText]}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>

      {/* Add / Edit Department Modal */}
      <Modal
        visible={isFormModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFormModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'create' ? 'Add New Department' : 'Edit Department'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsFormModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollBody}
            >
              {/* Department Name */}
              <Text style={styles.fieldLabel}>Department Name *</Text>
              <Input
                placeholder="E.g., Engineering, Human Resources, Finance"
                value={formData.department_name}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, department_name: text }))
                }
                dark={false}
                containerStyle={styles.fieldInput}
              />

              {/* Head of Department (HOD) */}
              <Text style={styles.fieldLabel}>Head of Department (HOD)</Text>
              <Input
                placeholder="E.g., Chief Technology Officer, VP Operations"
                value={formData.head_of_department}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, head_of_department: text }))
                }
                dark={false}
                containerStyle={styles.fieldInput}
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description</Text>
              <Input
                placeholder="Roles, responsibilities, operational scope..."
                value={formData.description}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, description: text }))
                }
                dark={false}
                multiline
                numberOfLines={3}
                containerStyle={styles.fieldInput}
              />

              {/* Status Picker */}
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusPickerRow}>
                {(['ACTIVE', 'INACTIVE'] as const).map((st) => {
                  const isSelected = formData.status === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.statusPickerPill,
                        isSelected && (st === 'ACTIVE' ? styles.statusPillActive : styles.statusPillInactive),
                      ]}
                      onPress={() => setFormData((prev) => ({ ...prev, status: st }))}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusPickerText,
                          isSelected && (st === 'ACTIVE' ? styles.statusTextActive : styles.statusTextInactive),
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsFormModalOpen(false)}
                activeOpacity={0.7}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleFormSubmit}
                activeOpacity={0.8}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {modalMode === 'create' ? 'Create Department' : 'Save Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Department Members Modal */}
      <Modal
        visible={isMembersModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsMembersModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {membersDept?.department_name}
                </Text>
                <Text style={styles.modalSubtitle}>Assigned Team Members</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsMembersModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {loadingMembers ? (
              <View style={styles.membersLoadingBox}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Fetching members...</Text>
              </View>
            ) : membersList.length === 0 ? (
              <View style={styles.membersEmptyBox}>
                <Users size={32} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No members assigned</Text>
                <Text style={styles.emptySubtitle}>
                  Assign users to this department from User Master or Web Portal.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.membersListScroll} showsVerticalScrollIndicator={false}>
                {membersList.map((member) => (
                  <View key={member.id} style={styles.memberItem}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {(member.name || member.username || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name || member.username}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                    <View style={styles.memberRoleBadge}>
                      <Text style={styles.memberRoleText}>
                        {member.role || 'User'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.closeFullBtn}
                onPress={() => setIsMembersModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.xxxl,
    gap: 12,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  deptCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  deptMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  deptIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deptTitleWrap: {
    flex: 1,
  },
  deptName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  companyText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  cardBody: {
    gap: 6,
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  descText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 4,
  },
  memberPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  toggleStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  toggleBtnInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  toggleStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#15803D',
  },
  toggleTextInactive: {
    color: '#64748B',
  },
  footerActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  deleteBtnText: {
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.heavy,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalScrollBody: {
    paddingBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    marginBottom: 4,
  },
  statusPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  statusPickerPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  statusPillActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  statusPillInactive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  statusPickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusTextActive: {
    color: '#16A34A',
  },
  statusTextInactive: {
    color: '#DC2626',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#17365D',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeFullBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  membersLoadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  membersEmptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 6,
  },
  membersListScroll: {
    maxHeight: 280,
    marginVertical: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  memberEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  memberRoleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  memberRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
});
