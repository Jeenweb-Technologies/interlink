import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Clock,
  Calendar,
  AlertTriangle,
  Folder,
} from 'lucide-react-native';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { fetchTasks, TaskItem } from '../../api/taskApi';

// Helper to safely extract YYYY-MM-DD for date display
const extractDateLabel = (dateStr?: string): string => {
  if (!dateStr) return '—';
  if (typeof dateStr === 'string' && dateStr.length >= 10) {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const TaskGanttScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    } catch {
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

  return (
    <View style={styles.container}>
      <AppHeader
        title="Gantt Timeline"
        onBackPress={handleBack}
        showBack={true}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#17365D" />
          <Text style={styles.loadingText}>Loading timeline...</Text>
        </View>
      ) : (
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
          {/* Timeline Status Legend (Matches Frontend TaskGanttView.jsx) */}
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>TIMELINE PROGRESS COLORS</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotCompleted]} />
                <Text style={styles.legendText}>Completed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotInProgress]} />
                <Text style={styles.legendText}>In Progress</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotTodo]} />
                <Text style={styles.legendText}>To Do</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotBlocked]} />
                <Text style={styles.legendText}>Blocked</Text>
              </View>
            </View>
          </View>

          {tasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Calendar size={28} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No timeline tasks found</Text>
              <Text style={styles.emptySubtitle}>
                No scheduled tasks found for timeline display.
              </Text>
            </View>
          ) : (
            tasks.map((task) => {
              const isDone = task.status === 'done' || task.status === 'completed';
              const isInProgress = task.status === 'in_progress';
              const isBlocked = Boolean(task.is_blocked || task.status === 'blocked');
              const isCritical = isBlocked || task.priority === 'urgent';

              // Frontend-matched progress bar color logic (TaskGanttView.jsx lines 384-388):
              // if (isDone) barBg = "#10B981"
              // else if (isBlocked || isCritical) barBg = "#EF4444"
              // else if (t.status === "in_progress") barBg = "#2563EB" (bg-blue-600)
              // else barBg = "#2878C7" (default brand blue)
              let barColor = '#2878C7';
              let statusLabel = 'TO DO';
              let statusBg = '#F0F7FF';
              let statusBorder = '#BFDBFE';
              let statusTextColor = '#2878C7';

              if (isDone) {
                barColor = '#10B981';
                statusLabel = 'COMPLETED';
                statusBg = '#ECFDF5';
                statusBorder = '#BBF7D0';
                statusTextColor = '#10B981';
              } else if (isBlocked || isCritical) {
                barColor = '#EF4444';
                statusLabel = isBlocked ? 'BLOCKED' : 'URGENT';
                statusBg = '#FEF2F2';
                statusBorder = '#FECACA';
                statusTextColor = '#DC2626';
              } else if (isInProgress) {
                barColor = '#2563EB';
                statusLabel = 'IN PROGRESS';
                statusBg = '#EFF6FF';
                statusBorder = '#BFDBFE';
                statusTextColor = '#2563EB';
              }

              // Progress percentage
              const progressPct = isDone
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
                <View
                  key={task.id}
                  style={[
                    styles.ganttTaskCard,
                    isBlocked && styles.ganttTaskCardBlocked,
                    isDone && styles.ganttTaskCardDone,
                  ]}
                >
                  {/* Top Header: Code, Title, Status Pill */}
                  <View style={styles.ganttCardTop}>
                    <View style={styles.taskCodeGroup}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>
                          {task.task_code || `#TSK-${task.id}`}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.taskTitle,
                          isDone && styles.taskTitleDone,
                        ]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusTag,
                        {
                          backgroundColor: statusBg,
                          borderColor: statusBorder,
                        },
                      ]}
                    >
                      {isBlocked && (
                        <AlertTriangle size={10} color="#DC2626" style={styles.blockedIcon} />
                      )}
                      <Text
                        style={[
                          styles.statusTagText,
                          { color: statusTextColor },
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Project name if available */}
                  {task.project_name && (
                    <View style={styles.projectRow}>
                      <Folder size={11} color="#64748B" />
                      <Text style={styles.projectNameText} numberOfLines={1}>
                        {task.project_name}
                      </Text>
                    </View>
                  )}

                  {/* Gantt Bar representation */}
                  <View style={styles.ganttBarContainer}>
                    <View style={styles.ganttBarDatesRow}>
                      <Text style={styles.ganttDateText}>
                        Start: {extractDateLabel(task.start_date || task.created_at)}
                      </Text>
                      <Text style={styles.ganttDateText}>
                        Due: {extractDateLabel(task.due_date)}
                      </Text>
                      <Text style={[styles.ganttPctText, { color: barColor }]}>
                        {progressPct}%
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${progressPct}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Footer: Hours & Priority */}
                  <View style={styles.ganttCardFooter}>
                    <View style={styles.metaItem}>
                      <Clock size={11} color="#64748B" />
                      <Text style={styles.metaText}>
                        Est: {task.estimated_hours || 0}h • Act: {task.actual_hours || 0}h
                      </Text>
                    </View>
                    {task.priority && (
                      <View
                        style={[
                          styles.priorityPill,
                          task.priority === 'urgent' && styles.priorityPillUrgent,
                          task.priority === 'high' && styles.priorityPillHigh,
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityLabel,
                            task.priority === 'urgent' && styles.priorityLabelUrgent,
                            task.priority === 'high' && styles.priorityLabelHigh,
                          ]}
                        >
                          {task.priority.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12.5,
    color: '#64748B',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 12,
  },
  legendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotCompleted: {
    backgroundColor: '#10B981',
  },
  legendDotInProgress: {
    backgroundColor: '#2563EB',
  },
  legendDotTodo: {
    backgroundColor: '#2878C7',
  },
  legendDotBlocked: {
    backgroundColor: '#EF4444',
  },
  blockedIcon: {
    marginRight: 2,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
  },
  ganttTaskCard: {
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
  ganttTaskCardDone: {
    backgroundColor: '#FAFCFA',
    borderColor: '#D1FAE5',
  },
  ganttTaskCardBlocked: {
    backgroundColor: '#FEFBFB',
    borderColor: '#FECACA',
  },
  ganttCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskCodeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
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
  taskTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17212F',
    flexShrink: 1,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  projectNameText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  ganttBarContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 8,
    marginVertical: 4,
  },
  ganttBarDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ganttDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  ganttPctText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  barTrack: {
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  ganttCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
  },
  priorityPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  priorityPillUrgent: {
    backgroundColor: '#FEF2F2',
  },
  priorityPillHigh: {
    backgroundColor: '#FFFBEB',
  },
  priorityLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  priorityLabelUrgent: {
    color: '#DC2626',
  },
  priorityLabelHigh: {
    color: '#D97706',
  },
});
