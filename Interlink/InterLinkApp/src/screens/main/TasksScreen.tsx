import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Clock,
  Calendar,
  RotateCw,
  CircleCheck,
  SquareKanban,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Briefcase,
  Users,
  Layers,
  Building,
  ChevronDown,
  Check,
  X,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import {
  fetchTaskDashboard,
  fetchTasks,
  TaskDashboardData,
  TaskItem,
} from '../../api/taskApi';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { fetchCompanies, switchCompanyApi, CompanyItem } from '../../api/masterApi';

export const TasksScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { activeCompanyId, activeCompany, user, switchCompany: storeSwitchCompany } = useAuthStore();
  const { hasPermission, isAdmin } = usePermissionStore();

  const canReadTasks =
    isAdmin ||
    user?.role === 'admin' ||
    user?.role === 'super admin' ||
    hasPermission('tasks', 'read');

  if (!canReadTasks) {
    return (
      <NoPermissionView
        moduleName="Task Management"
        headerTitle="Tasks"
        onBackPress={() => navigation.goBack()}
      />
    );
  }

  const [dashboardData, setDashboardData] = useState<TaskDashboardData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Active Workspace / Company Selection State
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<number>(
    activeCompanyId || user?.company_id || 1
  );

  // Create Task Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Sync currentCompanyId when activeCompanyId changes externally
  useEffect(() => {
    if (activeCompanyId && activeCompanyId !== currentCompanyId) {
      setCurrentCompanyId(activeCompanyId);
    }
  }, [activeCompanyId]);

  const currentCompanyObj = React.useMemo(() => {
    return (
      companies.find((c) => c.id === currentCompanyId) ||
      user?.companies?.find((c) => c.id === currentCompanyId) ||
      activeCompany ||
      null
    );
  }, [companies, currentCompanyId, user?.companies, activeCompany]);

  useEffect(() => {
    if (route.params?.openCreate) {
      setCreateModalOpen(true);
      navigation.setParams({ openCreate: undefined });
    }
  }, [route.params?.openCreate, navigation]);

  const loadData = useCallback(async (targetCompanyId?: number) => {
    const compId = targetCompanyId || currentCompanyId || activeCompanyId || user?.company_id || 1;
    try {
      const [dashRes, tasksRes, compRes] = await Promise.all([
        fetchTaskDashboard(compId).catch(() => null),
        fetchTasks(undefined, compId).catch(() => null),
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
      if (tasksRes && tasksRes.success && Array.isArray(tasksRes.data)) {
        taskList = tasksRes.data;
      }

      // Intelligent fallback: if current company has 0 tasks and compId !== 1, check company 1
      if (taskList.length === 0 && compId !== 1) {
        const [fallbackDash, fallbackTasks] = await Promise.all([
          fetchTaskDashboard(1).catch(() => null),
          fetchTasks(undefined, 1).catch(() => null),
        ]);
        if (fallbackTasks?.success && Array.isArray(fallbackTasks.data) && fallbackTasks.data.length > 0) {
          setCurrentCompanyId(1);
          await storeSwitchCompany(1).catch(() => null);
          if (fallbackDash?.success && fallbackDash.data) {
            setDashboardData(fallbackDash.data);
          }
          setTasks(fallbackTasks.data);
          return;
        }
      }

      if (dashRes && dashRes.success && dashRes.data) {
        setDashboardData(dashRes.data);
      }
      setTasks(taskList);
    } catch (err) {
      console.error('Failed to load tasks screen data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [currentCompanyId, activeCompanyId, user?.company_id, storeSwitchCompany]);

  useEffect(() => {
    loadData(currentCompanyId);
  }, [loadData, currentCompanyId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(currentCompanyId);
  };

  const handleSelectCompany = async (comp: CompanyItem) => {
    try {
      setCurrentCompanyId(comp.id);
      setIsCompanyModalOpen(false);
      await switchCompanyApi(comp.id).catch(() => null);
      await storeSwitchCompany(comp.id).catch(() => null);
      loadData(comp.id);
    } catch (err) {
      console.error('Failed to switch workspace in tasks screen:', err);
    }
  };

  const metrics = dashboardData?.metrics || {};

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Reusable Curved AppHeader */}
      <AppHeader
        title="Task Management"
        showBack={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
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
        {/* ────────────────────────────────────────────────────────
            1. TOP PART: 4 CARD HORIZONTAL SCROLL
            (Overdue Tasks, Due Today, In Progress, Completed This Week)
        ──────────────────────────────────────────────────────── */}
        <View style={styles.topKpiSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiScrollContent}
          >
            {/* Card 1: Overdue Tasks */}
            <View style={[styles.kpiCard, styles.kpiCardRed]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel} numberOfLines={2}>OVERDUE TASKS</Text>
                <View style={[styles.kpiIconCircle, styles.kpiIconRed]}>
                  <Clock size={16} color="#EF4444" />
                </View>
              </View>
              <Text style={[styles.kpiNumber, styles.kpiNumberRed]}>
                {metrics.overdue_count || 0}
              </Text>
              <Text style={styles.kpiSubtext}>Requires immediate attention</Text>
            </View>

            {/* Card 2: Due Today */}
            <View style={[styles.kpiCard, styles.kpiCardAmber]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel}>DUE TODAY</Text>
                <View style={[styles.kpiIconCircle, styles.kpiIconAmber]}>
                  <Calendar size={16} color="#F59E0B" />
                </View>
              </View>
              <Text style={[styles.kpiNumber, styles.kpiNumberAmber]}>
                {metrics.due_today_count || 0}
              </Text>
              <Text style={styles.kpiSubtext}>Scheduled for delivery</Text>
            </View>

            {/* Card 3: In Progress */}
            <View style={[styles.kpiCard, styles.kpiCardBlue]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel}>IN PROGRESS</Text>
                <View style={[styles.kpiIconCircle, styles.kpiIconBlue]}>
                  <RotateCw size={16} color="#2878C7" />
                </View>
              </View>
              <Text style={[styles.kpiNumber, styles.kpiNumberBlue]}>
                {metrics.in_progress_count || 0}
              </Text>
              <Text style={styles.kpiSubtext}>Actively executing</Text>
            </View>

            {/* Card 4: Completed This Week */}
            <View style={[styles.kpiCard, styles.kpiCardGreen]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel}>COMPLETED THIS WEEK</Text>
                <View style={[styles.kpiIconCircle, styles.kpiIconGreen]}>
                  <CircleCheck size={16} color="#10B981" />
                </View>
              </View>
              <Text style={[styles.kpiNumber, styles.kpiNumberGreen]}>
                {metrics.completed_this_week || 0}
              </Text>
              <Text style={styles.kpiSubtext}>Delivered milestone tasks</Text>
            </View>
          </ScrollView>
        </View>

        {/* ────────────────────────────────────────────────────────
            2. HORIZONTAL CARD: KANBAN, CALENDAR, GANTT (NAVIGATE TO NEW PAGE)
        ──────────────────────────────────────────────────────── */}
        <View style={styles.viewsNavCard}>
          {/* Kanban Option */}
          <TouchableOpacity
            style={styles.viewNavItem}
            onPress={() => navigation.navigate('TaskKanbanScreen')}
            activeOpacity={0.7}
          >
            <View style={[styles.viewNavIconCircle, styles.viewNavIconBlue]}>
              <SquareKanban size={18} color="#2878C7" />
            </View>
            <Text style={styles.viewNavTitle} numberOfLines={1}>Kanban</Text>
          </TouchableOpacity>

          <View style={styles.viewNavDivider} />

          {/* Calendar Option */}
          <TouchableOpacity
            style={styles.viewNavItem}
            onPress={() => navigation.navigate('TaskCalendarScreen')}
            activeOpacity={0.7}
          >
            <View style={[styles.viewNavIconCircle, styles.viewNavIconAmber]}>
              <Calendar size={18} color="#F59E0B" />
            </View>
            <Text style={styles.viewNavTitle} numberOfLines={1}>Calendar</Text>
          </TouchableOpacity>

          <View style={styles.viewNavDivider} />

          {/* Gantt Option */}
          <TouchableOpacity
            style={styles.viewNavItem}
            onPress={() => navigation.navigate('TaskGanttScreen')}
            activeOpacity={0.7}
          >
            <View style={[styles.viewNavIconCircle, styles.viewNavIconPurple]}>
              <SlidersHorizontal size={18} color="#9333EA" />
            </View>
            <Text style={styles.viewNavTitle} numberOfLines={1}>Gantt</Text>
          </TouchableOpacity>
        </View>

        {/* ────────────────────────────────────────────────────────
            3. SECTION NAVIGATION CARDS WITH LEFT BORDER ACCENTS
        ──────────────────────────────────────────────────────── */}
        <View style={styles.sectionCardsGroup}>
          {/* Card 1: Task Management List */}
          <TouchableOpacity
            style={[styles.navActionCard, styles.navCardBlue]}
            onPress={() => navigation.navigate('TaskManagementListScreen')}
            activeOpacity={0.75}
          >
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconCircle, styles.iconCircleBlue]}>
                <Layers size={18} color="#2878C7" strokeWidth={2.2} />
              </View>
              <Text style={styles.navCardTitle}>Task Management List</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Card 2: Project Completion & Time Duration Log */}
          <TouchableOpacity
            style={[styles.navActionCard, styles.navCardGreen]}
            onPress={() => navigation.navigate('ProjectDurationLogScreen')}
            activeOpacity={0.75}
          >
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconCircle, styles.iconCircleGreen]}>
                <Briefcase size={18} color="#10B981" strokeWidth={2.2} />
              </View>
              <Text style={styles.navCardTitle}>
                Project Completion & Time Duration Log
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Card 3: Team Workload & Capacity Heatmap */}
          <TouchableOpacity
            style={[styles.navActionCard, styles.navCardPurple]}
            onPress={() => navigation.navigate('TeamWorkloadScreen')}
            activeOpacity={0.75}
          >
            <View style={styles.navCardLeft}>
              <View style={[styles.navCardIconCircle, styles.iconCirclePurple]}>
                <Users size={18} color="#8B5CF6" strokeWidth={2.2} />
              </View>
              <Text style={styles.navCardTitle}>
                Team Workload & Capacity Heatmap
              </Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Create Task Drawer / Modal */}
      <TaskCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadData}
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
                  Choose which company task dashboard to view
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
    gap: 14,
  },
  topKpiSection: {
    marginHorizontal: -16,
  },
  kpiScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  kpiCard: {
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  kpiCardRed: {
    borderColor: '#FECACA',
  },
  kpiCardAmber: {
    borderColor: '#FDE68A',
  },
  kpiCardBlue: {
    borderColor: '#BFDBFE',
  },
  kpiCardGreen: {
    borderColor: '#BBF7D0',
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
    width:'65%',
  },
  kpiIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconRed: {
    backgroundColor: '#FEF2F2',
  },
  kpiIconAmber: {
    backgroundColor: '#FFFBEB',
  },
  kpiIconBlue: {
    backgroundColor: '#EFF6FF',
  },
  kpiIconGreen: {
    backgroundColor: '#ECFDF5',
  },
  kpiNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiNumberRed: {
    color: '#EF4444',
  },
  kpiNumberAmber: {
    color: '#F59E0B',
  },
  kpiNumberBlue: {
    color: '#2878C7',
  },
  kpiNumberGreen: {
    color: '#10B981',
  },
  kpiSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  viewsNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  viewNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  viewNavIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewNavIconBlue: {
    backgroundColor: '#EFF6FF',
  },
  viewNavIconAmber: {
    backgroundColor: '#FFFBEB',
  },
  viewNavIconPurple: {
    backgroundColor: '#FAF5FF',
  },
  viewNavTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#17212F',
    textAlign: 'center',
  },
  viewNavDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#E2E8F0',
  },
  sectionCardsGroup: {
    gap: 12,
    marginTop: 4,
    paddingBottom: 24,
  },
  navActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  navCardBlue: {
    borderLeftColor: '#2878C7',
  },
  navCardGreen: {
    borderLeftColor: '#10B981',
  },
  navCardPurple: {
    borderLeftColor: '#8B5CF6',
  },
  navCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  navCardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBlue: {
    backgroundColor: '#EFF6FF',
  },
  iconCircleGreen: {
    backgroundColor: '#ECFDF5',
  },
  iconCirclePurple: {
    backgroundColor: '#F5F3FF',
  },
  navCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  mainSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconNavy: {
    backgroundColor: '#17365D',
  },
  sectionIconGreen: {
    backgroundColor: '#ECFDF5',
  },
  sectionIconBlue: {
    backgroundColor: '#EFF6FF',
  },
  mainSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#17212F',
  },
  sectionSubtitleText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  tasksCountPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tasksCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2878C7',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#17212F',
    paddingVertical: 0,
  },
  filterTabsRow: {
    gap: 6,
    paddingBottom: 8,
  },
  statusFilterTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusFilterTabActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  statusFilterTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  statusFilterTabTextActive: {
    color: '#FFFFFF',
  },
  sectionCenterLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  sectionLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  emptyTasksBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTasksText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  tasksListContainer: {
    gap: 8,
    marginTop: 4,
  },
  taskListItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  taskListItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  taskCodeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  codeTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#17365D',
  },
  taskProjectName: {
    fontSize: 10.5,
    color: '#64748B',
    flexShrink: 1,
  },
  taskBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  microBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  microBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  taskListTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17212F',
    lineHeight: 18,
    marginBottom: 6,
  },
  taskListItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10.5,
    color: '#64748B',
  },
  assigneePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assigneeAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  assigneeName: {
    fontSize: 10.5,
    color: '#17212F',
    fontWeight: '500',
    maxWidth: 90,
  },
  projectDurationsSummaryRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
    flexWrap: 'wrap',
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  summaryPillGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  summaryPillGreenText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803D',
  },
  summaryPillBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  summaryPillBlueText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  summaryPillSlate: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  summaryPillSlateText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  durationsListWrap: {
    gap: 10,
    marginTop: 6,
  },
  projectDurationItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 10,
  },
  projDurationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  projCodeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  projNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#17212F',
    flexShrink: 1,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  badgeGreenText: {
    color: '#15803D',
  },
  badgeBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  badgeBlueText: {
    color: '#1D4ED8',
  },
  badgeRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeRedText: {
    color: '#DC2626',
  },
  badgeSlate: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  badgeSlateText: {
    color: '#64748B',
  },
  projProgressBarRow: {
    marginVertical: 4,
  },
  projProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  projProgressLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  projProgressPct: {
    fontSize: 10.5,
    color: '#17212F',
    fontWeight: '700',
  },
  projProgressBarTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  projProgressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  projProgressBarFillCompleted: {
    backgroundColor: '#10B981',
  },
  projProgressBarFillActive: {
    backgroundColor: '#2878C7',
  },
  projDurationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    paddingTop: 6,
    marginTop: 4,
  },
  projDurationFooterCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projDurationFooterColRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projFooterLabel: {
    fontSize: 10.5,
    color: '#64748B',
  },
  projDurationDaysText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#17212F',
  },
  projHoursText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  projHoursEstText: {
    fontSize: 10,
    fontWeight: 'normal',
    color: '#94A3B8',
  },
  workloadListWrap: {
    gap: 10,
    marginTop: 6,
  },
  workloadItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 10,
  },
  workloadUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workloadAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  workloadAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  workloadUserInfo: {
    flex: 1,
  },
  workloadUserName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#17212F',
  },
  workloadUserEmail: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  workloadMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 6,
  },
  workloadMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  workloadMetricNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#17212F',
  },
  workloadMetricLabel: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 1,
  },
  textGreen: {
    color: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailScroll: {
    marginBottom: 14,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 13,
    color: '#5B6573',
    lineHeight: 18,
    marginBottom: 14,
  },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    minWidth: 70,
  },
  infoValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#17212F',
  },
  closeBtn: {
    backgroundColor: '#17365D',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 16,
    paddingBottom: 24,
  },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  createTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
  },
  createScroll: {
    marginBottom: 14,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  requiredStar: {
    color: '#EF4444',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#17212F',
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
  createActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  submitBtn: {
    flex: 1.5,
    backgroundColor: '#17365D',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
