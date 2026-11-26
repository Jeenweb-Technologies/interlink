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
} from 'react-native';
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
} from 'lucide-react-native';
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
} from '../../api/timesheetApi';
import { fetchProjects, ProjectItem } from '../../api/projectApi';
import { fetchTasks, TaskItem } from '../../api/taskApi';
import { theme } from '../../constants/theme';

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

  const [activeTab, setActiveTab] = useState<'weekly' | 'approvals'>('weekly');

  // Weekly Timesheet State
  const [currentWeekDate, setCurrentWeekDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timesheetData, setTimesheetData] = useState<CurrentTimesheetResponse | null>(null);
  const [loadingTimesheet, setLoadingTimesheet] = useState(true);
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);

  // Projects & Tasks
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Log Time Modal State
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
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
  const [rejectModalItem, setRejectModalItem] = useState<TimesheetApprovalQueueItem | null>(null);
  const [rejectionComments, setRejectionComments] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

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
  const fetchQueue = useCallback(async () => {
    try {
      setLoadingQueue(true);
      const res = await getTimesheetApprovalsQueue({ status: 'SUBMITTED' });
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
      fetchQueue();
    }
  }, [activeTab, fetchQueue]);

  // Week Shift
  const shiftWeek = (deltaWeeks: number) => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() + deltaWeeks * 7);
    setCurrentWeekDate(d.toISOString().slice(0, 10));
  };

  // Filter tasks based on selected project
  const filteredTasks = useMemo(() => {
    if (!selectedProjectId) return tasks;
    return tasks.filter((t) => Number(t.project_id) === Number(selectedProjectId));
  }, [tasks, selectedProjectId]);

  // Handle Save Time Entry
  const handleSaveEntry = async () => {
    if (!selectedProjectId) {
      Alert.alert('Required', 'Please select a project');
      return;
    }
    const hours = parseInt(durationHours || '0', 10);
    const mins = parseInt(durationMinutes || '0', 10);
    const totalMinutes = hours * 60 + mins;

    if (totalMinutes <= 0) {
      Alert.alert('Invalid Duration', 'Please enter at least 15 minutes of work time');
      return;
    }

    try {
      setSavingEntry(true);
      const res = await saveTimeEntry({
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
        Alert.alert('Success', 'Time entry logged successfully!');
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
    Alert.alert('Delete Time Entry', 'Are you sure you want to delete this log?', [
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
                Alert.alert('Submitted', 'Timesheet submitted successfully!');
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
      const res = await approveTimesheet(id);
      if (res.success) {
        Alert.alert('Approved', 'Timesheet has been approved.');
        fetchQueue();
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
        fetchQueue();
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
    <View style={styles.screen}>
      <AppHeader
        title="Timesheets"
        onBackPress={() => navigation.goBack()}
        showBack
      />

      {/* Primary Tabs */}
      <View style={styles.tabsHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'weekly' && styles.tabButtonActive]}
          onPress={() => setActiveTab('weekly')}
        >
          <Calendar size={14} color={activeTab === 'weekly' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]}>
            Weekly Timesheet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'approvals' && styles.tabButtonActive]}
          onPress={() => setActiveTab('approvals')}
        >
          <FileCheck size={14} color={activeTab === 'approvals' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'approvals' && styles.tabTextActive]}>
            Approvals Queue
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
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
                      })} - ${new Date(
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
              >
                <ChevronRight size={18} color="#17365D" />
              </TouchableOpacity>
            </View>

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
                onPress={() => setIsEntryModalOpen(true)}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.logTimeBtnText}>Log Time Entry</Text>
              </TouchableOpacity>
            )}

            {/* Entries List Header */}
            <View style={styles.entriesListHeader}>
              <Text style={styles.entriesListTitle}>
                Logged Entries ({timesheetData?.entries?.length || 0})
              </Text>
            </View>

            {/* Time Entries List */}
            {loadingTimesheet ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading timesheet entries...</Text>
              </View>
            ) : !timesheetData?.entries || timesheetData.entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Clock size={32} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Entries Logged</Text>
                <Text style={styles.emptySubtitle}>
                  You haven't logged any time for this week yet.
                </Text>
                {isDraft && (
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setIsEntryModalOpen(true)}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.emptyAddBtnText}>Add First Entry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              timesheetData.entries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryTopRow}>
                    <View style={styles.entryTitleCol}>
                      <Text style={styles.entryProjectText}>
                        {entry.project_name || 'Project'}
                      </Text>
                      {entry.task_name && (
                        <Text style={styles.entryTaskText}>{entry.task_name}</Text>
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
                      {entry.is_billable && (
                        <View style={styles.billableChip}>
                          <Text style={styles.billableChipText}>Billable</Text>
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
                      <TouchableOpacity
                        style={styles.entryDeleteBtn}
                        onPress={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 size={15} color="#EF4444" />
                      </TouchableOpacity>
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
              >
                {submittingTimesheet ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={16} color="#FFFFFF" />
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
                  No timesheets are currently pending your approval.
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
                      <View>
                        <Text style={styles.queueUserName}>{item.user_name}</Text>
                        <Text style={styles.queueDeptText}>
                          {item.department_name || item.user_email || 'Member'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.queueTotalPill}>
                      <Text style={styles.queueTotalText}>
                        {Math.round((item.total_minutes || 0) / 60 * 10) / 10} hrs
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.queuePeriodText}>
                    Period: {new Date(item.period_start_date).toLocaleDateString()} -{' '}
                    {new Date(item.period_end_date).toLocaleDateString()}
                  </Text>

                  <View style={styles.queueActionsRow}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, actionInProgress && styles.btnDisabled]}
                      onPress={() => setRejectModalItem(item)}
                      disabled={actionInProgress}
                    >
                      <XCircle size={15} color="#DC2626" />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.approveBtn, actionInProgress && styles.btnDisabled]}
                      onPress={() => handleApprove(item.id)}
                      disabled={actionInProgress}
                    >
                      <CheckCircle size={15} color="#FFFFFF" />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Log Time Modal */}
      <Modal
        visible={isEntryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEntryModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Log Time Entry</Text>
                <Text style={styles.modalSubtitle}>Record hours worked on project tasks</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEntryModalOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              {/* Project Picker */}
              <Text style={styles.inputLabel}>
                Project <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
                        General Project Work
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
              <Text style={styles.inputLabel}>Work Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={workDate}
                onChangeText={setWorkDate}
                placeholder="2026-11-25"
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
              >
                <Text style={styles.toggleLabel}>Billable to Client</Text>
                <View style={[styles.toggleSwitch, isBillable && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleThumb, isBillable && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEntryModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingEntry && styles.btnDisabled]}
                onPress={handleSaveEntry}
                disabled={savingEntry}
              >
                {savingEntry ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Log</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={!!rejectModalItem}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalItem(null)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <Text style={styles.rejectModalTitle}>Reject Timesheet</Text>
            <Text style={styles.rejectModalSubtitle}>
              Please state why this timesheet cannot be approved:
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
                <Text style={styles.rejectConfirmText}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -24,
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
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
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
  },
  weekNavBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
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
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  logTimeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },

  /* Entries List */
  entriesListHeader: {
    marginTop: 4,
  },
  entriesListTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
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
  },
  entryTitleCol: {
    flex: 1,
  },
  entryProjectText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  entryTaskText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  entryHoursPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  entryHoursText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#1E293B',
  },
  entryDescText: {
    fontSize: 12,
    color: '#475569',
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
    gap: 6,
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
  entryDateText: {
    fontSize: 10,
    color: '#94A3B8',
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

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    maxHeight: 460,
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
    height: 70,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    color: '#0F172A',
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
    paddingVertical: 14,
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: theme.typography.weights.semibold,
  },
  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
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
    padding: 20,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  rejectConfirmText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
});
