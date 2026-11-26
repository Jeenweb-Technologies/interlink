import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import {
  FolderKanban,
  PieChart,
  Flag,
  CheckSquare,
  ChevronRight,
  Pin,
  FileText,
  Paperclip,
} from 'lucide-react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { useAuthStore } from '../../store/authStore';
import {
  fetchPortfolioMetrics,
  PortfolioMetricsData,
} from '../../api/projectApi';
import {
  fetchTaskDashboard,
  TaskDashboardData,
} from '../../api/taskApi';
import {
  fetchNotes,
  NoteItem,
} from '../../api/noteApi';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
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

const NOTE_PRIORITIES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  urgent: { label: 'Urgent', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  high: { label: 'High', bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  medium: { label: 'Medium', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  low: { label: 'Low', bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
};

const getInitials = (name?: string) => {
  if (!name) return 'IL';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  const [metrics, setMetrics] = useState<PortfolioMetricsData | null>(null);
  const [taskDashboard, setTaskDashboard] = useState<TaskDashboardData | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [metricsRes, taskDashRes, notesRes] = await Promise.all([
        fetchPortfolioMetrics(),
        fetchTaskDashboard(),
        fetchNotes({ scope: 'my_notes' }),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      }
      if (taskDashRes.success && taskDashRes.data) {
        setTaskDashboard(taskDashRes.data);
      }
      if (notesRes.success) {
        const rawList =
          (notesRes as any).notes ||
          notesRes.data?.notes ||
          (Array.isArray(notesRes.data) ? notesRes.data : []);
        setNotes(Array.isArray(rawList) ? rawList : []);
      }
    } catch (err) {
      console.error('Failed to load portfolio metrics or notes:', err);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const goToProjects = () => {
    navigation.navigate('ProjectsScreen');
  };

  const goToTasks = () => {
    navigation.navigate('TasksScreen');
  };

  const goToNotes = () => {
    navigation.navigate('NotesScratchpadScreen');
  };

  // Extract metrics matching http://localhost:5173/projects
  const summary = metrics?.summary || {};
  const upcomingMilestones = metrics?.upcomingMilestones || [];
  const totalApproved = Number(summary.total_approved_budget) || 0;
  const totalActual = Number(summary.total_actual_cost) || 0;
  const activeProjectsCount = summary.active_projects ?? 0;
  const totalProjectsCount = summary.total_projects ?? 0;

  // Extract task priority distribution matching http://localhost:5173/tasks
  const taskMetrics = taskDashboard?.metrics || {};
  const prioritiesList = taskDashboard?.priorities || [];
  const totalTasks =
    Number(taskMetrics.total) ||
    prioritiesList.reduce((acc, p) => acc + (Number(p.count) || 0), 0);

  const PRIORITY_CONFIG = [
    { key: 'urgent', label: 'Urgent', color: '#EF4444' },
    { key: 'high', label: 'High', color: '#F59E0B' },
    { key: 'medium', label: 'Medium', color: '#38BDF8' },
    { key: 'low', label: 'Low', color: '#94A3B8' },
  ] as const;

  const priorityBreakdown = PRIORITY_CONFIG.map(({ key, label, color }) => {
    const found = prioritiesList.find(
      (p) => (p.priority || '').toLowerCase() === key
    );
    const count = found ? Number(found.count) || 0 : 0;
    const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
    return { key, label, color, count, pct };
  });

  const userName = user?.name ? user.name.split(' ')[0] : 'Alex';

  return (
    <ScreenWrapper
      dark={false}
      statusBarStyle="dark-content"
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* Index 0: Sticky Header Row */}
        <View style={styles.stickyHeaderContainer}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.greetingSubtitle}>{getGreeting()}</Text>
              <Text style={styles.greetingTitle}>Hello, {userName} 👋</Text>
              <Text style={styles.greetingDesc}>
                Make today productive and achieve your goals.
              </Text>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarInitialsText}>
                  {getInitials(user?.name || user?.username)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bodyContent}>
          {/* Top 3 KPI Cards: Active Projects, Total Approved Budget, Upcoming Milestones */}
          <View style={styles.statsRow}>
          {/* Card 1: Active Projects */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={goToProjects}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconCircle, styles.statIconBlue]}>
              <FolderKanban size={17} color="#2878C7" strokeWidth={2.2} />
            </View>
            <Text style={styles.statValue}>{activeProjectsCount}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              Active Projects
            </Text>
            <Text style={styles.statSubtext} numberOfLines={1}>
              {totalProjectsCount} total
            </Text>
          </TouchableOpacity>

          {/* Card 2: Total Approved Budget */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={goToProjects}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconCircle, styles.statIconPurple]}>
              <PieChart size={17} color="#9333EA" strokeWidth={2.2} />
            </View>
            <Text style={styles.statValue}>{totalApproved}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              Approved Budget
            </Text>
            <Text style={styles.statSubtext} numberOfLines={1}>
              Spent: {totalActual}
            </Text>
          </TouchableOpacity>

          {/* Card 3: Upcoming Milestones */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={goToProjects}
            activeOpacity={0.7}
          >
            <View style={[styles.statIconCircle, styles.statIconAmber]}>
              <Flag size={17} color="#D97706" strokeWidth={2.2} />
            </View>
            <Text style={styles.statValue}>{upcomingMilestones.length}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              Milestones
            </Text>
            <Text style={styles.statSubtext} numberOfLines={1}>
              Next 30 days
            </Text>
          </TouchableOpacity>
        </View>

        {/* Featured Card: "Task Management" Theme Linear Gradient Card with Task Priority Distribution */}
        <View style={styles.taskCardContainer}>
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="themeLinearGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#0B1B36" />
                <Stop offset="0.5" stopColor="#17365D" />
                <Stop offset="1" stopColor="#2878C7" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx={24} fill="url(#themeLinearGradient)" />
            {/* Ambient decorative glowing paths */}
            <Path
              d="M 160 0 Q 240 70 380 30 L 380 0 Z"
              fill="rgba(40, 120, 199, 0.22)"
            />
            <Path
              d="M 210 210 Q 290 140 380 170 L 380 210 Z"
              fill="rgba(40, 120, 199, 0.16)"
            />
          </Svg>

          <View style={styles.taskCardInner}>
            {/* Top Row: Pill Tag with CheckSquare icon + "Task management", and Arrow button on right */}
            <View style={styles.taskTopRow}>
              <TouchableOpacity
                style={styles.taskTag}
                onPress={goToTasks}
                activeOpacity={0.8}
              >
                <CheckSquare size={13} color="#93C5FD" strokeWidth={2.4} />
                <Text style={styles.taskTagText}>Task management</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.taskActionBtn}
                onPress={goToTasks}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ChevronRight size={18} color="#17365D" strokeWidth={2.8} />
              </TouchableOpacity>
            </View>

            {/* Header & Subtitle */}
            <TouchableOpacity
              style={styles.taskHeaderBlock}
              onPress={goToTasks}
              activeOpacity={0.85}
            >
              <Text style={styles.taskCardTitle}>Task Priority Distribution</Text>
            </TouchableOpacity>

            {/* Priority Distribution: All 4 priorities */}
            <View style={styles.priorityDistributionList}>
              {priorityBreakdown.map((item) => (
                <View key={item.key} style={styles.priorityRowItem}>
                  <View style={styles.priorityLabelRow}>
                    <View style={styles.priorityLabelLeft}>
                      <View
                        style={[
                          styles.priorityIndicatorDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <Text style={styles.priorityNameText}>{item.label} Priority</Text>
                    </View>
                    <Text style={styles.priorityCountText}>
                      {item.count}{' '}
                      <Text style={styles.priorityPctText}>({item.pct}%)</Text>
                    </Text>
                  </View>

                  <View style={styles.priorityTrack}>
                    <View
                      style={[
                        styles.priorityFill,
                        {
                          width: `${Math.max(item.pct, item.count > 0 ? 6 : 0)}%`,
                          backgroundColor: item.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Section: Notes & Scratchpad (Max 4 vertical rectangle cards) */}
        <View style={styles.notesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notes & Scratchpad</Text>
            <TouchableOpacity
              onPress={goToNotes}
              activeOpacity={0.7}
              style={styles.arrowIconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ChevronRight size={22} color="#17365D" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#2878C7" />
              <Text style={styles.loadingText}>Loading notes & scratchpad...</Text>
            </View>
          ) : notes.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyCard}
              onPress={goToNotes}
              activeOpacity={0.7}
            >
              <FileText size={28} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No notes or scratchpads yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap here to capture your first note or scratchpad idea.
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.notesGrid}>
              {notes.slice(0, 4).map((note) => {
                const plainSnippet = stripHtml(note.content);
                const priorityMeta =
                  NOTE_PRIORITIES[note.priority] || NOTE_PRIORITIES.medium;
                const cardBg =
                  note.color && note.color !== '#FFFFFF' ? note.color : '#FFFFFF';

                return (
                  <TouchableOpacity
                    key={note.id}
                    onPress={goToNotes}
                    activeOpacity={0.8}
                    style={[
                      styles.noteCard,
                      { backgroundColor: cardBg },
                      note.is_pinned && styles.noteCardPinned,
                    ]}
                  >
                    {/* Top Row: Paperclip on top-left, Pin & Priority dot on top-right */}
                    <View style={styles.noteTopRow}>
                      <View style={styles.paperclipWrap}>
                        <Paperclip size={14} color="#64748B" strokeWidth={2.4} />
                      </View>

                      <View style={styles.noteTopRight}>
                        {note.is_pinned && (
                          <Pin size={11} color="#2563EB" fill="#2563EB" />
                        )}
                        <View
                          style={[
                            styles.priorityDot,
                            { backgroundColor: priorityMeta.text },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Middle Content: Title and snippet */}
                    <View style={styles.noteContentBlock}>
                      <Text style={styles.noteCardTitle} numberOfLines={2}>
                        {note.title}
                      </Text>
                      <Text style={styles.noteCardSnippet} numberOfLines={2}>
                        {plainSnippet || 'No additional content...'}
                      </Text>
                    </View>

                    {/* Bottom Row: Date and Checklists */}
                    <View style={styles.noteBottomRow}>
                      <Text style={styles.noteDateText} numberOfLines={1}>
                        {formatDate(note.updated_at || note.created_at)}
                      </Text>
                      {Number(note.total_checklists) > 0 ? (
                        <View style={styles.checklistMiniPill}>
                          <CheckSquare size={10} color="#15803D" />
                          <Text style={styles.checklistMiniText}>
                            {note.completed_checklists || 0}/{note.total_checklists}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  screenScroll: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#F3F6FD',
  },
  stickyHeaderContainer: {
    backgroundColor: '#F3F6FD',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  greetingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  greetingDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '400',
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  avatarInitialsText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(235, 240, 248, 0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statIconBlue: {
    backgroundColor: '#EFF6FF',
  },
  statIconPurple: {
    backgroundColor: '#FAF5FF',
  },
  statIconAmber: {
    backgroundColor: '#FFFBEB',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  statSubtext: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  taskCardContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  taskCardInner: {
    padding: 20,
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  taskTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  taskTagText: {
    fontSize: 12,
    color: '#E0E7FF',
    fontWeight: '700',
  },
  taskActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  taskHeaderBlock: {
    marginBottom: 16,
  },
  taskCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  taskCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.78)',
    marginTop: 3,
    fontWeight: '400',
  },
  priorityDistributionList: {
    gap: 10,
  },
  priorityRowItem: {
    gap: 5,
  },
  priorityLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  priorityIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  priorityCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priorityPctText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  priorityTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  priorityFill: {
    height: '100%',
    borderRadius: 3,
  },
  notesSection: {
    gap: 12,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  arrowIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    lineHeight: 17,
  },
  notesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  noteCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  noteCardPinned: {
    borderColor: '#93C5FD',
    borderWidth: 1.5,
  },
  noteTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paperclipWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  noteContentBlock: {
    flex: 1,
    justifyContent: 'flex-start',
    marginVertical: 4,
  },
  noteCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
    letterSpacing: -0.1,
    lineHeight: 17,
  },
  noteCardSnippet: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  noteBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.7)',
  },
  noteDateText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  checklistMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  checklistMiniText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#15803D',
  },
});
