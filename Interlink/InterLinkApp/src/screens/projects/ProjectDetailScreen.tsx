import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import {
  Calendar,
  Clock,
  CheckSquare,
  AlertTriangle,
  Plus,
  Search,
  X,
  FileText,
  Users,
  Flag,
  Paperclip,
  TrendingUp,
  Shield,
  ExternalLink,
  MessageSquare,
  FolderTree,
  FolderPlus,
  ArrowRight,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import {
  fetchProjectById,
  fetchProjectSubprojects,
  fetchProjectRisks,
  fetchProjectWorkload,
  fetchProjectDocuments,
  fetchProjectReport,
  createProjectApi,
  CreateProjectPayload,
  ProjectDetailData,
  ProjectItem,
  ProjectRisk,
  ProjectWorkloadMember,
  ProjectDocument,
  ProjectReportData,
} from '../../api/projectApi';
import {
  fetchTasks,
  TaskItem,
} from '../../api/taskApi';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';
import { RootStackParamList } from '../../navigation/types';

type ProjectDetailRouteProp = RouteProp<RootStackParamList, 'ProjectDetailScreen'>;

type WorkspaceTab =
  | 'overview'
  | 'tasks'
  | 'subprojects'
  | 'gantt'
  | 'milestones_risks'
  | 'workload'
  | 'documents'
  | 'report';

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
  } catch {
    return dateStr;
  }
};

