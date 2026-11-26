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
  TextInput,
} from 'react-native';
import {
  FolderKanban,
  Activity,
  ChartPie,
  Search,
  X,
  Plus,
  Lock,
  FolderTree,
  ListChecks,
  ShieldExclamationPoint,
  TriangleExclamationPoint,
  Calendar,
  User,
  ArrowUpDown,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../../constants/theme';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import {
  fetchProjects,
  createProjectApi,
  ProjectItem,
} from '../../api/projectApi';

type SortBy = 'none' | 'status' | 'priority';

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'none', label: 'Default' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
];

const getStatusStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return { bg: '#ECFDF5', text: '#15803D', border: '#BBF7D0', label: 'Active' };
    case 'completed':
      return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', label: 'Completed' };
    case 'planning':
      return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', label: 'Planning' };
    case 'on_hold':
      return { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF', label: 'On Hold' };
    case 'archived':
      return { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0', label: 'Archived' };
    default:
      return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: status || 'Unknown' };
  }
};

const getPriorityStyle = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', label: 'Urgent' };
    case 'high':
      return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', label: 'High' };
    case 'medium':
      return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', label: 'Medium' };
    case 'low':
      return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: 'Low' };
    default:
      return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: priority || 'Medium' };
  }
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
  } catch {
    return dateStr;
  }
};

