import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Clock,
  X,
  Calendar,
} from 'lucide-react-native';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { fetchTasks, updateTaskApi, TaskItem } from '../../api/taskApi';

interface KanbanColumn {
  key: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}

const COLUMNS: KanbanColumn[] = [
  { key: 'backlog', label: 'Backlog', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  { key: 'todo', label: 'To Do', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'in_progress', label: 'In Progress', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  { key: 'in_review', label: 'In Review', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'done', label: 'Done', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'blocked', label: 'Blocked', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
];

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

export const TaskKanbanScreen: React.FC = () => {
  const navigation = useNavigation();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Drag and drop state
  const [draggingTask, setDraggingTask] = useState<TaskItem | null>(null);
  const [hoveredColumnKey, setHoveredColumnKey] = useState<string | null>(null);

  const panPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const boardScrollX = useRef(0);
  const columnLayouts = useRef<{ [key: string]: { x: number; width: number } }>({});
  const containerOffsetTop = useRef(140);

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
      console.error('Failed to load kanban tasks:', err);
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

  const getTasksForColumn = (columnKey: string) => {
    return tasks.filter((t) => {
      const s = (t.status || 'todo').toLowerCase();
      return s === columnKey;
    });
  };

  const handleDropTask = useCallback(
    async (task: TaskItem, newStatus: string) => {
      const currentStatus = (task.status || 'todo').toLowerCase();
      const targetStatus = newStatus.toLowerCase();

      if (currentStatus === targetStatus) {
        return;
      }

      // Check if moving to 'done' while actively blocked
      if (targetStatus === 'done' && task.is_blocked) {
        Alert.alert(
          'Blocked Task',
          'Cannot move to Done: Blocked by unfinished predecessor!'
        );
        return;
      }

      // Optimistic local state update
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === task.id ? { ...t, status: targetStatus } : t
        )
      );

      try {
        const res = await updateTaskApi(task.id, { status: targetStatus });
        if (!res.success) {
          loadTasks();
          Alert.alert('Update Failed', res.message || 'Could not update task status');
        }
      } catch (err) {
        console.error('Failed to update task status:', err);
        loadTasks();
        Alert.alert('Error', 'An error occurred while updating task status');
      }
    },
    [loadTasks]
  );

  const findColumnUnderPoint = useCallback((pageX: number) => {
    const adjustedX = pageX + boardScrollX.current - 16;
    for (const col of COLUMNS) {
      const layout = columnLayouts.current[col.key];
      if (layout) {
        if (adjustedX >= layout.x && adjustedX <= layout.x + layout.width) {
          return col.key;
        }
      }
    }
    return null;
  }, []);

  const createPanResponder = (task: TaskItem) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _e: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        return Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8;
      },
      onPanResponderGrant: (
        e: GestureResponderEvent,
        _gestureState: PanResponderGestureState
      ) => {
        setDraggingTask(task);
        panPosition.setValue({
          x: e.nativeEvent.pageX - 125,
          y: e.nativeEvent.pageY - 40,
        });
        const col = findColumnUnderPoint(e.nativeEvent.pageX);
        setHoveredColumnKey(col);
      },
      onPanResponderMove: (
        e: GestureResponderEvent,
        _gestureState: PanResponderGestureState
      ) => {
        panPosition.setValue({
          x: e.nativeEvent.pageX - 125,
          y: e.nativeEvent.pageY - 40,
        });
        const col = findColumnUnderPoint(e.nativeEvent.pageX);
        setHoveredColumnKey(col);
      },
      onPanResponderRelease: (
        e: GestureResponderEvent,
        _gestureState: PanResponderGestureState
      ) => {
        const targetCol = findColumnUnderPoint(e.nativeEvent.pageX);
        if (targetCol) {
          handleDropTask(task, targetCol);
        }
        setDraggingTask(null);
        setHoveredColumnKey(null);
      },
      onPanResponderTerminate: () => {
        setDraggingTask(null);
        setHoveredColumnKey(null);
      },
    });
  };

  const handleColumnLayout = (key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    columnLayouts.current[key] = { x, width };
  };

  const handleBoardScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    boardScrollX.current = e.nativeEvent.contentOffset.x;
  };

  const renderCardContent = (task: TaskItem, isHover = false) => {
    const pCfg = getPriorityStyle(task.priority);
    return (
      <View
        style={[
          styles.taskCard,
          isHover ? styles.taskCardHover : undefined,
          task.is_blocked ? styles.taskCardBlocked : undefined,
        ]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>
              {task.task_code || `#TSK-${task.id}`}
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

        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.title}
        </Text>

        {task.is_blocked ? (
          <View style={styles.blockedAlertBox}>
            <Text style={styles.blockedAlertText}>⛔ Blocked</Text>
          </View>
        ) : null}

        {task.project_name ? (
          <Text style={styles.projectName} numberOfLines={1}>
            📁 {task.project_name}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          {task.due_date ? (
            <View style={styles.metaRow}>
              <Clock size={11} color="#64748B" />
              <Text style={styles.metaText}>
                {new Date(task.due_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          ) : (
            <View />
          )}

          {task.assignees && task.assignees.length > 0 && (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(task.assignees[0].name || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Kanban Board"
        onBackPress={() => navigation.goBack()}
        showBack={true}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#17365D" />
          <Text style={styles.loadingText}>Loading board...</Text>
        </View>
      ) : (
        <View
          style={styles.boardArea}
          onLayout={(e) => {
            containerOffsetTop.current = e.nativeEvent.layout.y;
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.boardContent}
            onScroll={handleBoardScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#17365D']}
                tintColor="#17365D"
              />
            }
          >
            {COLUMNS.map((col) => {
              const columnTasks = getTasksForColumn(col.key);
              const isReceiving = hoveredColumnKey === col.key;
              const totalHours = columnTasks.reduce(
                (acc, t) => acc + (t.estimated_hours || 0),
                0
              );

              return (
                <View
                  key={col.key}
                  onLayout={(e) => handleColumnLayout(col.key, e)}
                  style={[
                    styles.columnWrapper,
                    isReceiving ? styles.columnReceiving : undefined,
                  ]}
                >
                  {/* Column Header */}
                  <View
                    style={[
                      styles.columnHeader,
                      { backgroundColor: col.bg, borderColor: col.border },
                    ]}
                  >
                    <View style={styles.columnTitleRow}>
                      <View
                        style={[
                          styles.columnIndicator,
                          { backgroundColor: col.color },
                        ]}
                      />
                      <Text style={[styles.columnTitle, { color: col.color }]}>
                        {col.label}
                      </Text>
                    </View>
                    <View style={styles.columnHeaderRight}>
                      {totalHours > 0 ? (
                        <Text style={styles.columnHoursText}>
                          {totalHours}h
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.columnCountBadge,
                          { backgroundColor: col.border },
                        ]}
                      >
                        <Text
                          style={[styles.columnCountText, { color: col.color }]}
                        >
                          {columnTasks.length}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Column Tasks */}
                  <ScrollView
                    style={styles.columnScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.columnScrollContent}
                  >
                    {columnTasks.length === 0 ? (
                      <View style={styles.emptyColumnBox}>
                        <Text style={styles.emptyColumnText}>Drop task here</Text>
                      </View>
                    ) : (
                      columnTasks.map((task) => {
                        const isThisDragging = draggingTask?.id === task.id;
                        const panResponder = createPanResponder(task);
                        return (
                          <View
                            key={task.id}
                            {...panResponder.panHandlers}
                            style={[
                              styles.taskCardWrapper,
                              isThisDragging ? styles.taskCardDragging : undefined,
                            ]}
                          >
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => setSelectedTask(task)}
                            >
                              {renderCardContent(task, false)}
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              );
            })}
          </ScrollView>

          {/* Floating Hover Card while dragging */}
          {draggingTask ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.floatingHoverCard,
                {
                  transform: [
                    { translateX: panPosition.x },
                    { translateY: panPosition.y },
                    { rotate: '2deg' },
                    { scale: 1.04 },
                  ],
                },
              ]}
            >
              {renderCardContent(draggingTask, true)}
            </Animated.View>
          ) : null}
        </View>
      )}

      {/* Task Detail Modal */}
      <Modal
        visible={!!selectedTask}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>
                  {selectedTask?.task_code || `#TSK-${selectedTask?.id}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTask(null)}
                hitSlop={styles.hitSlop8}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailScroll}
              showsVerticalScrollIndicator={false}
            >
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
                {selectedTask?.project_name ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Project:</Text>
                    <Text style={styles.infoValue}>
                      {selectedTask.project_name}
                    </Text>
                  </View>
                ) : null}
                {selectedTask?.due_date ? (
                  <View style={styles.infoRow}>
                    <Calendar size={13} color="#64748B" />
                    <Text style={styles.infoLabel}>Due Date:</Text>
                    <Text style={styles.infoValue}>
                      {new Date(selectedTask.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeDetailBtn}
              onPress={() => setSelectedTask(null)}
            >
              <Text style={styles.closeDetailBtnText}>Close</Text>
            </TouchableOpacity>
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
  boardArea: {
    flex: 1,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  boardContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  columnWrapper: {
    width: 265,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  columnReceiving: {
    borderColor: '#2563EB',
    borderWidth: 2,
    backgroundColor: '#F0F9FF',
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  columnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  columnHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  columnHoursText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  columnIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  columnTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  columnCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  columnCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  columnScroll: {
    flex: 1,
  },
  columnScrollContent: {
    padding: 10,
    gap: 10,
  },
  emptyColumnBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    marginVertical: 4,
  },
  emptyColumnText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  taskCardWrapper: {
    borderRadius: 10,
  },
  taskCardDragging: {
    opacity: 0.25,
  },
  floatingHoverCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 250,
    zIndex: 9999,
  },
  taskCardHover: {
    width: 250,
    opacity: 0.96,
    borderColor: '#2563EB',
    borderWidth: 1.5,
    shadowColor: '#17365D',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
  },
  taskCardBlocked: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#EF4444',
  },
  blockedAlertBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  blockedAlertText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#17365D',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  taskTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#17212F',
    lineHeight: 17,
    marginBottom: 4,
  },
  projectName: {
    fontSize: 10.5,
    color: '#64748B',
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 6,
    marginTop: 2,
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
  avatarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
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
  closeDetailBtn: {
    backgroundColor: '#17365D',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeDetailBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hitSlop8: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
});
