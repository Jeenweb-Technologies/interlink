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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Clock,
  CircleCheck,
  Hourglass,
  Search,
  X,
  Briefcase,
  Calendar,
  Flag,
  Timer,
  LayoutGrid,
  Table as TableIcon,
  ChevronRight,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { fetchTaskDashboard, ProjectDurationItem, TaskDashboardData } from '../../api/taskApi';

export const ProjectDurationLogScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [dashboardData, setDashboardData] = useState<TaskDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Tasks' });
    }
  }, [navigation]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchTaskDashboard();
      if (res.success && res.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Error fetching project durations:', err);
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

  const metrics = dashboardData?.metrics;
  const projectDurations = useMemo(
    () => dashboardData?.project_durations || [],
    [dashboardData?.project_durations]
  );

  const filteredDurations = useMemo(() => {
    if (!search.trim()) return projectDurations;
    const q = search.toLowerCase().trim();
    return projectDurations.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.status && p.status.toLowerCase().includes(q))
    );
  }, [projectDurations, search]);

  const computeProjectMetrics = (proj: ProjectDurationItem) => {
    const isCompleted = proj.status?.toLowerCase() === 'completed';
    const totalTasks = Number(proj.total_tasks) || 0;
    const completedTasks = Number(proj.completed_tasks) || 0;
    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalHours =
      parseFloat(String(proj.total_logged_hours || 0)) ||
      parseFloat(String((proj as any).total_actual_hours || 0)) ||
      0;
    const estHours = parseFloat(String(proj.total_estimated_hours || 0)) || 0;

    let durationDays = '—';
    if (
      proj.actual_completion_duration_days !== null &&
      proj.actual_completion_duration_days !== undefined &&
      proj.actual_completion_duration_days !== ''
    ) {
      durationDays = `${parseFloat(String(proj.actual_completion_duration_days))} Days`;
    } else if (proj.start_date) {
      const startMs = new Date(proj.start_date).getTime();
      const elapsed = Math.max(0, Math.round((Date.now() - startMs) / 86400000));
      durationDays = `${elapsed} Days (ongoing)`;
    }

    const startDateStr = proj.start_date
      ? new Date(proj.start_date).toLocaleDateString()
      : '—';

    let secondDateStr = '';
    if (isCompleted && proj.completed_at) {
      secondDateStr = `Completed: ${new Date(proj.completed_at).toLocaleDateString()}`;
    } else if (proj.end_date) {
      secondDateStr = `Target: ${new Date(proj.end_date).toLocaleDateString()}`;
    } else {
      secondDateStr = 'Target: —';
    }

    return {
      isCompleted,
      totalTasks,
      completedTasks,
      pct,
      totalHours,
      estHours,
      durationDays,
      startDateStr,
      secondDateStr,
    };
  };

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      <AppHeader
        title="Project Duration Log"
        showBack={true}
        onBackPress={handleBack}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

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
        {/* Frontend-Matched Section Banner */}
        <View style={styles.sectionBanner}>
          <View style={styles.bannerHeaderRow}>
            <View style={styles.bannerIconCircle}>
              <Briefcase size={16} color="#10B981" />
            </View>
            <View style={styles.bannerTextGroup}>
              <Text style={styles.bannerTitle}>
                Project Completion & Time Duration Log
              </Text>
              <Text style={styles.bannerSubtitle}>
                Total logged durations, completion cycle times, and task execution hours across projects
              </Text>
            </View>
          </View>
        </View>

        {/* Summary Metric Pills matching frontend */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, styles.summaryPillGreen]}>
            <CircleCheck size={13} color="#047857" />
            <Text style={styles.summaryPillGreenText}>
              {metrics?.completed_projects_count || 0} Completed
            </Text>
          </View>
          <View style={[styles.summaryPill, styles.summaryPillBlue]}>
            <Hourglass size={13} color="#1D4ED8" />
            <Text style={styles.summaryPillBlueText}>
              Avg Duration: {metrics?.avg_project_duration_days || '0.0'} Days
            </Text>
          </View>
          <View style={[styles.summaryPill, styles.summaryPillSlate]}>
            <Clock size={13} color="#334155" />
            <Text style={styles.summaryPillSlateText}>
              {metrics?.total_project_hours_logged || '0.0'}h Logged
            </Text>
          </View>
        </View>

        {/* Search Bar & View Mode Toggle */}
        <View style={styles.controlsRow}>
          <View style={styles.searchBar}>
            <Search size={15} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search projects by code or title..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={styles.hitSlop6}
              >
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.viewToggleGroup}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'cards' ? styles.toggleBtnActive : undefined,
              ]}
              onPress={() => setViewMode('cards')}
              activeOpacity={0.7}
            >
              <LayoutGrid
                size={15}
                color={viewMode === 'cards' ? '#17365D' : '#94A3B8'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'table' ? styles.toggleBtnActive : undefined,
              ]}
              onPress={() => setViewMode('table')}
              activeOpacity={0.7}
            >
              <TableIcon
                size={15}
                color={viewMode === 'table' ? '#17365D' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Durations List or Table */}
        {loading && projectDurations.length === 0 ? (
          <View style={styles.sectionCenterLoading}>
            <ActivityIndicator size="large" color="#17365D" />
            <Text style={styles.sectionLoadingText}>Loading duration logs...</Text>
          </View>
        ) : filteredDurations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Briefcase size={28} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No project durations found</Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? 'Try adjusting your search criteria.'
                : 'No project completion logs recorded.'}
            </Text>
          </View>
        ) : viewMode === 'cards' ? (
          /* Cards View with all frontend details */
          <View style={styles.durationsListContainer}>
            {filteredDurations.map((proj: ProjectDurationItem) => {
              const {
                isCompleted,
                totalTasks,
                completedTasks,
                pct,
                totalHours,
                estHours,
                durationDays,
                startDateStr,
                secondDateStr,
              } = computeProjectMetrics(proj);

              return (
                <TouchableOpacity
                  key={proj.id}
                  style={[
                    styles.projectCard,
                    isCompleted
                      ? styles.projectCardCompleted
                      : styles.projectCardActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('ProjectDetailScreen', {
                      projectId: proj.id,
                      projectName: proj.name,
                    })
                  }
                >
                  {/* Top: Code, Title, Status */}
                  <View style={styles.projDurationTop}>
                    <View style={styles.projCodeGroup}>
                      <View style={styles.codeTag}>
                        <Text style={styles.codeTagText}>{proj.code}</Text>
                      </View>
                      <Text style={styles.projNameText} numberOfLines={1}>
                        {proj.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.microBadge,
                        isCompleted ? styles.badgeGreen : styles.badgeBlue,
                      ]}
                    >
                      <Text
                        style={[
                          styles.microBadgeText,
                          isCompleted ? styles.badgeGreenText : styles.badgeBlueText,
                        ]}
                      >
                        {proj.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Tasks Done & Progress Bar */}
                  <View style={styles.projProgressBarRow}>
                    <View style={styles.projProgressLabelRow}>
                      <Text style={styles.projProgressLabel}>
                        Tasks Done: {completedTasks}/{totalTasks}
                      </Text>
                      <Text style={styles.projProgressPct}>{pct}%</Text>
                    </View>
                    <View style={styles.projProgressBarTrack}>
                      <View
                        style={[
                          styles.projProgressBarFill,
                          pct === 100
                            ? styles.projProgressBarFillCompleted
                            : styles.projProgressBarFillActive,
                          { width: `${pct}%` },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Timeline Dates matching frontend */}
                  <View style={styles.timelineDatesRow}>
                    <Calendar size={13} color="#64748B" />
                    <View style={styles.timelineDatesTextGroup}>
                      <Text style={styles.timelineDateStart}>
                        Start: {startDateStr}
                      </Text>
                      <Text style={styles.timelineDateSecond}>
                        {secondDateStr}
                      </Text>
                    </View>
                  </View>

                  {/* Duration & Logged Time Box */}
                  <View style={styles.metricsBox}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemLabel}>
                        Completion Duration:
                      </Text>
                      <View style={styles.metricItemValueRow}>
                        {isCompleted ? (
                          <Flag size={12} color="#10B981" />
                        ) : (
                          <Timer size={12} color="#64748B" />
                        )}
                        <Text
                          style={[
                            styles.durationDaysText,
                            isCompleted
                              ? styles.durationDaysCompleted
                              : styles.durationDaysOngoing,
                          ]}
                        >
                          {durationDays}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metricDivider} />

                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemLabel}>
                        Total Time Logged:
                      </Text>
                      <View style={styles.metricItemValueRow}>
                        <Clock size={12} color="#10B981" />
                        <Text style={styles.totalHoursText}>
                          {totalHours.toFixed(2)}h{' '}
                          <Text style={styles.estHoursText}>
                            / {estHours.toFixed(2)}h est
                          </Text>
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Tap detail link */}
                  <View style={styles.cardFooterLink}>
                    <Text style={styles.cardFooterLinkText}>
                      View Project Details
                    </Text>
                    <ChevronRight size={13} color="#2563EB" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Table View 1:1 matching frontend 6-column layout */
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.tableCard}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.colProject]}>
                  PROJECT
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colStatus]}>
                  STATUS
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colTasks]}>
                  TASKS DONE
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colTimeline]}>
                  TIMELINE DATES
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colDuration]}>
                  COMPLETION DURATION
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colHours]}>
                  TOTAL TIME LOGGED
                </Text>
              </View>

              {/* Table Body */}
              {filteredDurations.map((proj: ProjectDurationItem, idx: number) => {
                const {
                  isCompleted,
                  totalTasks,
                  completedTasks,
                  pct,
                  totalHours,
                  estHours,
                  durationDays,
                  startDateStr,
                  secondDateStr,
                } = computeProjectMetrics(proj);

                return (
                  <TouchableOpacity
                    key={proj.id}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 ? styles.tableRowAlt : undefined,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('ProjectDetailScreen', {
                        projectId: proj.id,
                        projectName: proj.name,
                      })
                    }
                  >
                    {/* Column 1: Project */}
                    <View style={[styles.tableCell, styles.colProject]}>
                      <View style={styles.tableCodeBadge}>
                        <Text style={styles.tableCodeText}>{proj.code}</Text>
                      </View>
                      <Text style={styles.tableProjName} numberOfLines={1}>
                        {proj.name}
                      </Text>
                    </View>

                    {/* Column 2: Status */}
                    <View style={[styles.tableCell, styles.colStatus]}>
                      <View
                        style={[
                          styles.microBadge,
                          isCompleted ? styles.badgeGreen : styles.badgeBlue,
                        ]}
                      >
                        <Text
                          style={[
                            styles.microBadgeText,
                            isCompleted
                              ? styles.badgeGreenText
                              : styles.badgeBlueText,
                          ]}
                        >
                          {proj.status}
                        </Text>
                      </View>
                    </View>

                    {/* Column 3: Tasks Done */}
                    <View style={[styles.tableCell, styles.colTasks]}>
                      <View style={styles.tableTasksRatioRow}>
                        <Text style={styles.tableTasksRatio}>
                          {completedTasks}/{totalTasks}
                        </Text>
                        <Text style={styles.tableTasksPct}>{pct}%</Text>
                      </View>
                      <View style={styles.tableTrack}>
                        <View
                          style={[
                            styles.tableTrackFill,
                            pct === 100
                              ? styles.projProgressBarFillCompleted
                              : styles.projProgressBarFillActive,
                            { width: `${pct}%` },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Column 4: Timeline Dates */}
                    <View style={[styles.tableCell, styles.colTimeline]}>
                      <Text style={styles.tableDateStart}>
                        {startDateStr}
                      </Text>
                      <Text style={styles.tableDateSecond}>
                        {secondDateStr}
                      </Text>
                    </View>

                    {/* Column 5: Completion Duration */}
                    <View style={[styles.tableCell, styles.colDuration]}>
                      <View style={styles.tableDurationRow}>
                        {isCompleted ? (
                          <Flag size={12} color="#10B981" />
                        ) : (
                          <Timer size={12} color="#64748B" />
                        )}
                        <Text
                          style={[
                            styles.tableDurationText,
                            isCompleted
                              ? styles.durationDaysCompleted
                              : styles.durationDaysOngoing,
                          ]}
                        >
                          {durationDays}
                        </Text>
                      </View>
                    </View>

                    {/* Column 6: Total Time Logged */}
                    <View style={[styles.tableCell, styles.colHours]}>
                      <Text style={styles.totalHoursText}>
                        {totalHours.toFixed(2)}h
                      </Text>
                      <Text style={styles.estHoursText}>
                        / {estHours.toFixed(2)}h est
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
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
  sectionBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextGroup: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#17212F',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryPillGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  summaryPillGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  summaryPillBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  summaryPillBlueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  summaryPillSlate: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  summaryPillSlateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
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
  hitSlop6: {
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
  },
  toggleBtnActive: {
    backgroundColor: '#EFF6FF',
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
  durationsListContainer: {
    gap: 12,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: { elevation: 2 },
    }),
  },
  projectCardCompleted: {
    borderLeftColor: '#10B981',
  },
  projectCardActive: {
    borderLeftColor: '#2878C7',
  },
  projDurationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projCodeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
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
  projNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  microBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeGreenText: {
    color: '#047857',
  },
  badgeBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  badgeBlueText: {
    color: '#1D4ED8',
  },
  microBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  projProgressBarRow: {
    gap: 4,
  },
  projProgressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projProgressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  projProgressPct: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17365D',
  },
  projProgressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  projProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  projProgressBarFillCompleted: {
    backgroundColor: '#10B981',
  },
  projProgressBarFillActive: {
    backgroundColor: '#2878C7',
  },
  timelineDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  timelineDatesTextGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineDateStart: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  timelineDateSecond: {
    fontSize: 10.5,
    color: '#64748B',
  },
  metricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  metricItem: {
    flex: 1,
    gap: 3,
  },
  metricItemLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metricItemValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  durationDaysText: {
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  durationDaysCompleted: {
    color: '#10B981',
  },
  durationDaysOngoing: {
    color: '#475569',
  },
  totalHoursText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#10B981',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  estHoursText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
  },
  cardFooterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingTop: 4,
  },
  cardFooterLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },

  /* Table View Styles */
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    minWidth: 780,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#17365D',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tableCell: {
    justifyContent: 'center',
  },
  colProject: {
    width: 170,
    paddingRight: 8,
  },
  colStatus: {
    width: 95,
  },
  colTasks: {
    width: 120,
    paddingRight: 10,
  },
  colTimeline: {
    width: 145,
    paddingRight: 8,
  },
  colDuration: {
    width: 130,
    paddingRight: 8,
  },
  colHours: {
    width: 120,
  },
  tableCodeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  tableCodeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#17365D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tableProjName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#17212F',
  },
  tableTasksRatioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  tableTasksRatio: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  tableTasksPct: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#17365D',
  },
  tableTrack: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  tableTrackFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  tableDateStart: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  tableDateSecond: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  tableDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableDurationText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