export const ProjectsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('none');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);

  // Detail Modal
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // Create Project Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (route.params?.openCreate) {
      setCreateModalOpen(true);
      navigation.setParams({ openCreate: undefined });
    }
  }, [route.params?.openCreate, navigation]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [approvedBudget, setApprovedBudget] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const projectsRes = await fetchProjects().catch(() => null);

      if (projectsRes && projectsRes.success) {
        const rawList = Array.isArray(projectsRes.data)
          ? projectsRes.data
          : (projectsRes as unknown as { projects?: ProjectItem[] }).projects || [];
        setProjects(rawList);
      }
    } catch (err) {
      console.error('Failed to load project portfolio:', err);
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

  // Auto-generate project code suggestion when typing name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!code || code.startsWith('PRJ-')) {
      const clean = val.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
      if (clean) {
        setCode(`PRJ-${clean}`);
      }
    }
  };

  // Handle Create Project
  const handleCreateProject = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Project name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const est = Number(estimatedBudget) || 0;
      const app = Number(approvedBudget) || est;
      const res = await createProjectApi({
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        priority,
        visibility,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        currency: 'USD',
        estimated_budget: est,
        approved_budget: app,
        is_budget_approved: app > 0,
      });

      if (res.success) {
        Alert.alert('Success', 'Project created successfully!');
        setCreateModalOpen(false);
        // Reset form
        setName('');
        setCode('');
        setDescription('');
        setPriority('medium');
        setVisibility('public');
        setEstimatedBudget('');
        setApprovedBudget('');
        setStartDate(new Date().toISOString().slice(0, 10));
        setEndDate('');
        // Reload
        loadData();
      } else {
        Alert.alert('Error', res.message || 'Failed to create project.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    let list = [...projects];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.owner_name && p.owner_name.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'status') {
      const statusOrder: Record<string, number> = {
        active: 0,
        planning: 1,
        on_hold: 2,
        completed: 3,
        archived: 4,
      };
      list.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
    } else if (sortBy === 'priority') {
      const priorityOrder: Record<string, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      list.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
    }

    return list;
  }, [projects, search, sortBy]);

  // Render Project Card
  const renderProjectCard = ({ item }: { item: ProjectItem }) => {
    const progress = Math.min(Math.max(Number(item.progress_percentage) || 0, 0), 100);
    const approved = Number(item.approved_budget) || 0;
    const actual = Number(item.actual_cost) || 0;
    const currency = item.currency || '$';
    const isOverBudget = approved > 0 && actual > approved;
    const statusCfg = getStatusStyle(item.status);
    const priorityCfg = getPriorityStyle(item.priority);

    // Progress bar fill color
    const progressColor = progress >= 80 ? '#10B981' : progress >= 40 ? '#2878C7' : '#F59E0B';

    const handleOpenProject = () => {
      navigation.navigate('ProjectDetailScreen', {
        projectId: item.id,
        projectName: item.name,
      });
    };

    return (
      <TouchableOpacity
        style={styles.projectCard}
        activeOpacity={0.8}
        onPress={handleOpenProject}
      >
        {/* Top Header Row */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.codeGroup}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.code || `PRJ-${item.id}`}</Text>
            </View>
            {item.visibility === 'private' && (
              <View style={styles.privateBadge}>
                <Lock size={12} color="#64748B" />
              </View>
            )}
            {Boolean(item.subprojects_count && item.subprojects_count > 0) && (
              <View style={styles.subprojectBadge}>
                <FolderTree size={11} color="#2563EB" />
                <Text style={styles.subprojectText}>{item.subprojects_count}</Text>
              </View>
            )}
          </View>

          <View style={styles.badgesGroup}>
            <View
              style={[
                styles.badge,
                { backgroundColor: priorityCfg.bg, borderColor: priorityCfg.border },
              ]}
            >
              <Text style={[styles.badgeText, { color: priorityCfg.text }]}>
                {priorityCfg.label}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: statusCfg.bg, borderColor: statusCfg.border },
              ]}
            >
              <Text style={[styles.badgeText, { color: statusCfg.text }]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Project Title */}
        <Text style={styles.projectTitle} numberOfLines={1}>
          {item.name}
        </Text>

        {/* Project Description */}
        <Text style={styles.projectDescription} numberOfLines={2}>
          {item.description || 'No description provided.'}
        </Text>

        {/* Project Timeline Date */}
        <View style={styles.timelineRow}>
          <View style={styles.timelineIconBox}>
            <Calendar size={13} color="#2878C7" />
          </View>
          <View style={styles.timelineTextCol}>
            <Text style={styles.timelineLabel}>Project Timeline</Text>
            <Text style={styles.timelineValue}>
              {formatDate(item.start_date)} → {formatDate(item.end_date)}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress}%`, backgroundColor: progressColor },
              ]}
            />
          </View>
        </View>

        {/* Budget Gauge (if approved budget exists) */}
        {approved > 0 && (
          <View style={styles.budgetGauge}>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Budget Spent:</Text>
              <Text style={[styles.budgetValue, isOverBudget && styles.overBudgetText]}>
                {currency} {actual.toLocaleString()} / {currency} {approved.toLocaleString()}
              </Text>
            </View>
            {isOverBudget && (
              <View style={styles.overBudgetAlert}>
                <TriangleExclamationPoint size={12} color="#EF4444" />
                <Text style={styles.overBudgetAlertText}>Over approved budget</Text>
              </View>
            )}
          </View>
        )}

        {/* Card Footer: Lead, Tasks, and Risks */}
        <View style={styles.cardFooter}>
          {/* Owner info */}
          <View style={styles.ownerInfo}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.ownerInitial}>
                {item.owner_name ? item.owner_name[0].toUpperCase() : 'U'}
              </Text>
            </View>
            <Text style={styles.ownerName} numberOfLines={1}>
              {item.owner_name || 'Unassigned'}
            </Text>
          </View>

          {/* Micro metrics */}
          <View style={styles.metricsGroup}>
            <View style={styles.metricItem}>
              <ListChecks size={13} color="#64748B" />
              <Text style={styles.metricText}>
                {item.completed_tasks_count || 0}/{item.tasks_count || 0}
              </Text>
            </View>
            {Boolean(item.open_risks_count && item.open_risks_count > 0) && (
              <View style={styles.riskBadge}>
                <ShieldExclamationPoint size={12} color="#D97706" />
                <Text style={styles.riskText}>{item.open_risks_count}</Text>
              </View>
            )}
          </View>
        </View>

        {/* View More Button */}
        <View style={styles.viewMoreRow}>
          <TouchableOpacity
            style={styles.viewMoreBtn}
            onPress={handleOpenProject}
            activeOpacity={0.8}
          >
            <Text style={styles.viewMoreText}>View More</Text>
            <ChevronRight size={14} color="#17365D" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Curved Reusable AppHeader with Title "Project Management" */}
      <AppHeader
        title="Project Management"
        showBack={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setCreateModalOpen(true)}
            activeOpacity={0.8}
            accessibilityLabel="Create Project"
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Top Controls: Search Bar and Filter/Sort Row */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={16} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search project name or code..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={styles.hitSlop10}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.sortButton, sortBy !== 'none' && styles.sortButtonActive]}
            onPress={() => setIsSortModalOpen(true)}
            activeOpacity={0.7}
          >
            <ArrowUpDown size={14} color={sortBy !== 'none' ? '#2878C7' : '#64748B'} />
            <Text style={[styles.sortButtonText, sortBy !== 'none' && styles.sortButtonTextActive]}>
              {sortBy === 'none'
                ? 'Sort'
                : sortBy === 'status'
                ? 'Status'
                : 'Priority'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Content List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#17365D" />
            <Text style={styles.loadingText}>Loading project portfolio...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProjects}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderProjectCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#17365D']}
                tintColor="#17365D"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <FolderKanban size={36} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No Projects Found</Text>
                <Text style={styles.emptySubtitle}>
                  {search
                    ? 'No initiatives matched your current search.'
                    : "Launch your organization's first initiative with dedicated phases, budget tracking, and milestones."}
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setCreateModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.emptyActionText}>Create First Project</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      {/* Sort Selection Modal */}
      <Modal
        visible={isSortModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSortModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsSortModalOpen(false)}
        >
          <View style={styles.sortModalSheet}>
            <View style={styles.sortModalHeader}>
              <Text style={styles.sortModalTitle}>View By / Sort</Text>
              <TouchableOpacity onPress={() => setIsSortModalOpen(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sortOptionRow,
                  sortBy === opt.key && styles.sortOptionRowSelected,
                ]}
                onPress={() => {
                  setSortBy(opt.key);
                  setIsSortModalOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === opt.key && styles.sortOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {sortBy === opt.key && <Check size={16} color="#2878C7" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Project Details Modal */}
      <Modal
        visible={!!selectedProject}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProject(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalSheet}>
            <View style={styles.detailModalHeader}>
              <View style={styles.detailCodeGroup}>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeText}>{selectedProject?.code}</Text>
                </View>
                <Text style={styles.detailModalTitle} numberOfLines={1}>
                  {selectedProject?.name}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedProject(null)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailModalScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailModalContent}
            >
              {/* Badges Row */}
              <View style={styles.detailBadgesRow}>
                {selectedProject && (
                  <>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: getPriorityStyle(selectedProject.priority).bg,
                          borderColor: getPriorityStyle(selectedProject.priority).border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: getPriorityStyle(selectedProject.priority).text },
                        ]}
                      >
                        Priority: {getPriorityStyle(selectedProject.priority).label}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: getStatusStyle(selectedProject.status).bg,
                          borderColor: getStatusStyle(selectedProject.status).border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: getStatusStyle(selectedProject.status).text },
                        ]}
                      >
                        Status: {getStatusStyle(selectedProject.status).label}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Description */}
              <Text style={styles.detailSectionTitle}>Description</Text>
              <Text style={styles.detailDescription}>
                {selectedProject?.description || 'No description provided.'}
              </Text>

              {/* Timeline & Progress */}
              <Text style={styles.detailSectionTitle}>Timeline & Progress</Text>
              <View style={styles.detailInfoBox}>
                <View style={styles.detailInfoRow}>
                  <Calendar size={14} color="#64748B" />
                  <Text style={styles.detailInfoLabel}>Start Date:</Text>
                  <Text style={styles.detailInfoValue}>
                    {formatDate(selectedProject?.start_date)}
                  </Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Calendar size={14} color="#64748B" />
                  <Text style={styles.detailInfoLabel}>Target Date:</Text>
                  <Text style={styles.detailInfoValue}>
                    {formatDate(selectedProject?.end_date)}
                  </Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Activity size={14} color="#64748B" />
                  <Text style={styles.detailInfoLabel}>Progress:</Text>
                  <Text style={styles.detailInfoValue}>
                    {selectedProject?.progress_percentage || 0}%
                  </Text>
                </View>
              </View>

              {/* Financials */}
              <Text style={styles.detailSectionTitle}>Financials</Text>
              <View style={styles.detailInfoBox}>
                <View style={styles.detailInfoRow}>
                  <ChartPie size={14} color="#64748B" />
                  <Text style={styles.detailInfoLabel}>Approved Budget:</Text>
                  <Text style={styles.detailInfoValue}>
                    ${Number(selectedProject?.approved_budget || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <ChartPie size={14} color="#64748B" />
                  <Text style={styles.detailInfoLabel}>Actual Cost:</Text>
                  <Text style={styles.detailInfoValue}>
                    ${Number(selectedProject?.actual_cost || 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Project Lead */}
              <Text style={styles.detailSectionTitle}>Project Lead</Text>
              <View style={styles.detailInfoBox}>
                <View style={styles.detailInfoRow}>
                  <User size={14} color="#64748B" />
                  <Text style={styles.detailInfoLabel}>Lead:</Text>
                  <Text style={styles.detailInfoValue}>
                    {selectedProject?.owner_name || 'Unassigned'}
                  </Text>
                </View>
                {selectedProject?.owner_email && (
                  <View style={styles.detailInfoRow}>
                    <User size={14} color="#64748B" />
                    <Text style={styles.detailInfoLabel}>Email:</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedProject.owner_email}
                    </Text>
                  </View>
                )}
                {selectedProject?.sponsor_name && (
                  <View style={styles.detailInfoRow}>
                    <User size={14} color="#64748B" />
                    <Text style={styles.detailInfoLabel}>Sponsor:</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedProject.sponsor_name}
                    </Text>
                  </View>
                )}
              </View>

              {/* Metrics */}
              <Text style={styles.detailSectionTitle}>Tasks & Risks</Text>
              <View style={styles.detailMetricsGrid}>
                <View style={styles.detailMetricCard}>
                  <Text style={styles.detailMetricNum}>
                    {selectedProject?.tasks_count || 0}
                  </Text>
                  <Text style={styles.detailMetricLabel}>Total Tasks</Text>
                </View>
                <View style={styles.detailMetricCard}>
                  <Text style={styles.detailMetricNum}>
                    {selectedProject?.completed_tasks_count || 0}
                  </Text>
                  <Text style={styles.detailMetricLabel}>Completed</Text>
                </View>
                <View style={styles.detailMetricCard}>
                  <Text style={styles.detailMetricNum}>
                    {selectedProject?.open_risks_count || 0}
                  </Text>
                  <Text style={styles.detailMetricLabel}>Open Risks</Text>
                </View>
                <View style={styles.detailMetricCard}>
                  <Text style={styles.detailMetricNum}>
                    {selectedProject?.subprojects_count || 0}
                  </Text>
                  <Text style={styles.detailMetricLabel}>Sub-projects</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Project Modal */}
      <Modal
        visible={createModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.createModalSheet}>
            <View style={styles.createModalHeader}>
              <View style={styles.createHeaderIconWrap}>
                <FolderKanban size={18} color="#17365D" />
              </View>
              <Text style={styles.createModalTitle}>Create New Project</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCreateModalOpen(false)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.createModalScroll}
              contentContainerStyle={styles.createModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Project Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Project Name <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. NextGen Web Portal"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={handleNameChange}
                />
              </View>

              {/* Project Code */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Project Code</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. PRJ-NEXT"
                  placeholderTextColor="#94A3B8"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  placeholder="Project goals, deliverable scope, and objectives..."
                  placeholderTextColor="#94A3B8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Priority Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Priority</Text>
                <View style={styles.selectorRow}>
                  {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                    const isSelected = priority === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.selectorPill,
                          isSelected && styles.selectorPillActive,
                        ]}
                        onPress={() => setPriority(p)}
                      >
                        <Text
                          style={[
                            styles.selectorPillText,
                            isSelected && styles.selectorPillTextActive,
                          ]}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Visibility Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Visibility</Text>
                <View style={styles.selectorRow}>
                  {(['public', 'private'] as const).map((v) => {
                    const isSelected = visibility === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[
                          styles.selectorPill,
                          isSelected && styles.selectorPillActive,
                        ]}
                        onPress={() => setVisibility(v)}
                      >
                        <Text
                          style={[
                            styles.selectorPillText,
                            isSelected && styles.selectorPillTextActive,
                          ]}
                        >
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Budget */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.formHalf]}>
                  <Text style={styles.formLabel}>Estimated Budget ($)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 50000"
                    placeholderTextColor="#94A3B8"
                    value={estimatedBudget}
                    onChangeText={setEstimatedBudget}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, styles.formHalf]}>
                  <Text style={styles.formLabel}>Approved Budget ($)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 50000"
                    placeholderTextColor="#94A3B8"
                    value={approvedBudget}
                    onChangeText={setApprovedBudget}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Dates */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, styles.formHalf]}>
                  <Text style={styles.formLabel}>Start Date</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={[styles.formGroup, styles.formHalf]}>
                  <Text style={styles.formLabel}>End Date</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.createModalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateModalOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateProject}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Project</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#17212F',
    paddingVertical: 0,
  },
  hitSlop10: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  sortButtonActive: {
    borderColor: '#2878C7',
    backgroundColor: '#EFF6FF',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  sortButtonTextActive: {
    color: '#2878C7',
  },
  statusFiltersWrapper: {
    paddingVertical: 10,
  },
  statusFiltersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTabActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusTabTextActive: {
    color: '#FFFFFF',
  },
  kpiContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#5B6573',
    letterSpacing: 0.4,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueIconWrap: {
    backgroundColor: '#EFF6FF',
  },
  greenIconWrap: {
    backgroundColor: '#ECFDF5',
  },
  purpleIconWrap: {
    backgroundColor: '#FAF5FF',
  },
  amberIconWrap: {
    backgroundColor: '#FFFBEB',
  },
  kpiNumber: {
    fontSize: 19,
    fontWeight: '800',
    color: '#17212F',
    marginTop: 2,
  },
  kpiSubtext: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  kpiSubtextBold: {
    fontWeight: '700',
    color: '#17212F',
  },
  healthPillRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  microPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  healthGreenPill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  healthGreenText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#15803D',
  },
  healthAmberPill: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  healthAmberText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#B45309',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#17365D',
  },
  privateBadge: {
    padding: 3,
  },
  subprojectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subprojectText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17212F',
    marginBottom: 4,
  },
  projectDescription: {
    fontSize: 12,
    color: '#5B6573',
    lineHeight: 17,
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B6573',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17212F',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetGauge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 11,
    color: '#5B6573',
  },
  budgetValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17212F',
  },
  overBudgetText: {
    color: '#EF4444',
  },
  overBudgetAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  overBudgetAlertText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    gap: 8,
  },
  timelineIconBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineTextCol: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  timelineValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17365D',
  },
  viewMoreRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  viewMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#17365D',
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  ownerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitial: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ownerName: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#17212F',
    flexShrink: 1,
  },
  metricsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  riskText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D97706',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sortModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 32,
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sortModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17212F',
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sortOptionRowSelected: {
    backgroundColor: '#EFF6FF',
  },
  sortOptionText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#17212F',
  },
  sortOptionTextSelected: {
    fontWeight: '700',
    color: '#2878C7',
  },
  detailModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailCodeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  detailModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
    flexShrink: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  detailModalScroll: {
    paddingHorizontal: 16,
  },
  detailModalContent: {
    paddingVertical: 12,
  },
  detailBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B6573',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  detailDescription: {
    fontSize: 13,
    color: '#17212F',
    lineHeight: 18,
    marginBottom: 8,
  },
  detailInfoBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 8,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    minWidth: 90,
  },
  detailInfoValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#17212F',
    flex: 1,
  },
  detailMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  detailMetricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  detailMetricNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17365D',
  },
  detailMetricLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  createModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  createHeaderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  createModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
    flex: 1,
  },
  createModalScroll: {
    paddingHorizontal: 16,
  },
  createModalScrollContent: {
    paddingVertical: 14,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#EF4444',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#17212F',
  },
  formTextarea: {
    height: 72,
    textAlignVertical: 'top',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorPill: {
    flex: 1,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  selectorPillActive: {
    borderColor: '#17365D',
    backgroundColor: '#17365D',
  },
  selectorPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  selectorPillTextActive: {
    color: '#FFFFFF',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formHalf: {
    flex: 1,
  },
  createModalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  submitBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
