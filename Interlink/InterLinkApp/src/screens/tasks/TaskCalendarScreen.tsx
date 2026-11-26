import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  AlertTriangle,
  Folder,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react-native';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { fetchTasks, TaskItem } from '../../api/taskApi';

// Helper: format YYYY-MM-DD from year, monthIndex (0-11), day
const formatDateKey = (year: number, monthIndex: number, day: number): string => {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

// Helper: safely extract YYYY-MM-DD string from task due_date without timezone shifts
const extractDueDateKey = (dueDate?: string): string => {
  if (!dueDate) return '';
  if (typeof dueDate === 'string') {
    if (dueDate.length >= 10 && dueDate.includes('-')) {
      const parts = dueDate.slice(0, 10).split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  const dateObj = new Date(dueDate);
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.toISOString().slice(0, 10);
};

// Helper: format date for display (e.g. Nov 24, 2026)
const formatDisplayDate = (dateKey: string): string => {
  if (!dateKey) return '';
  const parts = dateKey.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return dateKey;
};

// Priority styles helper
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

// Status styles helper (matches frontend)
const getStatusStyle = (status?: string, isBlocked?: boolean) => {
  const s = status?.toLowerCase();
  if (s === 'done' || s === 'completed') {
    return {
      bg: '#F0FDF4',
      text: '#16A34A',
      border: '#BBF7D0',
      label: 'Completed',
      isDone: true,
    };
  }
  if (isBlocked || s === 'blocked') {
    return {
      bg: '#FEF2F2',
      text: '#DC2626',
      border: '#FECACA',
      label: 'Blocked',
      isBlocked: true,
    };
  }
  if (s === 'in_progress') {
    return {
      bg: '#EFF6FF',
      text: '#2563EB',
      border: '#BFDBFE',
      label: 'In Progress',
      isDone: false,
    };
  }
  if (s === 'in_review') {
    return {
      bg: '#F5F3FF',
      text: '#7C3AED',
      border: '#DDD6FE',
      label: 'In Review',
      isDone: false,
    };
  }
  return {
    bg: '#F8FAFC',
    text: '#475569',
    border: '#E2E8F0',
    label: 'To Do',
    isDone: false,
  };
};

export const TaskCalendarScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Today reference
  const today = useMemo(() => new Date(), []);
  const todayDateKey = useMemo(
    () => formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
    [today]
  );

  // Calendar View State: Year & Month
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());
  // Selected date key (YYYY-MM-DD)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayDateKey);

  // Selected task for detail modal
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('TasksScreen');
    }
  }, [navigation]);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchTasks();
      if (res.success && Array.isArray(res.data)) {
        setTasks(res.data);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Failed to load calendar tasks:', err);
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDateKey(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  // Month Name & Year Title
  const monthTitle = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  // Calendar Grid calculation (matches frontend TaskCalendarView.jsx)
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{
      empty?: boolean;
      day?: number;
      dateKey?: string;
      isToday?: boolean;
      tasks: TaskItem[];
    }> = [];

    // Empty cells before first day
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ empty: true, tasks: [] });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = formatDateKey(viewYear, viewMonth, d);
      const dayTasks = tasks.filter((t) => extractDueDateKey(t.due_date) === dateKey);
      const isToday = dateKey === todayDateKey;

      cells.push({
        day: d,
        dateKey,
        isToday,
        tasks: dayTasks,
      });
    }

    return cells;
  }, [viewYear, viewMonth, tasks, todayDateKey]);

  // Tasks due on selected date
  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter((t) => extractDueDateKey(t.due_date) === selectedDateKey);
  }, [tasks, selectedDateKey]);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Task Calendar"
        onBackPress={handleBack}
        showBack={true}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
        {/* Month Selector Card (Frontend-styled header & grid) */}
        <View style={styles.calendarCard}>
          {/* Header Row: Month Year + Today Button + Prev/Next Controls */}
          <View style={styles.monthHeader}>
            <View style={styles.monthLeftRow}>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <TouchableOpacity
                onPress={handleToday}
                style={styles.todayBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthNavRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.monthNavBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={18} color="#475569" strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.monthNavBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronRight size={18} color="#475569" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Weekday Labels (Sun & Sat muted) */}
          <View style={styles.weekdaysRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w, idx) => (
              <Text
                key={w}
                style={[
                  styles.weekdayLabel,
                  (idx === 0 || idx === 6) && styles.weekendLabel,
                ]}
              >
                {w}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.daysGrid}>
            {calendarCells.map((cell, index) => {
              if (cell.empty) {
                return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
              }

              const isSelected = cell.dateKey === selectedDateKey;
              const hasTasks = cell.tasks.length > 0;
              const hasBlocked = cell.tasks.some((t) => t.is_blocked);
              const hasDone = cell.tasks.some(
                (t) => t.status === 'done' || t.status === 'completed'
              );

              return (
                <TouchableOpacity
                  key={`day-${cell.dateKey}-${index}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    cell.isToday && !isSelected && styles.dayCellTodayBorder,
                  ]}
                  onPress={() => cell.dateKey && setSelectedDateKey(cell.dateKey)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dayNumberCircle,
                      cell.isToday && styles.dayNumberCircleToday,
                      isSelected && styles.dayNumberCircleSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        cell.isToday && styles.dayCellTextToday,
                        isSelected && styles.dayCellTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>

                  {/* Task Indicators */}
                  {hasTasks && (
                    <View style={styles.taskIndicatorsRow}>
                      <View
                        style={[
                          styles.taskDot,
                          hasBlocked
                            ? styles.taskDotBlocked
                            : hasDone
                            ? styles.taskDotDone
                            : styles.taskDotActive,
                          isSelected && styles.taskDotSelected,
                        ]}
                      />
                      {cell.tasks.length > 1 && (
                        <Text
                          style={[
                            styles.taskCountMini,
                            isSelected && styles.taskCountMiniSelected,
                          ]}
                        >
                          +{cell.tasks.length - 1}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Date Tasks Section Header */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleRow}>
            <CalendarDays size={18} color="#17365D" strokeWidth={2.2} />
            <Text style={styles.sectionTitle}>
              Tasks for {formatDisplayDate(selectedDateKey)}
            </Text>
          </View>
          <View style={styles.taskCountBadge}>
            <Text style={styles.taskCountBadgeText}>
              {tasksForSelectedDate.length} Task{tasksForSelectedDate.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        {/* Tasks List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color="#17365D" />
            <Text style={styles.loadingText}>Loading tasks...</Text>
          </View>
        ) : tasksForSelectedDate.length === 0 ? (
          <View style={styles.emptyTasksCard}>
            <CalendarIcon size={32} color="#CBD5E1" strokeWidth={1.8} />
            <Text style={styles.emptyTasksTitle}>No tasks due on this date</Text>
            <Text style={styles.emptyTasksSubtitle}>
              Select another date with a task indicator or check your upcoming schedule.
            </Text>
          </View>
        ) : (
          tasksForSelectedDate.map((task) => {
            const pCfg = getPriorityStyle(task.priority);
            const sCfg = getStatusStyle(task.status, task.is_blocked);

            return (
              <TouchableOpacity
                key={task.id}
                style={[
                  styles.taskItemCard,
                  sCfg.isDone && styles.taskItemCardDone,
                  sCfg.isBlocked && styles.taskItemCardBlocked,
                ]}
                onPress={() => setSelectedTask(task)}
                activeOpacity={0.8}
              >
                {/* Top Row: Code, Status Badge, Priority Pill */}
                <View style={styles.taskItemTop}>
                  <View style={styles.taskTopLeft}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>
                        {task.task_code || `#TSK-${task.id}`}
                      </Text>
                    </View>

                    {task.is_blocked && (
                      <View style={styles.blockedBadge}>
                        <AlertTriangle size={11} color="#DC2626" />
                        <Text style={styles.blockedBadgeText}>BLOCKED</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.taskTopRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: sCfg.bg,
                          borderColor: sCfg.border,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: sCfg.text }]}>
                        {sCfg.label}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.priorityBadge,
                        {
                          backgroundColor: pCfg.bg,
                          borderColor: pCfg.border,
                        },
                      ]}
                    >
                      <Text style={[styles.priorityBadgeText, { color: pCfg.text }]}>
                        {pCfg.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Task Title */}
                <Text
                  style={[
                    styles.taskItemTitle,
                    sCfg.isDone && styles.taskItemTitleDone,
                  ]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>

                {/* Project association */}
                {task.project_name && (
                  <View style={styles.projectRow}>
                    <Folder size={12} color="#64748B" />
                    <Text style={styles.taskProjectText} numberOfLines={1}>
                      {task.project_name}
                    </Text>
                  </View>
                )}

                {/* Footer Meta Row */}
                <View style={styles.taskItemFooter}>
                  <View style={styles.taskItemMeta}>
                    <Clock size={12} color="#64748B" />
                    <Text style={styles.taskItemMetaText}>
                      Due: {extractDueDateKey(task.due_date)}
                    </Text>
                  </View>

                  {task.estimated_hours ? (
                    <Text style={styles.estHoursText}>
                      Est: {task.estimated_hours}h
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Task Detail Modal (Matches frontend TaskDetailDrawer) */}
      <Modal
        visible={!!selectedTask}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            {/* Detail Header */}
            <View style={styles.detailHeader}>
              <View style={styles.codeBadgeLarge}>
                <Text style={styles.codeTextLarge}>
                  {selectedTask?.task_code || `#TSK-${selectedTask?.id}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTask(null)}
                style={styles.closeModalBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailScrollContent}
            >
              <Text style={styles.detailTitle}>{selectedTask?.title}</Text>

              {selectedTask?.description ? (
                <Text style={styles.detailDesc}>{selectedTask.description}</Text>
              ) : (
                <Text style={styles.detailDescEmpty}>No description provided.</Text>
              )}

              {/* Blocker alert box if blocked */}
              {selectedTask?.is_blocked && (
                <View style={styles.blockerAlertBox}>
                  <AlertTriangle size={16} color="#DC2626" />
                  <View style={styles.blockerAlertTextWrap}>
                    <Text style={styles.blockerAlertTitle}>Task is Blocked</Text>
                    <Text style={styles.blockerAlertDesc}>
                      This task has unfinished predecessor dependencies preventing completion.
                    </Text>
                  </View>
                </View>
              )}

              {/* Key Attributes Box */}
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <View style={styles.infoBadgeWrap}>
                    <Text style={styles.infoValue}>
                      {selectedTask?.status ? selectedTask.status.replace('_', ' ').toUpperCase() : 'TO DO'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Priority</Text>
                  <Text style={styles.infoValue}>
                    {selectedTask?.priority ? selectedTask.priority.toUpperCase() : 'MEDIUM'}
                  </Text>
                </View>

                {selectedTask?.project_name && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Project</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {selectedTask.project_name}
                    </Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Due Date</Text>
                  <Text style={styles.infoValue}>
                    {selectedTask?.due_date ? extractDueDateKey(selectedTask.due_date) : 'Not specified'}
                  </Text>
                </View>

                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>Estimated</Text>
                  <Text style={styles.infoValue}>
                    {selectedTask?.estimated_hours ? `${selectedTask.estimated_hours}h` : '0h'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.detailFooter}>
              <TouchableOpacity
                style={styles.doneModalBtn}
                onPress={() => setSelectedTask(null)}
                activeOpacity={0.8}
              >
                <CheckCircle2 size={16} color="#FFFFFF" />
                <Text style={styles.doneModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  monthLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#17212F',
    letterSpacing: -0.2,
  },
  todayBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  weekdayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  weekendLabel: {
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 44,
  },
  dayCell: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2878C7',
  },
  dayCellTodayBorder: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dayNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberCircleToday: {
    backgroundColor: '#17365D',
  },
  dayNumberCircleSelected: {
    backgroundColor: '#2878C7',
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#17212F',
  },
  dayCellTextToday: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  taskIndicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
    height: 6,
  },
  taskDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  taskDotActive: {
    backgroundColor: '#2878C7',
  },
  taskDotBlocked: {
    backgroundColor: '#DC2626',
  },
  taskDotDone: {
    backgroundColor: '#16A34A',
  },
  taskDotSelected: {
    borderWidth: 0.5,
    borderColor: '#17365D',
  },
  taskCountMini: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#2878C7',
    lineHeight: 9,
  },
  taskCountMiniSelected: {
    color: '#17365D',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#17212F',
  },
  taskCountBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
  },
  taskCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2878C7',
  },
  centerLoading: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyTasksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTasksTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  emptyTasksSubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  taskItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  taskItemCardDone: {
    backgroundColor: '#FAFCFA',
    borderColor: '#D1FAE5',
  },
  taskItemCardBlocked: {
    backgroundColor: '#FEFBFB',
    borderColor: '#FECACA',
  },
  taskItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  taskTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#17365D',
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  blockedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  priorityBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  taskItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17212F',
    marginBottom: 4,
    lineHeight: 18,
  },
  taskItemTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  taskProjectText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    flexShrink: 1,
  },
  taskItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  taskItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskItemMetaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  estHoursText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  // Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  codeBadgeLarge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeTextLarge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#17365D',
  },
  closeModalBtn: {
    padding: 4,
  },
  detailScroll: {
    paddingHorizontal: 18,
  },
  detailScrollContent: {
    paddingVertical: 14,
    gap: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17212F',
    letterSpacing: -0.2,
  },
  detailDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  detailDescEmpty: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  blockerAlertBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    alignItems: 'flex-start',
  },
  blockerAlertTextWrap: {
    flex: 1,
  },
  blockerAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 2,
  },
  blockerAlertDesc: {
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 15,
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  infoLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  infoBadgeWrap: {
    flexDirection: 'row',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#17212F',
  },
  detailFooter: {
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  doneModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingVertical: 11,
    borderRadius: 8,
  },
  doneModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