const getStatusBadge = (status?: string) => {
  const s = (status || 'todo').toLowerCase();
  switch (s) {
    case 'done':
    case 'completed':
      return { label: 'Completed', iconSymbol: '●', bg: '#ECFDF5', text: '#10B981', border: '#A7F3D0' };
    case 'in_progress':
      return { label: 'In Progress', iconSymbol: '🔄', bg: '#F0F9FF', text: '#2878C7', border: '#BAE6FD' };
    case 'in_review':
    case 'review':
      return { label: 'In Review', iconSymbol: '🔍', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
    case 'todo':
    case 'to_do':
      return { label: 'To Do', iconSymbol: '○', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    case 'backlog':
      return { label: 'Backlog', iconSymbol: '○', bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' };
    case 'blocked':
      return { label: 'Blocked', iconSymbol: '✋', bg: '#FEF2F2', text: '#EF4444', border: '#FECACA' };
    case 'cancelled':
      return { label: 'Cancelled', iconSymbol: '⊘', bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' };
    case 'active':
      return { label: 'Active', iconSymbol: '●', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
    case 'planning':
      return { label: 'Planning', iconSymbol: '○', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
    case 'on_hold':
      return { label: 'On Hold', iconSymbol: '✋', bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' };
    default:
      return { label: s.replace('_', ' '), iconSymbol: '○', bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
  }
};

const getPriorityBadge = (priority?: string) => {
  const p = (priority || 'medium').toLowerCase();
  switch (p) {
    case 'urgent':
      return { label: 'URGENT', iconSymbol: '⫶', bg: '#FEF2F2', text: '#EF4444', border: '#FECACA' };
    case 'high':
      return { label: 'HIGH', iconSymbol: '↑', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
    case 'medium':
      return { label: 'MEDIUM', iconSymbol: '—', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
    case 'low':
      return { label: 'LOW', iconSymbol: '↓', bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' };
    default:
      return { label: p.toUpperCase(), iconSymbol: '—', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
  }
};

export const ProjectDetailScreen: React.FC = () => {
  const route = useRoute<ProjectDetailRouteProp>();
  const navigation = useNavigation<any>();
  const { projectId, initialTab } = (route.params || {}) as any;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab || 'tasks');
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [subprojects, setSubprojects] = useState<ProjectItem[]>([]);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [workload, setWorkload] = useState<ProjectWorkloadMember[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [report, setReport] = useState<ProjectReportData | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tasks Filter & Search state
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskItem | null>(null);

  // Create Task Drawer / Modal State
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);

  // Create Sub-project Modal State
  const [createSubprojectModalOpen, setCreateSubprojectModalOpen] = useState(false);
  const [subprojectName, setSubprojectName] = useState('');
  const [subprojectDesc, setSubprojectDesc] = useState('');
  const [subprojectPriority, setSubprojectPriority] = useState('high');
  const [subprojectBudget, setSubprojectBudget] = useState('');
  const [subprojectStartDate, setSubprojectStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [subprojectEndDate, setSubprojectEndDate] = useState('');
  const [subprojectSubmitting, setSubprojectSubmitting] = useState(false);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('ProjectsScreen');
    }
  }, [navigation]);

  const loadProjectData = useCallback(async () => {
    try {
      const [projRes, tasksRes] = await Promise.all([
        fetchProjectById(projectId),
        fetchTasks({ project_id: projectId }),
      ]);

      if (projRes.success && projRes.data) {
        setProject(projRes.data);
      }
      if (tasksRes.success && tasksRes.data) {
        setTasks(tasksRes.data);
      }

      // Fetch supplementary tabs asynchronously
      fetchProjectSubprojects(projectId)
        .then((res) => {
          if (res.success && Array.isArray(res.data)) setSubprojects(res.data);
        })
        .catch(() => {});

      fetchProjectRisks(projectId)
        .then((res) => {
          if (res.success && res.data) {
            const list = Array.isArray(res.data) ? res.data : res.data.risks || [];
            setRisks(list);
          }
        })
        .catch(() => {});

      fetchProjectWorkload(projectId)
        .then((res) => {
          if (res.success && res.data) {
            const list = Array.isArray(res.data) ? res.data : (res.data as any).workload || [];
            setWorkload(list);
          }
        })
        .catch(() => {});

      fetchProjectDocuments(projectId)
        .then((res) => {
          if (res.success && Array.isArray(res.data)) setDocuments(res.data);
        })
        .catch(() => {});

      fetchProjectReport(projectId)
        .then((res) => {
          if (res.success && res.data) setReport(res.data);
        })
        .catch(() => {});
    } catch (err) {
      console.log('Error loading project detail:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProjectData();
  }, [loadProjectData]);

  const handleCreateSubproject = async () => {
    if (!subprojectName.trim()) {
      Alert.alert('Validation Error', 'Sub-project name is required.');
      return;
    }

    try {
      setSubprojectSubmitting(true);
      const autoCode = `${project?.code || 'PRJ'}-SUB${subprojects.length + 1}`;
      const payload: CreateProjectPayload = {
        name: subprojectName.trim(),
        code: autoCode,
        description: subprojectDesc.trim(),
        parent_project_id: projectId,
        priority: subprojectPriority,
        start_date: subprojectStartDate || null,
        end_date: subprojectEndDate || null,
        estimated_budget: Number(subprojectBudget) || 0,
        approved_budget: Number(subprojectBudget) || 0,
        is_budget_approved: true,
        owner_id: project?.owner_id || 1,
      };

      const res = await createProjectApi(payload);
      if (res.success) {
        setSubprojectName('');
        setSubprojectDesc('');
        setSubprojectBudget('');
        setSubprojectEndDate('');
        setCreateSubprojectModalOpen(false);
        const refreshed = await fetchProjectSubprojects(projectId);
        if (refreshed.success && Array.isArray(refreshed.data)) {
          setSubprojects(refreshed.data);
        }
      } else {
        Alert.alert('Error', res.message || 'Failed to create sub-project');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create sub-project');
    } finally {
      setSubprojectSubmitting(false);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const matchesTitle = (t.title || '').toLowerCase().includes(q);
        const matchesCode = (t.task_code || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode) return false;
      }
      if (taskStatusFilter !== 'all') {
        const s = (t.status || '').toLowerCase();
        if (taskStatusFilter === 'todo' && s !== 'todo') return false;
        if (taskStatusFilter === 'in_progress' && s !== 'in_progress') return false;
        if (taskStatusFilter === 'review' && s !== 'review') return false;
        if (taskStatusFilter === 'done' && s !== 'done' && s !== 'completed') return false;
      }
      return true;
    });
  }, [tasks, taskSearch, taskStatusFilter]);

  const progress = Math.min(
    Math.max(
      Number(project?.calculatedProgress ?? project?.progress_percentage) || 0,
      0
    ),
    100
  );
  const approvedBudget = Number(project?.approved_budget) || 0;
  const actualCost = Number(project?.actual_cost) || 0;
  const currency = project?.currency || 'USD';
  const isOverBudget = approvedBudget > 0 && actualCost > approvedBudget;
  const startDate = formatDate(project?.start_date);
  const endDate = formatDate(project?.end_date);
  const statusBadge = getStatusBadge(project?.status);
  const priorityBadge = getPriorityBadge(project?.priority);

  const tabsConfig: { id: WorkspaceTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${tasks.length})` },
    {
      id: 'subprojects',
      label: `Sub-projects (${project?.metrics?.subprojects_count || subprojects.length})`,
    },
    { id: 'gantt', label: 'Gantt & Timeline' },
    { id: 'milestones_risks', label: 'Milestones & Risks' },
    { id: 'workload', label: 'Team Workload' },
    {
      id: 'documents',
      label: `Files (${project?.metrics?.total_documents || documents.length})`,
    },
    { id: 'report', label: 'Status Report' },
  ];

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Reusable Curved AppHeader with back button */}
      <AppHeader
        title={project?.name || 'Project Details'}
        showBack={true}
        onBackPress={handleBack}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setCreateTaskModalOpen(true)}
            activeOpacity={0.8}
            accessibilityLabel="Add Task to Project"
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.containerScroll}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#17365D"
          />
        }
      >
        {loading && !project ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#17365D" />
            <Text style={styles.loadingText}>Loading project workspace...</Text>
          </View>
        ) : (
          <>
            {/* ────────────────────────────────────────────────────────
                1. PROJECT SCORECARD & HEADER BANNER
            ──────────────────────────────────────────────────────── */}
            <View style={styles.headerCard}>
              {/* Top Row: Code Badge, Status Badge, Priority Badge, Visibility */}
              <View style={styles.headerBadgeRow}>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>{project?.code || 'PRJ'}</Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: statusBadge.bg,
                      borderColor: statusBadge.border,
                    },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: statusBadge.text }]}>
                    {statusBadge.label}
                  </Text>
                </View>

                <View
                  style={[
                    styles.priorityPill,
                    {
                      backgroundColor: priorityBadge.bg,
                      borderColor: priorityBadge.border,
                    },
                  ]}
                >
                  <Text style={[styles.priorityPillText, { color: priorityBadge.text }]}>
                    {priorityBadge.label}
                  </Text>
                </View>

                {Boolean(project?.visibility) && (
                  <View style={styles.visibilityPill}>
                    <Text style={styles.visibilityPillText}>
                      {project?.visibility}
                    </Text>
                  </View>
                )}
              </View>

              {/* Title & Description */}
              <Text style={styles.projectTitleText}>{project?.name}</Text>
              <Text style={styles.projectDescText}>
                {project?.description || 'No detailed scope charter specified for this initiative.'}
              </Text>

              {/* Stakeholders: Project Lead & Executive Sponsor */}
              <View style={styles.stakeholdersRow}>
                {/* Project Lead */}
                <View style={styles.stakeholderItem}>
                  <View style={[styles.avatarCircle, styles.avatarLead]}>
                    <Text style={styles.avatarInitial}>
                      {project?.owner_name ? project.owner_name[0].toUpperCase() : 'L'}
                    </Text>
                  </View>
                  <View style={styles.stakeholderInfo}>
                    <Text style={styles.stakeholderRole}>PROJECT LEAD</Text>
                    <Text style={styles.stakeholderName} numberOfLines={1}>
                      {project?.owner_name || 'Unassigned'}
                    </Text>
                  </View>
                </View>

                <View style={styles.stakeholderDivider} />

                {/* Executive Sponsor */}
                <View style={styles.stakeholderItem}>
                  <View style={[styles.avatarCircle, styles.avatarSponsor]}>
                    <Text style={styles.avatarInitial}>
                      {project?.sponsor_name ? project.sponsor_name[0].toUpperCase() : 'S'}
                    </Text>
                  </View>
                  <View style={styles.stakeholderInfo}>
                    <Text style={styles.stakeholderRole}>EXECUTIVE SPONSOR</Text>
                    <Text style={styles.stakeholderName} numberOfLines={1}>
                      {project?.sponsor_name || 'None Designated'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 4 Scorecard Metric Boxes */}
              <View style={styles.scorecardGrid}>
                {/* Metric 1: Overall Progress */}
                <View style={styles.scorecardItem}>
                  <View style={styles.scorecardTitleRow}>
                    <Text style={styles.scorecardLabel}>Overall Progress</Text>
                    <Text style={styles.scorecardProgressPct}>{progress}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        progress >= 80
                          ? styles.progressGreen
                          : progress >= 40
                          ? styles.progressBlue
                          : styles.progressAmber,
                        { width: `${progress}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Metric 2: Approved Budget */}
                <View style={styles.scorecardItem}>
                  <Text style={styles.scorecardLabel}>APPROVED BUDGET</Text>
                  <Text style={styles.scorecardMainValue}>
                    {currency} {approvedBudget.toLocaleString()}
                  </Text>
                  <Text
                    style={[
                      styles.scorecardSubValue,
                      isOverBudget && styles.textRed,
                    ]}
                  >
                    Spent: {currency} {actualCost.toLocaleString()}
                  </Text>
                </View>

                {/* Metric 3: Project Timeline */}
                <View style={styles.scorecardItem}>
                  <Text style={styles.scorecardLabel}>PROJECT TIMELINE</Text>
                  <Text style={styles.scorecardMainValue} numberOfLines={1}>
                    {startDate} → {endDate}
                  </Text>
                  <Text style={styles.scorecardSubValue}>
                    Target completion schedule
                  </Text>
                </View>

                {/* Metric 4: Workstream Gates */}
                <View style={styles.scorecardItem}>
                  <Text style={styles.scorecardLabel}>WORKSTREAM GATES</Text>
                  <Text style={styles.scorecardMainValue}>
                    {project?.phases?.length || 0} Phases • {project?.milestones?.length || 0} Milestones
                  </Text>
                  <Text style={styles.scorecardSubValue}>
                    {project?.metrics?.open_risks || 0} monitored risks
                  </Text>
                </View>
              </View>
            </View>

            {/* ────────────────────────────────────────────────────────
                2. HORIZONTAL WORKSPACE TABS BAR
            ──────────────────────────────────────────────────────── */}
            <View style={styles.tabsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScrollContent}
              >
                {tabsConfig.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.tabButton, isActive && styles.tabButtonActive]}
                      onPress={() => setActiveTab(tab.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.tabButtonText,
                          isActive && styles.tabButtonTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ────────────────────────────────────────────────────────
                3. TAB CONTENTS
            ──────────────────────────────────────────────────────── */}

            {/* TAB 1: TASKS (CARD UI AS REQUIRED) */}
            {activeTab === 'tasks' && (
              <View style={styles.tabContentBlock}>
                {/* Tasks Header: Title, Search, Filter Tabs & Add Button */}
                <View style={styles.tasksSectionHeader}>
                  <View style={styles.tasksTitleGroup}>
                    <CheckSquare size={18} color="#17365D" strokeWidth={2.5} />
                    <Text style={styles.tasksSectionTitle}>
                      {project?.code} Tasks ({filteredTasks.length})
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.addTaskPillBtn}
                    onPress={() => setCreateTaskModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.addTaskPillText}>Add Task</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.taskSearchBar}>
                  <Search size={15} color="#94A3B8" />
                  <TextInput
                    style={styles.taskSearchInput}
                    placeholder="Search title or ID..."
                    placeholderTextColor="#94A3B8"
                    value={taskSearch}
                    onChangeText={setTaskSearch}
                  />
                  {taskSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setTaskSearch('')}>
                      <X size={15} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Status Filter Tabs */}
                <View style={styles.taskStatusTabsRow}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'todo', label: 'To Do' },
                    { key: 'in_progress', label: 'In Progress' },
                    { key: 'review', label: 'Review' },
                    { key: 'done', label: 'Completed' },
                  ].map((sf) => {
                    const isSelected = taskStatusFilter === sf.key;
                    return (
                      <TouchableOpacity
                        key={sf.key}
                        style={[
                          styles.taskFilterPill,
                          isSelected && styles.taskFilterPillActive,
                        ]}
                        onPress={() => setTaskStatusFilter(sf.key)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.taskFilterPillText,
                            isSelected && styles.taskFilterPillTextActive,
                          ]}
                        >
                          {sf.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Tasks Cards List */}
                {filteredTasks.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <CheckSquare size={28} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No tasks found</Text>
                    <Text style={styles.emptySubtitle}>
                      {taskSearch
                        ? 'Try adjusting your search criteria.'
                        : 'Create your first task for this project.'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tasksCardsList}>
                    {filteredTasks.map((task) => {
                      const taskPriority = getPriorityBadge(task.priority);
                      const taskStatus = getStatusBadge(task.status);
                      const blockersList =
                        (task as any).blockers || (task as any).active_blockers || [];
                      const isBlocked = Boolean(
                        task.is_blocked || task.status === 'blocked' || blockersList.length > 0
                      );
                      const firstBlocker = blockersList[0];
                      const blockerLabel = firstBlocker
                        ? firstBlocker.pred_code ||
                          firstBlocker.task_code ||
                          firstBlocker.blocking_task_code ||
                          firstBlocker.predecessor_id
                        : task.is_blocked
                        ? 'TSK-1002'
                        : '';

                      const chkTotal = Number(
                        (task as any).checklist_total ?? task.total_checklists ?? 0
                      );
                      const chkCompleted = Number(
                        (task as any).checklist_completed ?? task.completed_checklists ?? 0
                      );
                      const commentCount = Number(task.comment_count ?? 0);
                      const loggedHours = Number(
                        (task as any).actual_hours ?? task.logged_hours ?? 0
                      );
                      const estimatedHours = Number(task.estimated_hours ?? 0);

                      const isOverdue = Boolean(
                        task.due_date &&
                          new Date(task.due_date) < new Date() &&
                          task.status !== 'done' &&
                          task.status !== 'completed'
                      );

                      const assigneesList = task.assignees || [];
                      const visibleAssignees = assigneesList.slice(0, 3);
                      const extraAssignees = assigneesList.length - 3;

                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={styles.taskCard}
                          onPress={() => setSelectedTaskForDetail(task)}
                          activeOpacity={0.75}
                        >
                          {/* Top Row: Code Badge, Blocker Alert, Priority Badge */}
                          <View style={styles.taskCardTopRow}>
                            <View style={styles.taskBadgeCluster}>
                              <View style={styles.taskCodeBadge}>
                                <Text style={styles.taskCodeText}>
                                  {task.task_code ? `#${task.task_code}` : `#TSK-${task.id}`}
                                </Text>
                              </View>

                              {isBlocked && (
                                <View style={styles.blockerAlertBadge}>
                                  <AlertTriangle size={11} color="#EF4444" strokeWidth={2.5} />
                                  <Text style={styles.blockerAlertText}>
                                    Blocked by #{blockerLabel || 'TSK-1002'}
                                  </Text>
                                  {blockersList.length > 1 && (
                                    <View style={styles.blockerExtraBadge}>
                                      <Text style={styles.blockerExtraText}>
                                        +{blockersList.length - 1}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>

                            <View
                              style={[
                                styles.taskPriorityBadge,
                                {
                                  backgroundColor: taskPriority.bg,
                                  borderColor: taskPriority.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.taskPriorityBadgeText,
                                  { color: taskPriority.text },
                                ]}
                              >
                                {taskPriority.iconSymbol} {taskPriority.label}
                              </Text>
                            </View>
                          </View>

                          {/* Task Title */}
                          <Text style={styles.taskItemTitle} numberOfLines={2}>
                            {task.title}
                          </Text>

                          {/* Project Code & Name Subtitle */}
                          <Text style={styles.taskProjectSubtitle} numberOfLines={1}>
                            <Text style={styles.taskProjectCode}>
                              {task.project_code || project?.code}
                            </Text>
                            {'  '}
                            {task.project_name || project?.name}
                          </Text>

                          {/* Middle Attributes: Status & Checklist & Comments & Labels */}
                          <View style={styles.taskCardMiddleRow}>
                            <View
                              style={[
                                styles.taskStatusBadge,
                                {
                                  backgroundColor: taskStatus.bg,
                                  borderColor: taskStatus.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.taskStatusBadgeText,
                                  { color: taskStatus.text },
                                ]}
                              >
                                {taskStatus.iconSymbol}  {taskStatus.label}
                              </Text>
                            </View>

                            {chkTotal > 0 && (
                              <View style={styles.taskChecklistBadge}>
                                <CheckSquare size={11} color="#15803D" />
                                <Text style={styles.taskChecklistText}>
                                  {chkCompleted}/{chkTotal}
                                </Text>
                              </View>
                            )}

                            {commentCount > 0 && (
                              <View style={styles.taskCommentBadge}>
                                <MessageSquare size={11} color="#64748B" />
                                <Text style={styles.taskCommentText}>{commentCount}</Text>
                              </View>
                            )}

                            {task.labels?.map((lbl) => (
                              <View
                                key={lbl.id}
                                style={[
                                  styles.taskLabelChip,
                                  {
                                    backgroundColor: `${lbl.color || '#2878C7'}15`,
                                    borderColor: `${lbl.color || '#2878C7'}40`,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.taskLabelText,
                                    { color: lbl.color || '#2878C7' },
                                  ]}
                                >
                                  #{lbl.name}
                                </Text>
                              </View>
                            ))}
                          </View>

                          {/* Footer Row: Assignee Avatar, Due Date, Logged/Est Hours */}
                          <View style={styles.taskCardFooter}>
                            <View style={styles.taskAssigneeBox}>
                              {visibleAssignees.length > 0 ? (
                                <View style={styles.avatarGroupRow}>
                                  {visibleAssignees.map((a, i) => (
                                    <View
                                      key={i}
                                      style={[
                                        styles.assigneeAvatarCircle,
                                        i > 0 && styles.avatarOverlap,
                                      ]}
                                    >
                                      <Text style={styles.assigneeInitial}>
                                        {(a.name || a.username || 'U')[0].toUpperCase()}
                                      </Text>
                                    </View>
                                  ))}
                                  {extraAssignees > 0 && (
                                    <View
                                      style={[
                                        styles.assigneeAvatarCircle,
                                        styles.avatarExtraCircle,
                                        styles.avatarOverlap,
                                      ]}
                                    >
                                      <Text style={styles.avatarExtraText}>
                                        +{extraAssignees}
                                      </Text>
                                    </View>
                                  )}
                                  <Text style={styles.assigneeName} numberOfLines={1}>
                                    {visibleAssignees[0].name || visibleAssignees[0].username || 'Admin'}
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.avatarGroupRow}>
                                  <View style={styles.assigneeAvatarCircle}>
                                    <Text style={styles.assigneeInitial}>A</Text>
                                  </View>
                                  <Text style={styles.assigneeName}>Admin</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.taskFooterRight}>
                              {Boolean(task.due_date) && (
                                <View style={styles.taskDateBox}>
                                  <Calendar
                                    size={11}
                                    color={isOverdue ? '#DC2626' : '#64748B'}
                                  />
                                  <Text
                                    style={[
                                      styles.taskDateText,
                                      isOverdue && styles.taskDateOverdue,
                                    ]}
                                  >
                                    {formatDate(task.due_date)}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.taskHoursBox}>
                                <Clock size={11} color="#10B981" />
                                <Text style={styles.taskLoggedText}>
                                  {loggedHours.toFixed(2)}h
                                </Text>
                                <Text style={styles.taskEstText}>
                                  {' '}/ {estimatedHours.toFixed(2)}h
                                </Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: OVERVIEW */}
            {activeTab === 'overview' && (
              <View style={styles.tabContentBlock}>
                {/* Strategic Scope Charter */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>
                    Initiative Overview & Scope
                  </Text>
                  <Text style={styles.scopeBodyText}>
                    {project?.description ||
                      'No detailed charter provided. This project establishes key operational milestones, team allocations and task execution.'}
                  </Text>

                  <View style={styles.overviewStatsRow}>
                    <View style={styles.overviewStatItem}>
                      <Text style={styles.overviewStatLabel}>PHASES</Text>
                      <Text style={styles.overviewStatValue}>
                        {project?.phases?.length || 0}
                      </Text>
                    </View>
                    <View style={styles.overviewStatItem}>
                      <Text style={styles.overviewStatLabel}>MILESTONES</Text>
                      <Text style={styles.overviewStatValue}>
                        {project?.milestones?.length || 0}
                      </Text>
                    </View>
                    <View style={styles.overviewStatItem}>
                      <Text style={styles.overviewStatLabel}>TEAM MEMBERS</Text>
                      <Text style={styles.overviewStatValue}>
                        {project?.members?.length || 1}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Project Members List */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>
                    Project Team & Governance ({project?.members?.length || 0})
                  </Text>
                  <View style={styles.membersList}>
                    {project?.members && project.members.length > 0 ? (
                      project.members.map((m) => (
                        <View key={m.id} style={styles.memberRow}>
                          <View style={styles.memberLeft}>
                            <View style={styles.memberAvatar}>
                              <Text style={styles.memberAvatarText}>
                                {m.name ? m.name[0].toUpperCase() : 'U'}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.memberName}>{m.name}</Text>
                              <Text style={styles.memberEmail}>{m.email}</Text>
                            </View>
                          </View>
                          <View style={styles.memberRoleBadge}>
                            <Text style={styles.memberRoleText}>
                              {m.role?.replace('_', ' ') || 'Contributor'}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptySubtext}>
                        No members assigned yet.
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* TAB 3: SUB-PROJECTS */}
            {activeTab === 'subprojects' && (
              <View style={styles.tabContentBlock}>
                {/* Action Bar with "+ New Sub-Project" Button */}
                <View style={styles.subprojectsActionBar}>
                  <View style={styles.subprojectsActionLeft}>
                    <Text style={styles.subprojectsMainTitle}>
                      Sub-Projects & Workstreams
                    </Text>
                    <Text style={styles.subprojectsSubtitle}>
                      Independent child workstreams governed under this project initiative
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.newSubprojectBtn}
                    onPress={() => setCreateSubprojectModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={13} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.newSubprojectBtnText}>+ New Sub-Project</Text>
                  </TouchableOpacity>
                </View>

                {subprojects.length === 0 ? (
                  <View style={styles.emptySubprojectsCard}>
                    <View style={styles.emptySubprojectIconWrap}>
                      <FolderTree size={24} color="#2878C7" />
                    </View>
                    <Text style={styles.emptyTitle}>No Sub-projects Yet</Text>
                    <Text style={styles.emptySubtitle}>
                      Break this project down into independent initiatives with dedicated budgets and teams.
                    </Text>
                    <TouchableOpacity
                      style={styles.createSubprojectBtn}
                      onPress={() => setCreateSubprojectModalOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.createSubprojectBtnText}>Create Sub-project</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.subprojectsList}>
                    {subprojects.map((sub) => {
                      const subStatus = getStatusBadge(sub.status);
                      const subProgress = Math.min(
                        Math.max(
                          Number(sub.progress_percentage ?? (sub as any).calculatedProgress) || 0,
                          0
                        ),
                        100
                      );
                      const leadName =
                        sub.owner_name ||
                        (sub as any).lead_name ||
                        (sub as any).lead ||
                        project?.owner_name ||
                        'Unassigned';

                      return (
                        <TouchableOpacity
                          key={sub.id}
                          style={styles.subprojectCard}
                          onPress={() => navigation.push('ProjectDetailScreen', { projectId: sub.id })}
                          activeOpacity={0.75}
                        >
                          <View style={styles.subprojectTop}>
                            <View style={styles.subprojectCodeBadge}>
                              <Text style={styles.subprojectCodeText}>{sub.code}</Text>
                            </View>
                            <View
                              style={[
                                styles.statusPill,
                                {
                                  backgroundColor: subStatus.bg,
                                  borderColor: subStatus.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusPillText,
                                  { color: subStatus.text },
                                ]}
                              >
                                {subStatus.label}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.subprojectTitle}>{sub.name}</Text>
                          <Text style={styles.subprojectDesc} numberOfLines={2}>
                            {sub.description || 'No description provided.'}
                          </Text>

                          {/* Progress Bar Section (matches frontend 35%) */}
                          <View style={styles.subprojectProgressWrap}>
                            <View style={styles.subprojectProgressRow}>
                              <Text style={styles.subprojectProgressLabel}>Progress</Text>
                              <Text style={styles.subprojectProgressVal}>{subProgress}%</Text>
                            </View>
                            <View style={styles.subprojectProgressBarTrack}>
                              <View
                                style={[
                                  styles.subprojectProgressBarFill,
                                  { width: `${subProgress}%` },
                                ]}
                              />
                            </View>
                          </View>

                          {/* Footer: Lead info & Open Workspace link */}
                          <View style={styles.subprojectFooter}>
                            <Text style={styles.subprojectOwner}>
                              Lead: <Text style={styles.subprojectOwnerBold}>{leadName}</Text>
                            </Text>
                            <View style={styles.subprojectOpenLink}>
                              <Text style={styles.subprojectOpenText}>Open Workspace</Text>
                              <ArrowRight size={12} color="#2878C7" strokeWidth={2.2} />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB 4: GANTT & TIMELINE */}
            {activeTab === 'gantt' && (
              <View style={styles.tabContentBlock}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>
                    Gantt Schedule & Milestones
                  </Text>
                  {tasks.length === 0 ? (
                    <View style={styles.emptyTabInner}>
                      <Clock size={24} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No timeline data</Text>
                    </View>
                  ) : (
                    <View style={styles.ganttList}>
                      {tasks.map((task) => {
                        const isDone = task.status === 'done' || task.status === 'completed';
                        const isInProgress = task.status === 'in_progress';
                        const isBlocked = Boolean(task.is_blocked || task.status === 'blocked');
                        const isCritical = isBlocked || task.priority === 'urgent';

                        // Frontend-matching Gantt progress bar colors (from TaskGanttView.jsx)
                        const barColor = isDone
                          ? '#10B981'
                          : isBlocked || isCritical
                          ? '#EF4444'
                          : isInProgress
                          ? '#2563EB'
                          : '#2878C7';

                        const pct = isDone
                          ? 100
                          : task.checklist_total && Number(task.checklist_total) > 0
                          ? Math.round(
                              (Number(task.checklist_completed || 0) /
                                Number(task.checklist_total)) *
                                100
                            )
                          : isInProgress
                          ? 60
                          : isBlocked
                          ? 35
                          : 20;

                        return (
                          <View key={task.id} style={styles.ganttItemCard}>
                            <View style={styles.ganttItemTop}>
                              <Text style={styles.ganttTaskTitle} numberOfLines={1}>
                                {task.task_code || `#TSK-${task.id}`} {task.title}
                              </Text>
                              <Text style={[styles.ganttPct, { color: barColor }]}>{pct}%</Text>
                            </View>
                            <View style={styles.ganttTrack}>
                              <View
                                style={[
                                  styles.ganttFill,
                                  { width: `${pct}%`, backgroundColor: barColor },
                                ]}
                              />
                            </View>
                            <View style={styles.ganttDateRow}>
                              <Text style={styles.ganttDateText}>
                                Start: {formatDate(task.start_date || task.created_at)}
                              </Text>
                              <Text style={styles.ganttDateText}>
                                Due: {formatDate(task.due_date)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* TAB 5: MILESTONES & RISKS */}
            {activeTab === 'milestones_risks' && (
              <View style={styles.tabContentBlock}>
                {/* Milestones Card */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>
                    Target Milestones ({project?.milestones?.length || 0})
                  </Text>
                  {project?.milestones && project.milestones.length > 0 ? (
                    <View style={styles.milestonesList}>
                      {project.milestones.map((m) => (
                        <View key={m.id} style={styles.milestoneRowItem}>
                          <View style={styles.milestoneIconWrap}>
                            <Flag size={14} color="#D97706" />
                          </View>
                          <View style={styles.milestoneInfo}>
                            <Text style={styles.milestoneName}>{m.name}</Text>
                            <Text style={styles.milestoneDue}>
                              Due: {formatDate(m.due_date)} {m.phase_name ? `• ${m.phase_name}` : ''}
                            </Text>
                          </View>
                          <View style={styles.milestoneStatusPill}>
                            <Text style={styles.milestoneStatusText}>
                              {m.status || 'Pending'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptySubtext}>
                      No milestones recorded for this project.
                    </Text>
                  )}
                </View>

                {/* Risks Card */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>
                    Monitored Risks ({risks.length})
                  </Text>
                  {risks.length > 0 ? (
                    <View style={styles.risksList}>
                      {risks.map((r) => (
                        <View key={r.id} style={styles.riskCard}>
                          <View style={styles.riskHeader}>
                            <View style={styles.riskTitleRow}>
                              <Shield size={14} color="#EF4444" />
                              <Text style={styles.riskTitle}>{r.title}</Text>
                            </View>
                            <View style={styles.riskSeverityBadge}>
                              <Text style={styles.riskSeverityText}>
                                Score: {r.severity_score || 'N/A'}
                              </Text>
                            </View>
                          </View>
                          {Boolean(r.mitigation_strategy) && (
                            <Text style={styles.riskMitigationText}>
                              Mitigation: {r.mitigation_strategy}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptySubtext}>
                      No active risks registered.
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* TAB 6: TEAM WORKLOAD */}
            {activeTab === 'workload' && (() => {
              const overAllocatedCount = workload.filter((w) => {
                const allocPct = w.allocation_percentage ?? 100;
                const weeklyCap = w.weeklyCapacityHours ?? (40 * (allocPct / 100));
                const estHours = Number(w.total_estimated_hours) || 0;
                const utilization = w.utilizationPercentage ?? (weeklyCap > 0 ? Math.round((estHours / weeklyCap) * 100) : 0);
                return w.isOverAllocated ?? (utilization > 100);
              }).length;

              return (
                <View style={styles.tabContentBlock}>
                  <View style={styles.sectionCard}>
                    <View style={styles.workloadSectionHeaderRow}>
                      <Text style={styles.sectionHeading}>
                        Team Workload & Resource Allocation
                      </Text>
                      <Text style={styles.workloadSubheading}>
                        Balance weekly capacity against estimated task hours to prevent team burnout
                      </Text>
                    </View>

                    {overAllocatedCount > 0 && (
                      <View style={styles.overAllocatedBanner}>
                        <AlertTriangle size={15} color="#B91C1C" />
                        <Text style={styles.overAllocatedBannerText}>
                          {overAllocatedCount} Member(s) Over-Allocated (&gt;100% Capacity)
                        </Text>
                      </View>
                    )}

                    {workload.length > 0 ? (
                      <View style={styles.workloadList}>
                        {workload.map((w) => {
                          const estHours = Number(w.total_estimated_hours) || 0;
                          const actualHours = Number(w.total_actual_hours) || 0;
                          const assignedTasks = Number(w.assigned_tasks ?? w.active_tasks_count ?? 0);
                          const allocPct = w.allocation_percentage ?? 100;
                          const weeklyCap = w.weeklyCapacityHours ?? (40 * (allocPct / 100));
                          const utilization = w.utilizationPercentage ?? (weeklyCap > 0 ? Math.round((estHours / weeklyCap) * 100) : 0);
                          const isOver = w.isOverAllocated ?? (utilization > 100);
                          const barWidthPct = Math.min(Math.max(utilization, 0), 100);
                          const barColor = isOver ? '#EF4444' : utilization >= 80 ? '#F59E0B' : '#10B981';

                          return (
                            <View
                              key={w.user_id}
                              style={[
                                styles.workloadCard,
                                isOver && styles.workloadCardOver,
                              ]}
                            >
                              {/* Header: Avatar, Name, Role & Capacity Badge */}
                              <View style={styles.workloadHeader}>
                                <View style={styles.workloadAvatarBox}>
                                  <Text style={styles.workloadAvatarInitial}>
                                    {w.name ? w.name[0].toUpperCase() : 'U'}
                                  </Text>
                                </View>
                                <View style={styles.workloadNameCol}>
                                  <Text style={styles.workloadMemberName}>{w.name}</Text>
                                  <Text style={styles.workloadRoleText}>
                                    {(w.role?.replace('_', ' ') || 'Member')} • {allocPct}% assigned
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.workloadCapacityBadge,
                                    isOver
                                      ? styles.capacityBadgeRed
                                      : utilization >= 80
                                      ? styles.capacityBadgeAmber
                                      : styles.capacityBadgeGreen,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.workloadCapacityBadgeText,
                                      isOver
                                        ? styles.capacityTextRed
                                        : utilization >= 80
                                        ? styles.capacityTextAmber
                                        : styles.capacityTextGreen,
                                    ]}
                                  >
                                    {utilization}% Capacity
                                  </Text>
                                </View>
                              </View>

                              {/* Utilization / Allocation Bar */}
                              <View style={styles.workloadAllocationSection}>
                                <View style={styles.workloadAllocationLabelsRow}>
                                  <Text style={styles.workloadAllocationLabel}>Allocated Hours</Text>
                                  <Text style={styles.workloadAllocationValues}>
                                    <Text style={styles.workloadEstBold}>{estHours}h</Text> / {weeklyCap}h week
                                  </Text>
                                </View>
                                <View style={styles.workloadBarTrack}>
                                  <View
                                    style={[
                                      styles.workloadBarFill,
                                      { width: `${barWidthPct}%`, backgroundColor: barColor },
                                    ]}
                                  />
                                </View>
                              </View>

                              {/* Bottom Metrics: Active Tasks & Actual Spent */}
                              <View style={styles.workloadBottomRow}>
                                <View style={styles.workloadBottomLeft}>
                                  <CheckSquare size={13} color="#94A3B8" />
                                  <Text style={styles.workloadBottomText}>
                                    {assignedTasks} Active Task{assignedTasks === 1 ? '' : 's'}
                                  </Text>
                                </View>
                                <Text style={styles.workloadBottomText}>
                                  Actual Spent: <Text style={styles.workloadActualBold}>{actualHours}h</Text>
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.emptyTabInner}>
                        <Users size={28} color="#94A3B8" />
                        <Text style={styles.emptyTitle}>No team members assigned</Text>
                        <Text style={styles.emptySubtext}>
                          No team members assigned to this project yet.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* TAB 7: FILES / DOCUMENTS */}
            {activeTab === 'documents' && (
              <View style={styles.tabContentBlock}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>
                    Project Files & Attachments ({documents.length})
                  </Text>
                  {documents.length > 0 ? (
                    <View style={styles.docsList}>
                      {documents.map((doc) => (
                        <View key={doc.id} style={styles.docItemRow}>
                          <View style={styles.docIconWrap}>
                            <Paperclip size={15} color="#2878C7" />
                          </View>
                          <View style={styles.docInfoCol}>
                            <Text style={styles.docTitle} numberOfLines={1}>
                              {doc.title || doc.file_name}
                            </Text>
                            <Text style={styles.docSubtext}>
                              {formatDate(doc.created_at)} • {doc.category || 'Attachment'}
                            </Text>
                          </View>
                          <TouchableOpacity style={styles.docActionBtn}>
                            <ExternalLink size={14} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyTabInner}>
                      <FileText size={24} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No files uploaded</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* TAB 8: STATUS REPORT */}
            {activeTab === 'report' && (
              <View style={styles.tabContentBlock}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>
                    Executive Project Status Report
                  </Text>
                  <View style={styles.reportSummaryBox}>
                    <TrendingUp size={18} color="#10B981" />
                    <Text style={styles.reportSummaryText}>
                      {report?.summary ||
                        `Project ${project?.code} is currently ${project?.status} with ${progress}% completion across scheduled milestones.`}
                    </Text>
                  </View>
                  <View style={styles.reportDetailsRow}>
                    <View style={styles.reportDetailCol}>
                      <Text style={styles.reportLabel}>Schedule Variance</Text>
                      <Text style={styles.reportValue}>
                        {report?.schedule_status || 'On Track'}
                      </Text>
                    </View>
                    <View style={styles.reportDetailCol}>
                      <Text style={styles.reportLabel}>Budget Variance</Text>
                      <Text style={styles.reportValue}>
                        {isOverBudget ? 'Over Budget' : 'Within Budget'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ────────────────────────────────────────────────────────
          TASK DETAIL MODAL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(selectedTaskForDetail)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTaskForDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalCard}>
            <View style={styles.detailHeader}>
              <View style={styles.taskCodeBadge}>
                <Text style={styles.taskCodeText}>
                  {selectedTaskForDetail?.task_code || `#TSK-${selectedTaskForDetail?.id}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTaskForDetail(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailTitle}>{selectedTaskForDetail?.title}</Text>
              <Text style={styles.detailDesc}>
                {selectedTaskForDetail?.description || 'No description provided.'}
              </Text>

              <View style={styles.detailGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={styles.detailValue}>
                    {selectedTaskForDetail?.status}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Priority:</Text>
                  <Text style={styles.detailValue}>
                    {selectedTaskForDetail?.priority}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Due Date:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedTaskForDetail?.due_date)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Estimated Hours:</Text>
                  <Text style={styles.detailValue}>
                    {selectedTaskForDetail?.estimated_hours || 0}h
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedTaskForDetail(null)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          CREATE TASK DRAWER / MODAL (FULL ATTRIBUTES MATCHING FRONTEND)
      ──────────────────────────────────────────────────────── */}
      <TaskCreateModal
        isOpen={createTaskModalOpen}
        onClose={() => setCreateTaskModalOpen(false)}
        onCreated={loadProjectData}
        defaultProjectId={projectId ? Number(projectId) : null}
        existingTasks={tasks}
      />

      {/* ────────────────────────────────────────────────────────
          CREATE SUB-PROJECT MODAL (MATCHING WEB FRONTEND)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={createSubprojectModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateSubprojectModalOpen(false)}
      >
        <View style={styles.subprojectModalOverlay}>
          <View style={styles.subprojectModalContent}>
            <View style={styles.subprojectModalHeader}>
              <View style={styles.subprojectModalTitleWrap}>
                <FolderPlus size={18} color="#17365D" strokeWidth={2.2} />
                <Text style={styles.subprojectModalTitle}>Add Sub-Project</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCreateSubprojectModalOpen(false)}
                style={styles.modalCloseIconBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.subprojectModalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name */}
              <View style={styles.subprojectInputGroup}>
                <Text style={styles.subprojectInputLabel}>
                  Sub-project Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.subprojectTextInput}
                  placeholder="e.g. Backend Microservice Workstream"
                  placeholderTextColor="#94A3B8"
                  value={subprojectName}
                  onChangeText={setSubprojectName}
                />
              </View>

              {/* Description */}
              <View style={styles.subprojectInputGroup}>
                <Text style={styles.subprojectInputLabel}>Description</Text>
                <TextInput
                  style={[styles.subprojectTextInput, styles.subprojectTextAreaInput]}
                  placeholder="Workstream objectives and deliverables..."
                  placeholderTextColor="#94A3B8"
                  value={subprojectDesc}
                  onChangeText={setSubprojectDesc}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Budget & Priority Row */}
              <View style={styles.modalTwoColRow}>
                <View style={styles.modalColHalf}>
                  <Text style={styles.subprojectInputLabel}>Allocated Budget ($)</Text>
                  <TextInput
                    style={styles.subprojectTextInput}
                    placeholder="15000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={subprojectBudget}
                    onChangeText={setSubprojectBudget}
                  />
                </View>
                <View style={styles.modalColHalf}>
                  <Text style={styles.subprojectInputLabel}>Priority</Text>
                  <View style={styles.priorityPillsRow}>
                    {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                      const isSel = subprojectPriority === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.subprojectPriorityPill,
                            isSel && styles.subprojectPriorityPillActive,
                          ]}
                          onPress={() => setSubprojectPriority(p)}
                        >
                          <Text
                            style={[
                              styles.subprojectPriorityPillText,
                              isSel && styles.subprojectPriorityPillTextActive,
                            ]}
                          >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Start & End Dates */}
              <View style={styles.modalTwoColRow}>
                <View style={styles.modalColHalf}>
                  <Text style={styles.subprojectInputLabel}>Start Date</Text>
                  <TextInput
                    style={styles.subprojectTextInput}
                    placeholder="2026-11-24"
                    placeholderTextColor="#94A3B8"
                    value={subprojectStartDate}
                    onChangeText={setSubprojectStartDate}
                  />
                </View>
                <View style={styles.modalColHalf}>
                  <Text style={styles.subprojectInputLabel}>End Date</Text>
                  <TextInput
                    style={styles.subprojectTextInput}
                    placeholder="2026-12-24"
                    placeholderTextColor="#94A3B8"
                    value={subprojectEndDate}
                    onChangeText={setSubprojectEndDate}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.subprojectModalActions}>
              <TouchableOpacity
                style={styles.subprojectModalCancelBtn}
                onPress={() => setCreateSubprojectModalOpen(false)}
                disabled={subprojectSubmitting}
              >
                <Text style={styles.subprojectModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subprojectModalSubmitBtn}
                onPress={handleCreateSubproject}
                disabled={subprojectSubmitting}
              >
                {subprojectSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.subprojectModalSubmitText}>Save Sub-project</Text>
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
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerScroll: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  containerContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 14,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },

  /* 1. Header Card */
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  headerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17365D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  visibilityPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  visibilityPillText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  projectTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  projectDescText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  stakeholdersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  stakeholderItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLead: {
    backgroundColor: '#17365D',
  },
  avatarSponsor: {
    backgroundColor: '#7C3AED',
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stakeholderInfo: {
    flex: 1,
  },
  stakeholderRole: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  stakeholderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  stakeholderDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },

  /* Scorecard Grid */
  scorecardGrid: {
    gap: 8,
  },
  scorecardItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 10,
    gap: 3,
  },
  scorecardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scorecardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  scorecardProgressPct: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressGreen: {
    backgroundColor: '#10B981',
  },
  progressBlue: {
    backgroundColor: '#2878C7',
  },
  progressAmber: {
    backgroundColor: '#F59E0B',
  },
  progressMuted: {
    backgroundColor: '#94A3B8',
  },
  scorecardMainValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  scorecardSubValue: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  textRed: {
    color: '#EF4444',
  },

  /* 2. Tabs Bar */
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tabsScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#17365D',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },

  /* 3. Tasks Tab (Card UI) */
  tabContentBlock: {
    gap: 12,
  },
  tasksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tasksTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tasksSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  addTaskPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17365D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addTaskPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  taskSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  taskSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  taskStatusTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  taskFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  taskFilterPillActive: {
    backgroundColor: '#2878C7',
    borderColor: '#2878C7',
  },
  taskFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  taskFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tasksCardsList: {
    gap: 10,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  taskCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskBadgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  taskCodeBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  taskCodeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#17365D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  blockerAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 3,
  },
  blockerAlertText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  blockerExtraBadge: {
    backgroundColor: '#FECACA',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 2,
  },
  blockerExtraText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
  },
  taskPriorityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  taskPriorityBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  taskItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
  },
  taskProjectSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  taskProjectCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17365D',
  },
  taskCardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  taskStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskChecklistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 3,
  },
  taskChecklistText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  taskCommentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  taskCommentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  taskLabelChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  taskLabelText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  taskAssigneeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarOverlap: {
    marginLeft: -6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarExtraCircle: {
    backgroundColor: '#E2E8F0',
  },
  avatarExtraText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#475569',
  },
  assigneeAvatarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigneeInitial: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  assigneeName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    maxWidth: 90,
  },
  taskFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  taskDateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  taskDateOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
  taskHoursBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 3,
  },
  taskLoggedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  taskEstText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  taskHoursText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2878C7',
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTabInner: {
    paddingVertical: 24,
    alignItems: 'center',
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
  emptySubtext: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },

  /* Section Card & Other Tabs */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scopeBodyText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  overviewStatsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  overviewStatItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  overviewStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  overviewStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  membersList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#17365D',
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  memberRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2878C7',
    textTransform: 'capitalize',
  },

  /* Subprojects Action Bar & Content */
  subprojectsActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  subprojectsActionLeft: {
    flex: 1,
    marginRight: 10,
  },
  subprojectsMainTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17212F',
  },
  subprojectsSubtitle: {
    fontSize: 11,
    color: '#5B6573',
    marginTop: 2,
  },
  newSubprojectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#17365D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#17365D',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  newSubprojectBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySubprojectsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  emptySubprojectIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  createSubprojectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 12,
  },
  createSubprojectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subprojectsList: {
    gap: 12,
  },
  subprojectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  subprojectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subprojectCodeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subprojectCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17365D',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  subprojectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17212F',
  },
  subprojectDesc: {
    fontSize: 11.5,
    color: '#5B6573',
    lineHeight: 16,
  },
  subprojectProgressWrap: {
    gap: 4,
    marginVertical: 2,
  },
  subprojectProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subprojectProgressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B6573',
  },
  subprojectProgressVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2878C7',
  },
  subprojectProgressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  subprojectProgressBarFill: {
    height: '100%',
    backgroundColor: '#2878C7',
    borderRadius: 3,
  },
  subprojectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 2,
  },
  subprojectOwner: {
    fontSize: 11,
    color: '#64748B',
  },
  subprojectOwnerBold: {
    fontWeight: '700',
    color: '#17212F',
  },
  subprojectOpenLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subprojectOpenText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2878C7',
  },

  /* Add Sub-project Modal */
  subprojectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  subprojectModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 18,
    paddingBottom: 28,
  },
  subprojectModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subprojectModalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subprojectModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
  },
  modalCloseIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subprojectModalScroll: {
    marginBottom: 14,
  },
  subprojectInputGroup: {
    marginBottom: 12,
  },
  subprojectInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#17212F',
    marginBottom: 6,
  },
  subprojectTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12.5,
    color: '#0F172A',
  },
  subprojectTextAreaInput: {
    height: 65,
    textAlignVertical: 'top',
  },
  modalTwoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modalColHalf: {
    flex: 1,
  },
  priorityPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  subprojectPriorityPill: {
    flex: 1,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  subprojectPriorityPillActive: {
    borderColor: '#17365D',
    backgroundColor: '#17365D',
  },
  subprojectPriorityPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  subprojectPriorityPillTextActive: {
    color: '#FFFFFF',
  },
  subprojectModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  subprojectModalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  subprojectModalCancelText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  subprojectModalSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#17365D',
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subprojectModalSubmitText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Gantt */
  ganttList: {
    gap: 10,
  },
  ganttItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ganttItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ganttTaskTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  ganttPct: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17365D',
  },
  ganttTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  ganttFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  ganttDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ganttDateText: {
    fontSize: 10,
    color: '#64748B',
  },

  /* Milestones & Risks */
  milestonesList: {
    gap: 8,
  },
  milestoneRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    gap: 10,
  },
  milestoneIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  milestoneDue: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  milestoneStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  milestoneStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2878C7',
  },
  risksList: {
    gap: 8,
  },
  riskCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  riskTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  riskSeverityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
  },
  riskSeverityText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  riskMitigationText: {
    fontSize: 11,
    color: '#7F1D1D',
  },

  /* Workload Section */
  workloadSectionHeaderRow: {
    marginBottom: 10,
  },
  workloadSubheading: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  overAllocatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  overAllocatedBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  workloadList: {
    gap: 12,
  },
  workloadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  workloadCardOver: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFDFD',
  },
  workloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workloadAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workloadAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  workloadNameCol: {
    flex: 1,
  },
  workloadMemberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17212F',
  },
  workloadRoleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    textTransform: 'capitalize',
  },
  workloadCapacityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  capacityBadgeRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  capacityBadgeAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  capacityBadgeGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  workloadCapacityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  capacityTextRed: {
    color: '#B91C1C',
  },
  capacityTextAmber: {
    color: '#B45309',
  },
  capacityTextGreen: {
    color: '#047857',
  },
  workloadAllocationSection: {
    gap: 5,
  },
  workloadAllocationLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workloadAllocationLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#5B6573',
  },
  workloadAllocationValues: {
    fontSize: 11,
    color: '#5B6573',
  },
  workloadEstBold: {
    fontWeight: '700',
    color: '#17212F',
  },
  workloadBarTrack: {
    width: '100%',
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  workloadBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  workloadBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  workloadBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  workloadBottomText: {
    fontSize: 11,
    color: '#5B6573',
  },
  workloadActualBold: {
    fontWeight: '700',
    color: '#17212F',
  },

  /* Files */
  docsList: {
    gap: 8,
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    gap: 10,
  },
  docIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfoCol: {
    flex: 1,
  },
  docTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  docSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  docActionBtn: {
    padding: 6,
  },

  /* Status Report */
  reportSummaryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  reportSummaryText: {
    fontSize: 12,
    color: '#065F46',
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  reportDetailsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reportDetailCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  reportLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  reportValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },

  /* Detail Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailModalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  detailGrid: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  closeBtn: {
    backgroundColor: '#17365D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Create Task Modal */
  createModalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  createScroll: {
    maxHeight: 380,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  formTextarea: {
    height: 70,
    textAlignVertical: 'top',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  selectorPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectorPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  selectorPillText: {
    fontSize: 11,
    fontWeight: '700',
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
  createActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#17365D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
