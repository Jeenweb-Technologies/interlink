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
  Building2,
  Search,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowLeftRight,
  Check,
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
  fetchCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  switchCompanyApi,
  CompanyItem,
} from '../../api/masterApi';
import { useAuthStore } from '../../store/authStore';
import { MasterStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MasterStackParamList, 'CompanyMaster'>;

interface FormData {
  name: string;
  email: string;
  phone: string;
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

export const CompanyMasterScreen: React.FC<Props> = ({ navigation }) => {
  const { activeCompanyId, switchCompany: storeSwitchCompany, user } = useAuthStore();
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const loadCompanies = useCallback(async () => {
    try {
      const res = await fetchCompanies();
      if (res.success && Array.isArray(res.companies)) {
        setCompanies(res.companies);
      } else if (res.success && Array.isArray(res.data)) {
        setCompanies(res.data);
      } else if (Array.isArray(res)) {
        setCompanies(res);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCompanies();
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedCompany(null);
    setFormData({ name: '', email: '', phone: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (comp: CompanyItem) => {
    setModalMode('edit');
    setSelectedCompany(comp);
    setFormData({
      name: comp.name || '',
      email: comp.email || '',
      phone: comp.phone || '',
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required Field', 'Company name is required');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const res = await createCompany({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
        });

        if (res.success) {
          Alert.alert('Success', 'New company added successfully!');
          setIsModalOpen(false);
          await loadCompanies();
        } else {
          Alert.alert('Error', res.message || 'Failed to create company');
        }
      } else if (selectedCompany) {
        const res = await updateCompany(selectedCompany.id, {
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
        });

        if (res.success) {
          Alert.alert('Success', 'Company updated successfully!');
          setIsModalOpen(false);
          await loadCompanies();
        } else {
          Alert.alert('Error', res.message || 'Failed to update company');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchCompany = async (comp: CompanyItem) => {
    try {
      try {
        await switchCompanyApi(comp.id);
      } catch (switchErr) {
        console.warn('Backend active company switch notice:', switchErr);
      }

      await storeSwitchCompany(comp.id);
      Alert.alert('Workspace Switched', `Switched active workspace to "${comp.name}"`);
    } catch {
      Alert.alert('Error', 'Failed to switch company');
    }
  };

  const handleDeletePrompt = (comp: CompanyItem) => {
    Alert.alert(
      'Delete Company?',
      `Are you sure you want to delete "${comp.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteCompany(comp.id);
              if (res.success) {
                Alert.alert('Success', 'Company deleted successfully');
                await loadCompanies();
              } else {
                Alert.alert('Error', res.message || 'Failed to delete company');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete company');
            }
          },
        },
      ]
    );
  };

  // Determine current active company ID
  const effectiveActiveCompanyId =
    activeCompanyId || user?.company_id || (companies[0]?.id ?? null);

  const filteredCompanies = companies.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Curved Reusable AppHeader: Title "Company Master", back arrow, right "+" button */}
      <AppHeader
        title="Company Master"
        onBackPress={() => navigation.goBack()}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={openCreateModal}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Add new company"
          >
            <Plus size={22} color={theme.colors.textWhite} strokeWidth={2.4} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Search Bar */}
        <Input
          placeholder="Search by company name, email, phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Search size={16} color={theme.colors.textMuted} />}
          dark={false}
          containerStyle={styles.searchContainer}
        />

        {/* Company List */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Loading companies...</Text>
          </View>
        ) : filteredCompanies.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyTitle}>No companies found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try matching another name, email, or phone'
                : 'Tap the + button in the header to add a new company'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCompanies}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
            renderItem={({ item }) => {
              const isActive =
                effectiveActiveCompanyId !== null &&
                String(item.id) === String(effectiveActiveCompanyId);

              return (
                <Card variant="light" dark={false} style={styles.companyCard}>
                  {/* Card Header: Icon + Company Name & Code + Active Badge */}
                  <View style={styles.cardHeader}>
                    <View style={styles.companyMainInfo}>
                      <View
                        style={[
                          styles.companyIconBox,
                          isActive && styles.companyIconBoxActive,
                        ]}
                      >
                        <Building2
                          size={20}
                          color={isActive ? theme.colors.textWhite : theme.colors.accent}
                        />
                      </View>
                      <View style={styles.nameBlock}>
                        <View style={styles.nameRow}>
                          <Text style={styles.companyName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                        <Text style={styles.companyCode}>Company Code: #{item.id}</Text>
                      </View>
                    </View>

                    {/* Top Right: Status Badge */}
                    {isActive ? (
                      <StatusBadge label="CURRENT ACTIVE" status="info" dot />
                    ) : (
                      <StatusBadge label="Registered" status="neutral" />
                    )}
                  </View>

                  {/* Sleek Inner Slate Surface: Structured attributes & contact details */}
                  <View style={styles.innerSurface}>
                    <View style={styles.contactDetails}>
                      <View style={styles.contactRow}>
                        <Mail size={13} color={theme.colors.textMuted} />
                        <Text style={styles.contactText} numberOfLines={1}>
                          {item.email || 'Not provided'}
                        </Text>
                      </View>

                      <View style={styles.contactRow}>
                        <Phone size={13} color={theme.colors.textMuted} />
                        <Text style={styles.contactText}>{item.phone || '—'}</Text>
                      </View>

                      {item.address ? (
                        <View style={styles.contactRow}>
                          <MapPin size={13} color={theme.colors.textMuted} />
                          <Text style={styles.contactText} numberOfLines={1}>
                            {item.address}
                          </Text>
                        </View>
                      ) : null}

                      {item.created_at ? (
                        <View style={styles.metaRow}>
                          <Calendar size={12} color={theme.colors.textMuted} />
                          <Text style={styles.metaText}>
                            Created: {formatDate(item.created_at)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Bottom Footer: Set Active Button + Edit & Delete Actions */}
                  <View style={styles.cardFooter}>
                    {/* Left: Switch Active Status */}
                    <View style={styles.statusActionArea}>
                      {!isActive ? (
                        <TouchableOpacity
                          style={styles.setActiveBtn}
                          onPress={() => handleSwitchCompany(item)}
                          activeOpacity={0.7}
                        >
                          <ArrowLeftRight size={12} color="#2563EB" />
                          <Text style={styles.setActiveText}>Set Active</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.activePill}>
                          <Check size={12} color="#059669" strokeWidth={2.5} />
                          <Text style={styles.activePillText}>Active Workspace</Text>
                        </View>
                      )}
                    </View>

                    {/* Right: Edit & Delete Action Buttons */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => openEditModal(item)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Edit company"
                      >
                        <Pencil size={15} color="#475569" strokeWidth={2} />
                      </TouchableOpacity>

                      {companies.length > 1 ? (
                        <TouchableOpacity
                          style={[styles.actionIconBtn, styles.deleteIconBtn]}
                          onPress={() => handleDeletePrompt(item)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Delete company"
                        >
                          <Trash2 size={15} color="#DC2626" strokeWidth={2} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>

      {/* Create / Edit Company Modal */}
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
                  {modalMode === 'create' ? 'Create New Company' : 'Edit Company Details'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {modalMode === 'create'
                    ? 'Fill in the company profile details below.'
                    : 'Update the company information below.'}
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
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Company Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Input
                  placeholder="e.g. Acme Logistics Pvt Ltd"
                  value={formData.name}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                  dark={false}
                  leftIcon={<Building2 size={16} color={theme.colors.textMuted} />}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Official Email Address</Text>
                <Input
                  placeholder="e.g. info@acmelogistics.com"
                  value={formData.email}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, email: val }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  dark={false}
                  leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone / Helpline Number</Text>
                <Input
                  placeholder="e.g. +91 9876543210"
                  value={formData.phone}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
                  keyboardType="phone-pad"
                  dark={false}
                  leftIcon={<Phone size={16} color={theme.colors.textMuted} />}
                />
              </View>

              <View style={styles.modalActions}>
              
                <Button
                  title={modalMode === 'create' ? 'Create Company' : 'Save Changes'}
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

      {/* Create / Edit Company Modal */}
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
                  {modalMode === 'create' ? 'Create New Company' : 'Edit Company Details'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {modalMode === 'create'
                    ? 'Fill in the company profile details below.'
                    : 'Update the company information below.'}
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
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Company Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Input
                  placeholder="e.g. Acme Logistics Pvt Ltd"
                  value={formData.name}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                  dark={false}
                  leftIcon={<Building2 size={16} color={theme.colors.textMuted} />}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Official Email Address</Text>
                <Input
                  placeholder="e.g. info@acmelogistics.com"
                  value={formData.email}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, email: val }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  dark={false}
                  leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone / Helpline Number</Text>
                <Input
                  placeholder="e.g. +91 9876543210"
                  value={formData.phone}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
                  keyboardType="phone-pad"
                  dark={false}
                  leftIcon={<Phone size={16} color={theme.colors.textMuted} />}
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsModalOpen(false)}
                  style={styles.modalCancelBtn}
                />
                <Button
                  title={modalMode === 'create' ? 'Create Company' : 'Save Changes'}
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
  companyCard: {
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
    paddingBottom: 10,
  },
  companyMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  companyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(40, 120, 199, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(40, 120, 199, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  companyIconBoxActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  companyName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  companyCode: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  innerSurface: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginTop: 4,
  },
  contactDetails: {
    gap: 6,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  statusActionArea: {
    flex: 1,
  },
  setActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
  },
  setActiveText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#2563EB',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignSelf: 'flex-start',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#059669',
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
    maxHeight: '85%',
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
