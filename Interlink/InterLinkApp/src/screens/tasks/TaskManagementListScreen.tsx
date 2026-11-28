import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Clock,
  Calendar,
  Search,
  X,
  Plus,
  AlertTriangle,
  CheckSquare,
  MessageSquare,
  Building,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { fetchTasks, TaskItem } from '../../api/taskApi';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';
import { useAuthStore } from '../../store/authStore';
import { fetchCompanies, switchCompanyApi, CompanyItem } from '../../api/masterApi';

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'Review' },
  { key: 'done', label: 'Done' },
  { key: 'blocked', label: 'Blocked' },
];

const getStatusStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'done':
    case 'completed':
      return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'Completed' };
    case 'in_progress':
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'In Progress' };
    case 'in_review':
    case 'review':
      return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'Review' };
    case 'blocked':
      return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Blocked' };
    case 'todo':
    case 'backlog':
    default:
      return { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0', label: status || 'To Do' };
  }
};

const getPriorityStyle = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Urgent' };
    case 'high':
      return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'High' };
    case 'medium':
      return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'Medium' };
    default:
      return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: 'Low' };
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

export const TaskManagementListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { activeCompanyId, activeCompany, user, switchCompany: storeSwitchCompany } = useAuthStore();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Active Workspace / Company Selection State
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<number>(
    activeCompanyId || user?.company_id || 1
  );

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

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('TasksScreen');
    }
  }, [navigation]);

  const loadTasksData = useCallback(async (targetCompanyId?: number) => {
    const compId = targetCompanyId || currentCompanyId || activeCompanyId || user?.company_id || 1;
    try {
      setLoading(true);
      const [res, compRes] = await Promise.all([
        fetchTasks(undefined, compId),
        fetchCompanies().catch(() => null),
      ]);

      if (compRes?.success && Array.isArray((compRes as any).companies)) {
        setCompanies((compRes as any).companies);
      } else if (compRes?.success && Array.isArray((compRes as any).data)) {
        setCompanies((compRes as any).data);
      } else if (Array.isArray(compRes)) {
        setCompanies(compRes as any);
      }

      let taskList: TaskItem[] = [];
      if (res.success && Array.isArray(res.data)) {
        taskList = res.data;
      }

      // Intelligent fallback: if current company has 0 tasks and compId !== 1, check company 1
      if (taskList.length === 0 && compId !== 1) {
        const fallbackRes = await fetchTasks(undefined, 1).catch(() => null);
        if (fallbackRes?.success && Array.isArray(fallbackRes.data) && fallbackRes.data.length > 0) {
          setCurrentCompanyId(1);
          await storeSwitchCompany(1).catch(() => null);
          setTasks(fallbackRes.data);
          return;
        }
      }

      setTasks(taskList);
    } catch (err) {
      console.error('Error fetching tasks list:', err);
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentCompanyId, activeCompanyId, user?.company_id, storeSwitchCompany]);

  useEffect(() => {
    loadTasksData(currentCompanyId);
  }, [loadTasksData, currentCompanyId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasksData(currentCompanyId);
  };

  const handleSelectCompany = async (comp: CompanyItem) => {
    try {
      setCurrentCompanyId(comp.id);
      setIsCompanyModalOpen(false);
      await switchCompanyApi(comp.id).catch(() => null);
      await storeSwitchCompany(comp.id).catch(() => null);
      loadTasksData(comp.id);
    } catch (err) {
      console.error('Failed to switch workspace in tasks list:', err);
    }
  };

  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    if (statusFilter !== 'all') {
      list = list.filter((t) => {
        const s = (t.status || 'todo').toLowerCase();
        if (statusFilter === 'todo') return s === 'todo' || s === 'backlog';
        if (statusFilter === 'done') return s === 'done' || s === 'completed';
        return s === statusFilter;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.task_code && t.task_code.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.project_name && t.project_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [tasks, statusFilter, search]);

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      <AppHeader
        title="Task Management List"
        showBack={true}
        onBackPress={handleBack}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setCreateModalOpen(true)}
            activeOpacity={0.8}
            accessibilityLabel="Create Task"
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        }
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

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
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
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks, codes or projects..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter Horizontal Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsRow}
        >
          {STATUS_FILTERS.map((f) => {
            const isSelected = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.statusFilterTab,
                  isSelected && styles.statusFilterTabActive,
                ]}
                onPress={() => setStatusFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusFilterTabText,
                    isSelected && styles.statusFilterTabTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tasks List */}
        {loading && tasks.length === 0 ? (
          <View style={styles.sectionCenterLoading}>
            <ActivityIndicator size="large" color="#17365D" />
            <Text style={styles.sectionLoadingText}>Loading tasks...</Text>
          </View>
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No tasks found</Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? 'Try adjusting your search criteria.'
                : 'No tasks match the selected filter.'}
            </Text>
          </View>
        ) : (
          <View style={styles.tasksListContainer}>
            {filteredTasks.map((task) => {
              const pCfg = getPriorityStyle(task.priority);
              const sCfg = getStatusStyle(task.status);
              const isBlocked = Boolean(
                task.is_blocked || (task.blockers && task.blockers.length > 0)
              );
              const chkTotal = Number(task.checklist_total ?? task.total_checklists ?? 0);
              const chkCompleted = Number(task.checklist_completed ?? task.completed_checklists ?? 0);
              const commentCount = Number(task.comment_count ?? 0);
              const isOverdue = Boolean(
                task.due_date &&
                  new Date(task.due_date) < new Date() &&
                  task.status !== 'done' &&
                  task.status !== 'completed'
              );

              return (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskCard}
                  activeOpacity={0.8}
                  onPress={() => setSelectedTask(task)}
                >
                  {/* Top Row: Code Tag, Blocker Alert, Priority & Status Badges */}
                  <View style={styles.taskTopRow}>
                    <View style={styles.taskBadgeCluster}>
                      <View style={styles.codeTag}>
                        <Text style={styles.codeTagText}>
                          {task.task_code || `#TSK-${task.id}`}
                        </Text>
                      </View>

                      {isBlocked && (
                        <View style={styles.blockerBadge}>
                          <AlertTriangle size={11} color="#EF4444" strokeWidth={2.5} />
                          <Text style={styles.blockerBadgeText}>Blocked</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.taskBadgesRow}>
                      <View
                        style={[
                          styles.microBadge,
                          { backgroundColor: pCfg.bg, borderColor: pCfg.border },
                        ]}
                      >
                        <Text style={[styles.microBadgeText, { color: pCfg.text }]}>
                          {pCfg.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.microBadge,
                          { backgroundColor: sCfg.bg, borderColor: sCfg.border },
                        ]}
                      >
                        <Text style={[styles.microBadgeText, { color: sCfg.text }]}>
                          {sCfg.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Task Title */}
                  <Text style={styles.taskTitle} numberOfLines={2}>
                    {task.title}
                  </Text>

                  {/* Project Subtitle */}
                  {Boolean(task.project_name) && (
                    <Text style={styles.taskProjectSubtitle} numberOfLines={1}>
                      📁 {task.project_name}
                    </Text>
                  )}

                  {/* Checklists & Comments indicators */}
                  {(chkTotal > 0 || commentCount > 0) && (
                    <View style={styles.microIndicatorsRow}>
                      {chkTotal > 0 && (
                        <View style={styles.chkIndicator}>
                          <CheckSquare size={11} color="#15803D" />
                          <Text style={styles.chkIndicatorText}>
                            {chkCompleted}/{chkTotal}
                          </Text>
                        </View>
                      )}
                      {commentCount > 0 && (
                        <View style={styles.commentIndicator}>
                          <MessageSquare size={11} color="#64748B" />
                          <Text style={styles.commentIndicatorText}>
                            {commentCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Footer: Due Date & Assignee */}
                  <View style={styles.taskFooter}>
                    <View style={styles.metaRow}>
                      <Calendar
                        size={11}
                        color={isOverdue ? '#DC2626' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.metaText,
                          isOverdue && styles.metaTextOverdue,
                        ]}
                      >
                        Due: {formatDate(task.due_date)}
                      </Text>
                    </View>

                    <View style={styles.taskFooterRight}>
                      {task.estimated_hours ? (
                        <View style={styles.hoursBox}>
                          <Clock size={11} color="#2878C7" />
                          <Text style={styles.hoursBoxText}>
                            {Number(task.actual_hours || task.logged_hours || 0).toFixed(1)}h / {Number(task.estimated_hours).toFixed(1)}h
                          </Text>
                        </View>
                      ) : null}

                      {task.assignees && task.assignees.length > 0 && (
                        <View style={styles.assigneePill}>
                          <View style={styles.assigneeAvatar}>
                            <Text style={styles.assigneeAvatarText}>
                              {(task.assignees[0].name || 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.assigneeName} numberOfLines={1}>
                            {task.assignees[0].name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Task Detail Modal */}
      <Modal
        visible={Boolean(selectedTask)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={styles.codeTag}>
                <Text style={styles.codeTagText}>
                  {selectedTask?.task_code || `#TSK-${selectedTask?.id}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTask(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailTitle}>{selectedTask?.title}</Text>
              <Text style={styles.detailDesc}>
                {selectedTask?.description || 'No description provided.'}
              </Text>

              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status:</Text>
                  <Text style={styles.infoValue}>
                    {selectedTask?.status?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Priority:</Text>
                  <Text style={styles.infoValue}>
                    {selectedTask?.priority?.toUpperCase()}
                  </Text>
                </View>
                {selectedTask?.project_name && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Project:</Text>
                    <Text style={styles.infoValue}>
                      {selectedTask.project_name}
                    </Text>
                  </View>
                )}
                {selectedTask?.due_date && (
                  <View style={styles.infoRow}>
                    <Calendar size={13} color="#64748B" />
                    <Text style={styles.infoLabel}>Due Date:</Text>
                    <Text style={styles.infoValue}>
                      {formatDate(selectedTask.due_date)}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedTask(null)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Task Modal */}
      <TaskCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadTasksData}
        existingTasks={tasks}
      />

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
                  Choose which company tasks to view and manage
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
                        <Check size={12} color="#1D4ED8" strokeWidth={2.5} />
                        <Text style={styles.activeCheckText}>Active</Text>
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
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenScroll: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  screenScrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  statusFilterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusFilterTabActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  statusFilterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusFilterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionCenterLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  sectionLoadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  tasksListContainer: {
    gap: 10,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#2878C7',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskBadgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17365D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  blockerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 3,
  },
  blockerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  taskBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  microBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  microBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  taskProjectSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  microIndicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 3,
  },
  chkIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  commentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  commentIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metaTextOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
  taskFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hoursBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 3,
  },
  hoursBoxText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2878C7',
  },
  assigneePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  assigneeAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigneeAvatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  assigneeName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    maxWidth: 70,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailScroll: {
    maxHeight: 350,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    width: 60,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  workspaceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 9,
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
    fontSize: 12,
    color: '#475569',
  },
  workspaceBannerHighlight: {
    fontWeight: '700',
    color: '#1D4ED8',
  },
  switchCompanyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    maxHeight: '75%',
    width: '100%',
    paddingBottom: 24,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  dropdownScrollBox: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  companySelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  companySelectOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2878C7',
  },
  companySelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  companyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyIconCircleActive: {
    backgroundColor: '#2878C7',
  },
  companyOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  companyOptionNameActive: {
    color: '#2878C7',
    fontWeight: '700',
  },
  companyOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  activeCheckPill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeCheckText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});
