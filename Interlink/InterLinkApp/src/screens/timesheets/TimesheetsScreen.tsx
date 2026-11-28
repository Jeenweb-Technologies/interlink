import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Send,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  FileCheck,
  CheckCircle2,
  Edit2,
  Briefcase,
  Layers,
  Filter,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import {
  getCurrentTimesheet,
  saveTimeEntry,
  deleteTimeEntry,
  submitTimesheet,
  getTimesheetApprovalsQueue,
  approveTimesheet,
  rejectTimesheet,
  CurrentTimesheetResponse,
  TimesheetApprovalQueueItem,
  TimeEntryItem,
} from '../../api/timesheetApi';
import { fetchProjects, ProjectItem } from '../../api/projectApi';
import { fetchTasks, TaskItem } from '../../api/taskApi';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';
import { NoPermissionView } from '../../components/common/NoPermissionView';

const CATEGORIES = [
  'DEVELOPMENT',
  'DESIGN',
  'TESTING',
  'MEETING',
  'BUG_FIX',
  'RESEARCH',
  'OTHER',
];

export const TimesheetsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { hasPermission, isAdmin: isPermAdmin } = usePermissionStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super admin' || isPermAdmin;
  const canRead = isAdmin || hasPermission('timesheets', 'read');

  if (!canRead) {
    return (
      <NoPermissionView
        moduleName="Timesheets"
        headerTitle="Timesheets"
        onBackPress={() => navigation.goBack()}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<'weekly' | 'approvals'>('weekly');

  // Weekly Timesheet State
  const [currentWeekDate, setCurrentWeekDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timesheetData, setTimesheetData] = useState<CurrentTimesheetResponse | null>(null);
  const [loadingTimesheet, setLoadingTimesheet] = useState(true);
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);

  // Projects & Tasks
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Log / Edit Time Modal State
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>(undefined);
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [category, setCategory] = useState('DEVELOPMENT');
  const [savingEntry, setSavingEntry] = useState(false);

  // Approvals Queue State
  const [queue, setQueue] = useState<TimesheetApprovalQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState<'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ALL'>('SUBMITTED');
  const [rejectModalItem, setRejectModalItem] = useState<TimesheetApprovalQueueItem | null>(null);
  const [rejectionComments, setRejectionComments] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  // Safe bottom padding for modals to prevent hiding behind Android gesture pill or bottom bar
  const modalBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 20) + 12;

  // 1. Fetch Current Week Timesheet
  const fetchTimesheet = useCallback(async (dateStr: string) => {
    try {
      setLoadingTimesheet(true);
      const res = await getCurrentTimesheet({ date: dateStr });
      if (res.success && res.data) {
        setTimesheetData(res.data.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingTimesheet(false);
    }
  }, []);

  // 2. Fetch Projects and Tasks
  const loadProjectsAndTasks = useCallback(async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        fetchProjects().catch(() => null),
        fetchTasks().catch(() => null),
      ]);
      if (projRes?.success && projRes.data) {
        const pList = Array.isArray(projRes.data) ? projRes.data : (projRes.data as any).projects || [];
        setProjects(pList);
        if (pList.length > 0 && selectedProjectId === undefined) {
          setSelectedProjectId(pList[0].id);
        }
      }
      if (taskRes?.success && taskRes.data) {
        const tList = Array.isArray(taskRes.data) ? taskRes.data : (taskRes.data as any).tasks || [];
        setTasks(tList);
      }
    } catch {
      // Ignore
    }
  }, [selectedProjectId]);

  // 3. Fetch Approvals Queue
  const fetchQueue = useCallback(async (statusFilter: string) => {
    try {
      setLoadingQueue(true);
      const res = await getTimesheetApprovalsQueue({ status: statusFilter });
      if (res.success && res.data?.queue) {
        setQueue(res.data.queue);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    fetchTimesheet(currentWeekDate);
    loadProjectsAndTasks();
  }, [currentWeekDate, fetchTimesheet, loadProjectsAndTasks]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchQueue(queueStatusFilter);
    }
  }, [activeTab, queueStatusFilter, fetchQueue]);

  // Week Shift
  const shiftWeek = (deltaWeeks: number) => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() + deltaWeeks * 7);
    setCurrentWeekDate(d.toISOString().slice(0, 10));
    setSelectedDayFilter(null);
  };

  // 7-Day Week Ribbon Array
  const weekDays = useMemo(() => {
    if (!timesheetData?.timesheet?.period_start_date) return [];
    const start = new Date(timesheetData.timesheet.period_start_date);
    const todayStr = new Date().toISOString().slice(0, 10);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const ymd = day.toISOString().slice(0, 10);
      const dayEntries = (timesheetData.entries || []).filter(
        (e) => (e.work_date || '').slice(0, 10) === ymd
      );
      const totalMins = dayEntries.reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0);
      return {
        date: ymd,
        dayName: day.toLocaleDateString([], { weekday: 'short' }),
        dayNumber: day.getDate(),
        isToday: ymd === todayStr,
        totalHours: totalMins > 0 ? (totalMins / 60).toFixed(1) : null,
        entryCount: dayEntries.length,
      };
    });
  }, [timesheetData]);

  // Filter tasks based on selected project
  const filteredTasks = useMemo(() => {
    if (!selectedProjectId) return tasks;
    return tasks.filter((t) => Number(t.project_id) === Number(selectedProjectId));
  }, [tasks, selectedProjectId]);

  // Visible Entries filtered by selected day (if any)
  const visibleEntries = useMemo(() => {
    const all = timesheetData?.entries || [];
    if (!selectedDayFilter) return all;
    return all.filter((e) => (e.work_date || '').slice(0, 10) === selectedDayFilter);
  }, [timesheetData, selectedDayFilter]);

  // Open Modal: Add or Edit
  const handleOpenEntryModal = (entry?: TimeEntryItem | null, defaultDate?: string) => {
    if (entry) {
      setEditingEntryId(entry.id);
      setSelectedProjectId(entry.project_id);
      setSelectedTaskId(entry.task_id || undefined);
      setWorkDate(entry.work_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      const totalMins = Number(entry.duration_minutes) || 60;
      setDurationHours(String(Math.floor(totalMins / 60)));
      setDurationMinutes(String(totalMins % 60));
      setDescription(entry.description || '');
      setIsBillable(Boolean(entry.is_billable));
      setCategory(entry.category || 'DEVELOPMENT');
    } else {
      setEditingEntryId(null);
      if (projects.length > 0) {
        setSelectedProjectId(projects[0].id);
      }
      setSelectedTaskId(undefined);
      setWorkDate(defaultDate || selectedDayFilter || new Date().toISOString().slice(0, 10));
      setDurationHours('1');
      setDurationMinutes('0');
      setDescription('');
      setIsBillable(true);
      setCategory('DEVELOPMENT');
    }
    setIsEntryModalOpen(true);
  };

  // Handle Save Time Entry (Insert or Update)
  const handleSaveEntry = async () => {
    if (!selectedProjectId) {
      Alert.alert('Required', 'Please select a project');
      return;
    }
    const hours = parseInt(durationHours || '0', 10);
    const mins = parseInt(durationMinutes || '0', 10);
    const totalMinutes = hours * 60 + mins;

    if (totalMinutes <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a duration greater than 0 minutes');
      return;
    }

    try {
      setSavingEntry(true);
      const res = await saveTimeEntry({
        id: editingEntryId || undefined,
        timesheet_id: timesheetData?.timesheet?.id,
        project_id: selectedProjectId,
        task_id: selectedTaskId || null,
        work_date: workDate,
        duration_minutes: totalMinutes,
        description: description.trim() || undefined,
        is_billable: isBillable,
        category,
      });

      if (res.success) {
        Alert.alert('Success', editingEntryId ? 'Time entry updated!' : 'Time entry logged successfully!');
        setIsEntryModalOpen(false);
        setDescription('');
        fetchTimesheet(currentWeekDate);
      } else {
        Alert.alert('Notice', res.message || 'Failed to save time entry');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Save failed');
    } finally {
      setSavingEntry(false);
    }
  };

  // Handle Delete Entry
  const handleDeleteEntry = (id: number) => {
    Alert.alert('Delete Time Entry', 'Are you sure you want to delete this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteTimeEntry(id);
            if (res.success) {
              fetchTimesheet(currentWeekDate);
            }
          } catch {
            Alert.alert('Error', 'Could not delete entry');
          }
        },
      },
    ]);
  };

  // Handle Submit Weekly Timesheet
  const handleSubmitTimesheet = async () => {
    if (!timesheetData?.timesheet?.id) {
      Alert.alert('Error', 'Timesheet not initialized.');
      return;
    }

    Alert.alert(
      'Submit Timesheet',
      'Submit this weekly timesheet for manager review? Entries will be locked after submission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Now',
          onPress: async () => {
            try {
              setSubmittingTimesheet(true);
              const res = await submitTimesheet(timesheetData.timesheet.id);
              if (res.success) {
                Alert.alert('Submitted', 'Timesheet submitted successfully for review!');
                fetchTimesheet(currentWeekDate);
              } else {
                Alert.alert('Notice', res.message || 'Submission failed');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Submission error');
            } finally {
              setSubmittingTimesheet(false);
            }
          },
        },
      ]
    );
  };

  // Handle Approve Timesheet
  const handleApprove = async (id: number) => {
    try {
      setActionInProgress(true);
      const res = await approveTimesheet(id, { comments: 'Approved by manager' });
      if (res.success) {
        Alert.alert('Approved', 'Timesheet has been approved.');
        fetchQueue(queueStatusFilter);
      } else {
        Alert.alert('Notice', res.message || 'Approval failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not approve');
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle Reject Timesheet
  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    if (!rejectionComments.trim()) {
      Alert.alert('Required', 'Please enter comments explaining the rejection.');
      return;
    }

    try {
      setActionInProgress(true);
      const res = await rejectTimesheet(rejectModalItem.id, { comments: rejectionComments.trim() });
      if (res.success) {
        Alert.alert('Rejected', 'Timesheet rejected with feedback.');
        setRejectModalItem(null);
        setRejectionComments('');
        fetchQueue(queueStatusFilter);
      } else {
        Alert.alert('Notice', res.message || 'Rejection failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Rejection error');
    } finally {
      setActionInProgress(false);
    }
  };

  const status = timesheetData?.timesheet?.status || 'DRAFT';
  const isDraft = status === 'DRAFT';
  const isSubmitted = status === 'SUBMITTED';
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';

  return (
    <ScreenWrapper dark={false} edges={['left', 'right']} statusBarStyle="light-content">
      {/* Curved Theme Header */}
      <AppHeader
        title="Timesheets"
        onBackPress={() => navigation.goBack()}
        showBack
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      {/* Primary Sub Tabs Header */}
      <View style={styles.tabsHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'weekly' && styles.tabButtonActive]}
          onPress={() => setActiveTab('weekly')}
          activeOpacity={0.8}
        >
          <Calendar size={13} color={activeTab === 'weekly' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
            Weekly Timesheet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'approvals' && styles.tabButtonActive]}
          onPress={() => setActiveTab('approvals')}
          activeOpacity={0.8}
        >
          <FileCheck size={13} color={activeTab === 'approvals' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'approvals' && styles.tabTextActive]}>
            Approvals Queue
          </Text>
          {queue.length > 0 && activeTab !== 'approvals' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{queue.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* 1. WEEKLY TIMESHEET TAB */}
        {/* ========================================================================= */}
        {activeTab === 'weekly' && (
          <View style={styles.tabContentWrap}>
            {/* Week Selector Bar */}
            <View style={styles.weekSelectorCard}>
              <TouchableOpacity
                style={styles.weekNavBtn}
                onPress={() => shiftWeek(-1)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={18} color="#17365D" />
              </TouchableOpacity>

              <View style={styles.weekDateCenter}>
                <Text style={styles.weekDateRange}>
                  {timesheetData?.timesheet?.period_start_date
                    ? `${new Date(
                        timesheetData.timesheet.period_start_date
                      ).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })} – ${new Date(
                        timesheetData.timesheet.period_end_date
                      ).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}`
                    : currentWeekDate}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    isDraft && styles.badgeGray,
                    isSubmitted && styles.badgeBlue,
                    isApproved && styles.badgeGreen,
                    isRejected && styles.badgeRed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isDraft && styles.textGray,
                      isSubmitted && styles.textBlue,
                      isApproved && styles.textGreen,
                      isRejected && styles.textRed,
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.weekNavBtn}
                onPress={() => shiftWeek(1)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronRight size={18} color="#17365D" />
              </TouchableOpacity>
            </View>

            {/* 7-Day Interactive Week Ribbon */}
            {weekDays.length > 0 && (
              <View style={styles.weekRibbonCard}>
                <View style={styles.weekRibbonHeader}>
                  <Text style={styles.weekRibbonTitle}>Weekly Breakdown</Text>
                  {selectedDayFilter && (
                    <TouchableOpacity
                      onPress={() => setSelectedDayFilter(null)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.clearFilterText}>Show All Days</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.weekRibbonDaysRow}>
                  {weekDays.map((d) => {
                    const isSelected = selectedDayFilter === d.date;
                    return (
                      <TouchableOpacity
                        key={d.date}
                        style={[
                          styles.dayPill,
                          d.isToday && styles.dayPillToday,
                          isSelected && styles.dayPillSelected,
                        ]}
                        onPress={() =>
                          setSelectedDayFilter(isSelected ? null : d.date)
                        }
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.dayPillName,
                            isSelected && styles.dayPillTextSelected,
                          ]}
                        >
                          {d.dayName}
                        </Text>
                        <Text
                          style={[
                            styles.dayPillNumber,
                            isSelected && styles.dayPillTextSelected,
                          ]}
                        >
                          {d.dayNumber}
                        </Text>
                        {d.totalHours ? (
                          <View
                            style={[
                              styles.dayHoursChip,
                              isSelected && styles.dayHoursChipSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayHoursText,
                                isSelected && styles.dayHoursTextSelected,
                              ]}
                            >
                              {d.totalHours}h
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.dayEmptyDot} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Total Hours Summary Cards */}
            <View style={styles.hoursGrid}>
              <View style={styles.hourCard}>
                <Text style={styles.hourCardLabel}>Total Logged</Text>
                <Text style={styles.hourCardVal}>
                  {timesheetData?.summary?.total_hours || '0.0'}h
                </Text>
              </View>

              <View style={styles.hourCard}>
                <Text style={styles.hourCardLabel}>Billable Hours</Text>
                <Text style={[styles.hourCardVal, styles.textEmerald]}>
                  {timesheetData?.summary?.billable_hours || '0.0'}h
                </Text>
              </View>

              <View style={styles.hourCard}>
                <Text style={styles.hourCardLabel}>Non-Billable</Text>
                <Text style={[styles.hourCardVal, styles.textSlate]}>
                  {timesheetData?.summary?.non_billable_hours || '0.0'}h
                </Text>
              </View>
            </View>

            {/* Quick Action Button: Log Time */}
            {isDraft && (
              <TouchableOpacity
                style={styles.logTimeBtn}
                onPress={() => handleOpenEntryModal(null)}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.logTimeBtnText}>Log Time Entry</Text>
              </TouchableOpacity>
            )}

            {/* Entries List Header */}
            <View style={styles.entriesListHeader}>
              <Text style={styles.entriesListTitle}>
                Logged Entries ({visibleEntries.length}
                {selectedDayFilter ? ` for ${new Date(selectedDayFilter).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''})
              </Text>
              {selectedDayFilter && (
                <TouchableOpacity onPress={() => setSelectedDayFilter(null)}>
                  <Text style={styles.clearFilterSmall}>Clear Filter</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Time Entries List */}
            {loadingTimesheet ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading timesheet entries...</Text>
              </View>
            ) : visibleEntries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Clock size={32} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Entries Found</Text>
                <Text style={styles.emptySubtitle}>
                  {selectedDayFilter
                    ? 'No time entries logged for this specific day.'
                    : "You haven't logged any time for this week yet."}
                </Text>
                {isDraft && (
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => handleOpenEntryModal(null, selectedDayFilter || undefined)}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.emptyAddBtnText}>Add First Entry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              visibleEntries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryTopRow}>
                    <View style={styles.entryTitleCol}>
                      <View style={styles.projectRow}>
                        <Briefcase size={13} color="#2563EB" />
                        <Text style={styles.entryProjectText} numberOfLines={1}>
                          {entry.project_name || 'Project'}
                        </Text>
                      </View>
                      {entry.task_name && (
                        <View style={styles.taskTagBox}>
                          <Text style={styles.entryTaskText} numberOfLines={1}>
                            {entry.task_name}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.entryHoursPill}>
                      <Text style={styles.entryHoursText}>
                        {Math.floor(entry.duration_minutes / 60)}h{' '}
                        {entry.duration_minutes % 60}m
                      </Text>
                    </View>
                  </View>

                  {entry.description ? (
                    <Text style={styles.entryDescText} numberOfLines={2}>
                      {entry.description}
                    </Text>
                  ) : null}

                  <View style={styles.entryFooterRow}>
                    <View style={styles.entryMetaGroup}>
                      <View style={styles.entryCatChip}>
                        <Text style={styles.entryCatText}>{entry.category}</Text>
                      </View>
                      {entry.is_billable ? (
                        <View style={styles.billableChip}>
                          <Text style={styles.billableChipText}>Billable</Text>
                        </View>
                      ) : (
                        <View style={styles.nonBillableChip}>
                          <Text style={styles.nonBillableChipText}>Non-Billable</Text>
                        </View>
                      )}
                      <Text style={styles.entryDateText}>
                        {new Date(entry.work_date).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>

                    {isDraft && (
                      <View style={styles.entryActionsWrap}>
                        <TouchableOpacity
                          style={styles.entryEditBtn}
                          onPress={() => handleOpenEntryModal(entry)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Edit2 size={14} color="#2563EB" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.entryDeleteBtn}
                          onPress={() => handleDeleteEntry(entry.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}

            {/* Submit Timesheet Button */}
            {isDraft && (timesheetData?.entries?.length || 0) > 0 && (
              <TouchableOpacity
                style={[styles.submitWeeklyBtn, submittingTimesheet && styles.btnDisabled]}
                onPress={handleSubmitTimesheet}
                disabled={submittingTimesheet}
                activeOpacity={0.85}
              >
                {submittingTimesheet ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={15} color="#FFFFFF" />
                    <Text style={styles.submitWeeklyText}>Submit Weekly Timesheet</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. APPROVALS QUEUE TAB */}
        {/* ========================================================================= */}
        {activeTab === 'approvals' && (
          <View style={styles.tabContentWrap}>
            {/* Filter Pills Row */}
            <View style={styles.filterPillsRow}>
              {(['SUBMITTED', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.filterPill,
                    queueStatusFilter === st && styles.filterPillActive,
                  ]}
                  onPress={() => setQueueStatusFilter(st)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      queueStatusFilter === st && styles.filterPillTextActive,
                    ]}
                  >
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionHeaderTitle}>
              Timesheet Approvals Queue ({queue.length})
            </Text>

            {loadingQueue ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading approvals queue...</Text>
              </View>
            ) : queue.length === 0 ? (
              <View style={styles.emptyCard}>
                <CheckCircle2 size={32} color="#10B981" />
                <Text style={styles.emptyTitle}>Queue Is Clear!</Text>
                <Text style={styles.emptySubtitle}>
                  No timesheets are currently pending under {queueStatusFilter} status.
                </Text>
              </View>
            ) : (
              queue.map((item) => (
                <View key={item.id} style={styles.queueCard}>
                  <View style={styles.queueHeader}>
                    <View style={styles.queueUserWrap}>
                      <View style={styles.queueAvatar}>
                        <Text style={styles.queueAvatarText}>
                          {(item.user_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.queueInfoCol}>
                        <Text style={styles.queueUserName} numberOfLines={1}>
                          {item.user_name}
                        </Text>
                        <Text style={styles.queueDeptText} numberOfLines={1}>
                          {item.department_name || item.user_email || 'Member'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.queueTotalPill}>
                      <Text style={styles.queueTotalText}>
                        {Math.round(((item.total_minutes || 0) / 60) * 10) / 10} hrs
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.queuePeriodText}>
                    Period: {new Date(item.period_start_date).toLocaleDateString()} –{' '}
                    {new Date(item.period_end_date).toLocaleDateString()}
                  </Text>

                  {item.status === 'SUBMITTED' && (
                    <View style={styles.queueActionsRow}>
                      <TouchableOpacity
                        style={[styles.rejectBtn, actionInProgress && styles.btnDisabled]}
                        onPress={() => setRejectModalItem(item)}
                        disabled={actionInProgress}
                        activeOpacity={0.8}
                      >
                        <XCircle size={15} color="#DC2626" />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.approveBtn, actionInProgress && styles.btnDisabled]}
                        onPress={() => handleApprove(item.id)}
                        disabled={actionInProgress}
                        activeOpacity={0.8}
                      >
                        <CheckCircle size={15} color="#FFFFFF" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: LOG / EDIT TIME ENTRY
          Protected with KeyboardAvoidingView & Safe Bottom Padding
      ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={isEntryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEntryModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIsEntryModalOpen(false)}
          />

          <View style={[styles.modalCard, { paddingBottom: modalBottomPadding }]}>
            {/* Top Drag Indicator */}
            <View style={styles.modalDragHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <Text style={styles.modalTitle}>
                  {editingEntryId ? 'Edit Time Entry' : 'Log Time Entry'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingEntryId
                    ? 'Update hours and project notes'
                    : 'Record hours worked on project tasks'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEntryModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Project Picker */}
              <Text style={styles.inputLabel}>
                Project <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.pickChip,
                      selectedProjectId === p.id && styles.pickChipActive,
                    ]}
                    onPress={() => {
                      setSelectedProjectId(p.id);
                      setSelectedTaskId(undefined);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickChipText,
                        selectedProjectId === p.id && styles.pickChipTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Task Picker */}
              {filteredTasks.length > 0 && (
                <>
                  <Text style={styles.inputLabel}>Task (Optional)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    <TouchableOpacity
                      style={[
                        styles.pickChip,
                        selectedTaskId === undefined && styles.pickChipActive,
                      ]}
                      onPress={() => setSelectedTaskId(undefined)}
                    >
                      <Text
                        style={[
                          styles.pickChipText,
                          selectedTaskId === undefined && styles.pickChipTextActive,
                        ]}
                      >
                        General Work
                      </Text>
                    </TouchableOpacity>
                    {filteredTasks.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.pickChip,
                          selectedTaskId === t.id && styles.pickChipActive,
                        ]}
                        onPress={() => setSelectedTaskId(t.id)}
                      >
                        <Text
                          style={[
                            styles.pickChipText,
                            selectedTaskId === t.id && styles.pickChipTextActive,
                          ]}
                        >
                          {t.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Work Date */}
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.inputLabel}>Work Date (YYYY-MM-DD)</Text>
                <TouchableOpacity
                  onPress={() => setWorkDate(new Date().toISOString().slice(0, 10))}
                >
                  <Text style={styles.shortcutText}>Set Today</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.textInput}
                value={workDate}
                onChangeText={setWorkDate}
                placeholder="2026-11-27"
                placeholderTextColor="#94A3B8"
              />

              {/* Duration Hours & Minutes */}
              <View style={styles.durationInputRow}>
                <View style={styles.durationInputCol}>
                  <Text style={styles.inputLabel}>Hours</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={durationHours}
                    onChangeText={setDurationHours}
                    placeholder="1"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.durationInputCol}>
                  <Text style={styles.inputLabel}>Minutes</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    placeholder="30"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Category */}
              <Text style={styles.inputLabel}>Activity Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pickChip, category === cat && styles.pickChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.pickChipText,
                        category === cat && styles.pickChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Description */}
              <Text style={styles.inputLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What did you accomplish?"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />

              {/* Billable Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setIsBillable(!isBillable)}
                activeOpacity={0.8}
              >
                <View>
                  <Text style={styles.toggleLabel}>Billable to Client</Text>
                  <Text style={styles.toggleSubtitle}>
                    {isBillable ? 'Included in client invoices' : 'Internal / Non-chargeable work'}
                  </Text>
                </View>
                <View style={[styles.toggleSwitch, isBillable && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleThumb, isBillable && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Action Buttons Footer (Raised safely above Gesture Handle) */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEntryModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingEntry && styles.btnDisabled]}
                onPress={handleSaveEntry}
                disabled={savingEntry}
                activeOpacity={0.85}
              >
                {savingEntry ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {editingEntryId ? 'Update Entry' : 'Save Log'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: REJECT TIMESHEET (MANAGER DECISION)
      ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(rejectModalItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalItem(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlayCenter}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setRejectModalItem(null)}
          />

          <View style={[styles.modalCardCenter, { paddingBottom: modalBottomPadding }]}>
            <Text style={styles.rejectModalTitle}>Reject Timesheet</Text>
            <Text style={styles.rejectModalSubtitle}>
              Please provide feedback explaining why this timesheet cannot be approved:
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea, styles.mt12]}
              placeholder="e.g. Missing billable hours for project X..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={rejectionComments}
              onChangeText={setRejectionComments}
            />
            <View style={styles.rejectModalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalItem(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectConfirmBtn, actionInProgress && styles.btnDisabled]}
                onPress={handleConfirmReject}
                disabled={actionInProgress}
              >
                {actionInProgress ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.rejectConfirmText}>Confirm Rejection</Text>
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
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#17365D',
  },
  tabText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.bold,
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabContentWrap: {
    gap: 14,
  },

  /* Week Selector Card */
  weekSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDateCenter: {
    alignItems: 'center',
  },
  weekDateRange: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeGray: { backgroundColor: '#F1F5F9' },
  badgeBlue: { backgroundColor: '#EFF6FF' },
  badgeGreen: { backgroundColor: '#ECFDF5' },
  badgeRed: { backgroundColor: '#FEF2F2' },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  textGray: { color: '#64748B' },
  textBlue: { color: '#2563EB' },
  textGreen: { color: '#047857' },
  textRed: { color: '#DC2626' },

  /* 7-Day Week Ribbon Card */
  weekRibbonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  weekRibbonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekRibbonTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#334155',
    textTransform: 'uppercase',
  },
  clearFilterText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: '#2563EB',
  },
  weekRibbonDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayPillToday: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  dayPillSelected: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  dayPillName: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: theme.typography.weights.semibold,
  },
  dayPillNumber: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
    marginTop: 2,
  },
  dayPillTextSelected: {
    color: '#FFFFFF',
  },
  dayHoursChip: {
    marginTop: 4,
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  dayHoursChipSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dayHoursText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#2563EB',
  },
  dayHoursTextSelected: {
    color: '#FFFFFF',
  },
  dayEmptyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginTop: 6,
  },

  /* Hours Grid */
  hoursGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  hourCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hourCardLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  hourCardVal: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  textEmerald: { color: '#059669' },
  textSlate: { color: '#64748B' },

  /* Log Time Action Button */
  logTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  logTimeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },

  /* Entries List */
  entriesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  entriesListTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  clearFilterSmall: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  entryTitleCol: {
    flex: 1,
    gap: 3,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryProjectText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
    flex: 1,
  },
  taskTagBox: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  entryTaskText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  entryHoursPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  entryHoursText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#2563EB',
  },
  entryDescText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  entryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  entryMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  entryCatChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  entryCatText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#475569',
  },
  billableChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  billableChipText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#047857',
  },
  nonBillableChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nonBillableChipText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#64748B',
  },
  entryDateText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  entryActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryEditBtn: {
    padding: 4,
  },
  entryDeleteBtn: {
    padding: 4,
  },

  /* Submit Weekly Timesheet */
  submitWeeklyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  submitWeeklyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  /* Approvals Queue Filter */
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.bold,
  },

  /* Queue Cards */
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  queueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueUserWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  queueAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueAvatarText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
  queueInfoCol: {
    flex: 1,
  },
  queueUserName: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  queueDeptText: {
    fontSize: 11,
    color: '#64748B',
  },
  queueTotalPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  queueTotalText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#2563EB',
  },
  queuePeriodText: {
    fontSize: 11,
    color: '#64748B',
  },
  queueActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  rejectBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#059669',
    gap: 6,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },

  /* Empty & Loading */
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },

  /* ─────────────────────────────────────────────────────────────
     MODAL STYLES (Elevated above Gesture Handle & Keyboard Aware)
  ───────────────────────────────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitleWrap: {
    flex: 1,
    marginRight: 12,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalBody: {
    maxHeight: 440,
  },
  modalBodyContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  requiredAsterisk: {
    color: '#EF4444',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 8,
  },
  shortcutText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: theme.typography.weights.semibold,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  pickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickChipActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  pickChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: theme.typography.weights.medium,
  },
  pickChipTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.bold,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  durationInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationInputCol: {
    flex: 1,
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    color: '#0F172A',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#059669',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  modalCancelText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: theme.typography.weights.semibold,
  },
  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },

  /* Rejection Center Modal */
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCardCenter: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  rejectModalTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
  rejectModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  mt12: {
    marginTop: 12,
  },
  rejectModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  rejectConfirmBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  rejectConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
});
