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
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Clock,
  Calendar,
  Users,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Building,
  Home,
  MapPin,
  FileEdit,
  ArrowRight,
  X,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Search,
  Check,
  ShieldCheck,
  RotateCcw,
  Play,
  Square,
  Sparkles,
} from 'lucide-react-native';
import { AppHeader } from '../../components/common/AppHeader';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';
import { fetchDepartments, DepartmentItem } from '../../api/masterApi';
import {
  getTodayAttendance,
  recordClockEvent,
  getAttendanceHistory,
  getWorkSchedules,
  getTeamAttendanceBoard,
  requestAttendanceAdjustment,
  getAttendanceAdjustments,
  reviewAttendanceAdjustment,
  AttendanceTodayData,
  AttendanceHistoryData,
  WorkScheduleItem,
  TeamBoardMember,
  AttendanceAdjustmentItem,
} from '../../api/attendanceApi';
import { theme } from '../../constants/theme';

type PrimaryTab = 'today' | 'history' | 'adjustments' | 'team';

export const AttendanceScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { hasPermission, isAdmin: isPermAdmin } = usePermissionStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super admin' || isPermAdmin;
  const canRead = isAdmin || hasPermission('attendance', 'read');

  if (!canRead) {
    return (
      <NoPermissionView
        moduleName="Attendance & Shifts"
        headerTitle="Attendance & Shifts"
        onBackPress={() => navigation.goBack()}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<PrimaryTab>('today');
  const [refreshing, setRefreshing] = useState(false);

  // ── Today Tab State ────────────────────────────────────────────────────────
  const [todayData, setTodayData] = useState<AttendanceTodayData | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [locationType, setLocationType] = useState<'OFFICE' | 'REMOTE' | 'CLIENT_SITE'>('OFFICE');
  const [clockNotes, setClockNotes] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ── Monthly History State ──────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [historyData, setHistoryData] = useState<AttendanceHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Adjustments State ──────────────────────────────────────────────────────
  const [adjustmentsSubTab, setAdjustmentsSubTab] = useState<'my' | 'manager'>('my');
  const [myAdjustments, setMyAdjustments] = useState<AttendanceAdjustmentItem[]>([]);
  const [managerQueue, setManagerQueue] = useState<AttendanceAdjustmentItem[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Request Adjustment Modal
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjDate, setAdjDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjInTime, setAdjInTime] = useState('09:00');
  const [adjOutTime, setAdjOutTime] = useState('18:00');
  const [adjReason, setAdjReason] = useState('');
  const [submittingAdj, setSubmittingAdj] = useState(false);

  // Review Modal (Manager)
  const [reviewModalItem, setReviewModalItem] = useState<AttendanceAdjustmentItem | null>(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [reviewingAction, setReviewingAction] = useState(false);

  // ── Team & Shifts Tab State ────────────────────────────────────────────────
  const [teamSubTab, setTeamSubTab] = useState<'board' | 'schedules'>('board');
  const [schedules, setSchedules] = useState<WorkScheduleItem[]>([]);
  const [teamBoard, setTeamBoard] = useState<TeamBoardMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(undefined);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);

  // ── 1. Fetch Today Status ──────────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    try {
      setLoadingToday(true);
      const res = await getTodayAttendance();
      if (res.success && res.data) {
        setTodayData(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingToday(false);
    }
  }, []);

  // ── 2. Fetch Monthly History ───────────────────────────────────────────────
  const fetchHistory = useCallback(async (month: string) => {
    try {
      setLoadingHistory(true);
      const res = await getAttendanceHistory({ month });
      if (res.success && res.data) {
        setHistoryData(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // ── 3. Fetch Adjustments ───────────────────────────────────────────────────
  const fetchAdjustments = useCallback(async () => {
    try {
      setLoadingAdjustments(true);
      const [selfRes, queueRes] = await Promise.all([
        getAttendanceAdjustments({ queue: 'self' }).catch(() => null),
        isAdmin
          ? getAttendanceAdjustments({
              queue: 'manager',
              status: queueStatusFilter === 'ALL' ? undefined : queueStatusFilter,
            }).catch(() => null)
          : null,
      ]);

      if (selfRes?.success) {
        const list = Array.isArray(selfRes.data)
          ? selfRes.data
          : (selfRes as any).adjustments || (selfRes.data as any)?.adjustments || [];
        setMyAdjustments(list);
      }

      if (queueRes?.success) {
        const list = Array.isArray(queueRes.data)
          ? queueRes.data
          : (queueRes as any).adjustments || (queueRes.data as any)?.adjustments || [];
        setManagerQueue(list);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAdjustments(false);
    }
  }, [isAdmin, queueStatusFilter]);

  // ── 4. Fetch Team & Schedules ──────────────────────────────────────────────
  const fetchTeamAndSchedules = useCallback(async () => {
    try {
      setLoadingTeam(true);
      const [schedRes, teamRes] = await Promise.all([
        getWorkSchedules().catch(() => null),
        getTeamAttendanceBoard({ department_id: selectedDeptId }).catch(() => null),
      ]);

      if (schedRes?.success) {
        const list = (schedRes as any).schedules || schedRes.data?.schedules || (Array.isArray(schedRes.data) ? schedRes.data : []);
        setSchedules(list);
      }
      if (teamRes?.success) {
        const list = (teamRes as any).board || teamRes.data?.board || (Array.isArray(teamRes.data) ? teamRes.data : []);
        setTeamBoard(list);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTeam(false);
    }
  }, [selectedDeptId]);

  // Initial Load & Tab Changes
  useEffect(() => {
    fetchToday();
    fetchDepartments(false)
      .then((depts) => {
        if (Array.isArray(depts)) setDepartments(depts);
      })
      .catch(() => {});
  }, [fetchToday]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(selectedMonth);
    } else if (activeTab === 'adjustments') {
      fetchAdjustments();
    } else if (activeTab === 'team') {
      fetchTeamAndSchedules();
    }
  }, [activeTab, selectedMonth, fetchHistory, fetchAdjustments, fetchTeamAndSchedules]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'today') await fetchToday();
    else if (activeTab === 'history') await fetchHistory(selectedMonth);
    else if (activeTab === 'adjustments') await fetchAdjustments();
    else if (activeTab === 'team') await fetchTeamAndSchedules();
    setRefreshing(false);
  };

  // Live Timer for Clocked In session
  useEffect(() => {
    if (!todayData || todayData.activeState !== 'CLOCKED_IN' || !todayData.lastClockInTimestamp) {
      return;
    }
    const initialWorkSec = (todayData.summary?.total_work_minutes || 0) * 60;
    const lastInMs = new Date(todayData.lastClockInTimestamp).getTime();

    const interval = setInterval(() => {
      const currentSessionSec = Math.max(0, Math.floor((Date.now() - lastInMs) / 1000));
      setElapsedSeconds(initialWorkSec + currentSessionSec);
    }, 1000);

    return () => clearInterval(interval);
  }, [todayData]);

  // Format seconds to HH:MM:SS
  const formatStopwatch = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clock Event Action (CLOCK_IN, BREAK_START, BREAK_END, CLOCK_OUT)
  const handleClockAction = async (eventType: 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT') => {
    try {
      setClocking(true);
      const res = await recordClockEvent({
        event_type: eventType,
        location_type: locationType,
        notes: clockNotes.trim() || undefined,
      });

      if (res.success) {
        const labels: Record<string, string> = {
          CLOCK_IN: 'Clocked In Successfully!',
          CLOCK_OUT: 'Clocked Out Successfully!',
          BREAK_START: 'Break Started',
          BREAK_END: 'Break Ended - Welcome Back',
        };
        Alert.alert('Status Updated', labels[eventType] || 'Clock event recorded.');
        setClockNotes('');
        fetchToday();
      } else {
        Alert.alert('Notice', res.message || 'Clock action failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record clock event');
    } finally {
      setClocking(false);
    }
  };

  // Submit Regularization Request
  const handleSubmitAdjustment = async () => {
    if (!adjReason.trim()) {
      Alert.alert('Required', 'Please provide a reason / justification for regularization.');
      return;
    }

    try {
      setSubmittingAdj(true);
      const res = await requestAttendanceAdjustment({
        work_date: adjDate,
        requested_clock_in: adjInTime,
        requested_clock_out: adjOutTime,
        reason: adjReason.trim(),
      });

      if (res.success) {
        Alert.alert('Submitted', 'Attendance adjustment request submitted successfully.');
        setIsAdjModalOpen(false);
        setAdjReason('');
        if (activeTab === 'adjustments') fetchAdjustments();
        if (activeTab === 'history') fetchHistory(selectedMonth);
      } else {
        Alert.alert('Notice', res.message || 'Request submission failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Submission failed');
    } finally {
      setSubmittingAdj(false);
    }
  };

  // Review Adjustment Request (Manager Action)
  const handleReviewAdjustment = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewModalItem) return;
    try {
      setReviewingAction(true);
      const res = await reviewAttendanceAdjustment(reviewModalItem.id, {
        status,
        reviewer_comment: reviewerComment.trim() || undefined,
      });

      if (res.success) {
        Alert.alert('Success', `Request has been ${status.toLowerCase()}!`);
        setReviewModalItem(null);
        setReviewerComment('');
        fetchAdjustments();
      } else {
        Alert.alert('Error', res.message || 'Failed to review request');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to review request');
    } finally {
      setReviewingAction(false);
    }
  };

  // Month navigation helper
  const changeMonth = (delta: number) => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + delta;
    if (month > 12) {
      month = 1;
      year += 1;
    } else if (month < 1) {
      month = 12;
      year -= 1;
    }
    const newMonth = `${year}-${month.toString().padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const isClockedIn = todayData?.activeState === 'CLOCKED_IN';
  const isOnBreak = todayData?.activeState === 'ON_BREAK';

  // Filtered Team Board
  const filteredTeamMembers = useMemo(() => {
    return teamBoard.filter((m) => {
      const q = teamSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.department_name && m.department_name.toLowerCase().includes(q));
      return matchesSearch;
    });
  }, [teamBoard, teamSearchQuery]);

  return (
    <ScreenWrapper dark={false} edges={['left', 'right']} statusBarStyle="light-content">
      {/* Curved App Header */}
      <AppHeader
        title="Attendance & Shifts"
        showBack={true}
        onBackPress={() => navigation.goBack()}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      {/* Primary Sub Tabs Header */}
      <View style={styles.tabsHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
          onPress={() => setActiveTab('today')}
        >
          <Clock size={13} color={activeTab === 'today' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
        >
          <Calendar size={13} color={activeTab === 'history' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'adjustments' && styles.tabButtonActive]}
          onPress={() => setActiveTab('adjustments')}
        >
          <FileEdit size={13} color={activeTab === 'adjustments' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'adjustments' && styles.tabTextActive]}>
            Requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'team' && styles.tabButtonActive]}
          onPress={() => setActiveTab('team')}
        >
          <Users size={13} color={activeTab === 'team' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'team' && styles.tabTextActive]}>
            Team & Shifts
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.mainScroll}
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
        {/* ========================================================================= */}
        {/* 1. TODAY'S PUNCH TAB                                                     */}
        {/* ========================================================================= */}
        {activeTab === 'today' && (
          <View style={styles.tabContentWrap}>
            {/* Live Stopwatch & Status Hero Card */}
            <View style={styles.punchHeroCard}>
              <View style={styles.punchHeroTop}>
                <View
                  style={[
                    styles.statusPill,
                    isClockedIn && styles.statusPillGreen,
                    isOnBreak && styles.statusPillAmber,
                    !isClockedIn && !isOnBreak && styles.statusPillGray,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      isClockedIn && styles.statusDotGreen,
                      isOnBreak && styles.statusDotAmber,
                      !isClockedIn && !isOnBreak && styles.statusDotGray,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      isClockedIn && styles.statusTextGreen,
                      isOnBreak && styles.statusTextAmber,
                      !isClockedIn && !isOnBreak && styles.statusTextGray,
                    ]}
                  >
                    {isClockedIn
                      ? 'CLOCKED IN & ACTIVE'
                      : isOnBreak
                      ? 'ON REFRESHMENT BREAK'
                      : 'CLOCKED OUT'}
                  </Text>
                </View>

                <Text style={styles.todayDateText}>
                  {new Date().toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>

              {/* Digital Timer Display */}
              <View style={styles.timerDisplay}>
                <Text style={styles.timerNumbers}>
                  {isClockedIn
                    ? formatStopwatch(elapsedSeconds)
                    : formatStopwatch((todayData?.summary?.total_work_minutes || 0) * 60)}
                </Text>
                <Text style={styles.timerLabel}>Total Hours Logged Today</Text>
              </View>

              {/* Location Selector */}
              <Text style={styles.miniLabel}>Work Location</Text>
              <View style={styles.locationSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.locationOption,
                    locationType === 'OFFICE' && styles.locationOptionActive,
                  ]}
                  onPress={() => setLocationType('OFFICE')}
                >
                  <Building size={14} color={locationType === 'OFFICE' ? '#FFFFFF' : '#475569'} />
                  <Text
                    style={[
                      styles.locationText,
                      locationType === 'OFFICE' && styles.locationTextActive,
                    ]}
                  >
                    Office
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.locationOption,
                    locationType === 'REMOTE' && styles.locationOptionActive,
                  ]}
                  onPress={() => setLocationType('REMOTE')}
                >
                  <Home size={14} color={locationType === 'REMOTE' ? '#FFFFFF' : '#475569'} />
                  <Text
                    style={[
                      styles.locationText,
                      locationType === 'REMOTE' && styles.locationTextActive,
                    ]}
                  >
                    Remote (WFH)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.locationOption,
                    locationType === 'CLIENT_SITE' && styles.locationOptionActive,
                  ]}
                  onPress={() => setLocationType('CLIENT_SITE')}
                >
                  <MapPin size={14} color={locationType === 'CLIENT_SITE' ? '#FFFFFF' : '#475569'} />
                  <Text
                    style={[
                      styles.locationText,
                      locationType === 'CLIENT_SITE' && styles.locationTextActive,
                    ]}
                  >
                    Client Site
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Punch Note Input */}
              <TextInput
                style={styles.notesInput}
                placeholder="Punch note (e.g. Arrived via shuttle, sprint review)"
                placeholderTextColor="#94A3B8"
                value={clockNotes}
                onChangeText={setClockNotes}
              />

              {/* Primary Clock Buttons */}
              <View style={styles.punchActionRow}>
                {!isClockedIn && !isOnBreak ? (
                  <TouchableOpacity
                    style={[styles.clockPrimaryBtn, styles.clockInBtn, clocking && styles.btnDisabled]}
                    onPress={() => handleClockAction('CLOCK_IN')}
                    disabled={clocking}
                    activeOpacity={0.85}
                  >
                    {clocking ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Play size={18} color="#FFFFFF" />
                        <Text style={styles.clockPrimaryText}>Clock In for Today</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : isOnBreak ? (
                  <>
                    <TouchableOpacity
                      style={[styles.clockPrimaryBtn, styles.clockInBtn, clocking && styles.btnDisabled]}
                      onPress={() => handleClockAction('BREAK_END')}
                      disabled={clocking}
                      activeOpacity={0.85}
                    >
                      {clocking ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Play size={18} color="#FFFFFF" />
                          <Text style={styles.clockPrimaryText}>End Break & Resume</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.clockPrimaryBtn, styles.clockOutBtn, clocking && styles.btnDisabled]}
                      onPress={() => handleClockAction('CLOCK_OUT')}
                      disabled={clocking}
                      activeOpacity={0.85}
                    >
                      <Square size={16} color="#FFFFFF" />
                      <Text style={styles.clockPrimaryText}>Clock Out</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.clockPrimaryBtn, styles.breakBtn, clocking && styles.btnDisabled]}
                      onPress={() => handleClockAction('BREAK_START')}
                      disabled={clocking}
                      activeOpacity={0.85}
                    >
                      {clocking ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Coffee size={18} color="#FFFFFF" />
                          <Text style={styles.clockPrimaryText}>Take Break</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.clockPrimaryBtn, styles.clockOutBtn, clocking && styles.btnDisabled]}
                      onPress={() => handleClockAction('CLOCK_OUT')}
                      disabled={clocking}
                      activeOpacity={0.85}
                    >
                      <Square size={16} color="#FFFFFF" />
                      <Text style={styles.clockPrimaryText}>Clock Out</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Today's Summary Metrics Row */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>First Punch In</Text>
                <Text style={styles.metricValue}>
                  {todayData?.summary?.first_clock_in
                    ? new Date(todayData.summary.first_clock_in).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Last Punch Out</Text>
                <Text style={styles.metricValue}>
                  {todayData?.summary?.last_clock_out
                    ? new Date(todayData.summary.last_clock_out).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Work Mins</Text>
                <Text style={[styles.metricValue, styles.textBlue]}>
                  {todayData?.summary?.total_work_minutes || 0}m
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Late Arrival</Text>
                <Text
                  style={[
                    styles.metricValue,
                    (todayData?.summary?.late_minutes || 0) > 0 ? styles.textAmber : styles.textGreen,
                  ]}
                >
                  {(todayData?.summary?.late_minutes || 0) > 0
                    ? `+${todayData?.summary?.late_minutes}m Late`
                    : 'On Time'}
                </Text>
              </View>
            </View>

            {/* Shift Details Card */}
            <View style={styles.shiftCard}>
              <View style={styles.shiftHeader}>
                <Briefcase size={16} color="#17365D" />
                <Text style={styles.shiftTitle}>Assigned Shift Schedule</Text>
              </View>
              <View style={styles.shiftDetailsRow}>
                <View style={styles.shiftCol}>
                  <Text style={styles.shiftSublabel}>Shift Name</Text>
                  <Text style={styles.shiftValue}>
                    {todayData?.schedule?.name || 'Standard General Shift'}
                  </Text>
                </View>
                <View style={styles.shiftCol}>
                  <Text style={styles.shiftSublabel}>Working Window</Text>
                  <Text style={styles.shiftValue}>
                    {todayData?.schedule?.start_time?.slice(0, 5) || '09:00'} -{' '}
                    {todayData?.schedule?.end_time?.slice(0, 5) || '18:00'}
                  </Text>
                </View>
                <View style={styles.shiftCol}>
                  <Text style={styles.shiftSublabel}>Grace Window</Text>
                  <Text style={styles.shiftValue}>
                    {todayData?.schedule?.grace_period_minutes ?? 15} mins
                  </Text>
                </View>
              </View>
            </View>

            {/* Request Regularization Action Banner */}
            <TouchableOpacity
              style={styles.requestAdjCard}
              onPress={() => setIsAdjModalOpen(true)}
              activeOpacity={0.8}
            >
              <View style={styles.requestAdjLeft}>
                <FileEdit size={18} color="#2563EB" />
                <View>
                  <Text style={styles.requestAdjTitle}>Request Regularization</Text>
                  <Text style={styles.requestAdjSubtitle}>
                    Forgot to punch or need time adjustment?
                  </Text>
                </View>
              </View>
              <ArrowRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Today's Activity Log (Punch Events Timeline) */}
            <View style={styles.timelineCard}>
              <View style={styles.timelineHeader}>
                <Clock size={16} color="#17365D" />
                <Text style={styles.timelineTitle}>Today's Activity Log</Text>
              </View>

              {loadingToday ? (
                <ActivityIndicator size="small" color="#17365D" style={{ marginVertical: 12 }} />
              ) : !todayData?.events || todayData.events.length === 0 ? (
                <Text style={styles.timelineEmptyText}>
                  No clock events recorded for today yet. Use the Clock In button above.
                </Text>
              ) : (
                <View style={styles.timelineList}>
                  {todayData.events.map((ev, i) => (
                    <View key={ev.id || i} style={styles.timelineRow}>
                      <View
                        style={[
                          styles.timelineDot,
                          ev.event_type === 'CLOCK_IN'
                            ? styles.timelineDotGreen
                            : ev.event_type === 'CLOCK_OUT'
                            ? styles.timelineDotRed
                            : styles.timelineDotAmber,
                        ]}
                      />
                      <View style={styles.timelineBody}>
                        <View style={styles.timelineMetaRow}>
                          <Text style={styles.timelineEventName}>
                            {ev.event_type.replace('_', ' ')}
                          </Text>
                          <Text style={styles.timelineTimeText}>
                            {new Date(ev.event_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </Text>
                        </View>
                        <View style={styles.timelineDetailsRow}>
                          <Text style={styles.timelineLocationBadge}>
                            {ev.location_type || 'OFFICE'}
                          </Text>
                          {Boolean(ev.notes) && (
                            <Text style={styles.timelineNotesText} numberOfLines={1}>
                              "{ev.notes}"
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. MONTHLY HISTORY TAB                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <View style={styles.tabContentWrap}>
            {/* Month Navigator */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
                <ChevronLeft size={18} color="#17365D" />
              </TouchableOpacity>
              <Text style={styles.monthNavTitle}>
                {new Date(selectedMonth + '-01').toLocaleDateString([], {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
                <ChevronRight size={18} color="#17365D" />
              </TouchableOpacity>
            </View>

            {/* Monthly Stats Summary Row */}
            <View style={styles.historyStatsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.presentCount ?? 0}</Text>
                <Text style={[styles.statLabel, styles.statGreen]}>Present</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.lateCount ?? 0}</Text>
                <Text style={[styles.statLabel, styles.statAmber]}>Late</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.halfDayCount ?? 0}</Text>
                <Text style={[styles.statLabel, styles.statSky]}>Half Day</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.totalWorkHours ?? '0.0'}h</Text>
                <Text style={[styles.statLabel, styles.statBlue]}>Total Hrs</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.averageDailyHours ?? '0.0'}h</Text>
                <Text style={[styles.statLabel, styles.statIndigo]}>Avg/Day</Text>
              </View>
            </View>

            {/* Attendance Logs List */}
            {loadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : !historyData?.records || historyData.records.length === 0 ? (
              <View style={styles.emptyCard}>
                <AlertCircle size={32} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Records Found</Text>
                <Text style={styles.emptySubtitle}>
                  No attendance history logged for {selectedMonth}.
                </Text>
              </View>
            ) : (
              historyData.records.map((r, idx) => {
                const isPresent = r.status === 'PRESENT';
                const isLate = r.status === 'LATE';
                const isHalfDay = r.status === 'HALF_DAY';
                const isAbsent = r.status === 'ABSENT';

                return (
                  <View key={r.id || r.work_date || idx} style={styles.historyRowCard}>
                    <View style={styles.historyDateCol}>
                      <Text style={styles.historyDayName}>
                        {new Date(r.work_date).toLocaleDateString([], { weekday: 'short' })}
                      </Text>
                      <Text style={styles.historyDateNum}>
                        {new Date(r.work_date).getDate()}
                      </Text>
                    </View>

                    <View style={styles.historyTimeCol}>
                      <View style={styles.historyPunchTimes}>
                        <Text style={styles.historyPunchText}>
                          In: {r.first_clock_in ? new Date(r.first_clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </Text>
                        <Text style={styles.historyPunchSeparator}>•</Text>
                        <Text style={styles.historyPunchText}>
                          Out: {r.last_clock_out ? new Date(r.last_clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </Text>
                      </View>
                      <Text style={styles.historyDurationText}>
                        Duration: {Math.round(((r.total_work_minutes || 0) / 60) * 10) / 10} hrs • Break: {r.total_break_minutes || 0}m
                      </Text>
                      {Boolean(r.is_regularized) && (
                        <Text style={styles.regularizedTag}>✓ Regularized</Text>
                      )}
                    </View>

                    <View
                      style={[
                        styles.historyStatusPill,
                        isPresent && styles.statusPillGreen,
                        isLate && styles.statusPillAmber,
                        isHalfDay && styles.statusPillSky,
                        isAbsent && styles.statusPillRed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyStatusText,
                          isPresent && styles.statusTextGreen,
                          isLate && styles.statusTextAmber,
                          isHalfDay && styles.statusTextSky,
                          isAbsent && styles.statusTextRed,
                        ]}
                      >
                        {r.status}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* 3. ADJUSTMENTS / REGULARIZATION REQUESTS TAB                             */}
        {/* ========================================================================= */}
        {activeTab === 'adjustments' && (
          <View style={styles.tabContentWrap}>
            {/* Header / SubTab Row */}
            <View style={styles.subTabsRow}>
              <TouchableOpacity
                style={[styles.subTabPill, adjustmentsSubTab === 'my' && styles.subTabPillActive]}
                onPress={() => setAdjustmentsSubTab('my')}
              >
                <Text
                  style={[
                    styles.subTabPillText,
                    adjustmentsSubTab === 'my' && styles.subTabPillTextActive,
                  ]}
                >
                  My Requests ({myAdjustments.length})
                </Text>
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={[
                    styles.subTabPill,
                    adjustmentsSubTab === 'manager' && styles.subTabPillActive,
                  ]}
                  onPress={() => setAdjustmentsSubTab('manager')}
                >
                  <Text
                    style={[
                      styles.subTabPillText,
                      adjustmentsSubTab === 'manager' && styles.subTabPillTextActive,
                    ]}
                  >
                    Manager Queue ({managerQueue.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Action Button */}
            {/* <TouchableOpacity
              style={styles.newAdjBtn}
              onPress={() => setIsAdjModalOpen(true)}
              activeOpacity={0.8}
            >
              <FileEdit size={16} color="#FFFFFF" />
              <Text style={styles.newAdjBtnText}>Submit New Regularization Requestff</Text>
            </TouchableOpacity> */}

            {/* Status Filter for Manager Queue */}
            {adjustmentsSubTab === 'manager' && (
              <View style={styles.statusFilterRow}>
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.filterChip,
                      queueStatusFilter === st && styles.filterChipActive,
                    ]}
                    onPress={() => setQueueStatusFilter(st)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        queueStatusFilter === st && styles.filterChipTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Content List */}
            {loadingAdjustments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading requests...</Text>
              </View>
            ) : (adjustmentsSubTab === 'my' ? myAdjustments : managerQueue).length === 0 ? (
              <View style={styles.emptyCard}>
                <FileEdit size={32} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Adjustment Requests</Text>
                <Text style={styles.emptySubtitle}>
                  {adjustmentsSubTab === 'my'
                    ? "You haven't submitted any regularization requests yet."
                    : 'No pending adjustment requests in your manager queue.'}
                </Text>
              </View>
            ) : (
              (adjustmentsSubTab === 'my' ? myAdjustments : managerQueue).map((req) => {
                const isPending = req.status === 'PENDING';
                const isApproved = req.status === 'APPROVED';
                const isRejected = req.status === 'REJECTED';

                return (
                  <View key={req.id} style={styles.adjCard}>
                    <View style={styles.adjCardHeader}>
                      <View>
                        {adjustmentsSubTab === 'manager' && Boolean(req.user_name) && (
                          <Text style={styles.adjEmployeeName}>
                            {req.user_name} ({req.department_name || 'Staff'})
                          </Text>
                        )}
                        <Text style={styles.adjWorkDate}>
                          Date: {new Date(req.work_date).toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.adjStatusBadge,
                          isPending && styles.adjStatusPending,
                          isApproved && styles.adjStatusApproved,
                          isRejected && styles.adjStatusRejected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.adjStatusBadgeText,
                            isPending && styles.adjTextPending,
                            isApproved && styles.adjTextApproved,
                            isRejected && styles.adjTextRejected,
                          ]}
                        >
                          {req.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.adjHoursRow}>
                      <Text style={styles.adjHoursLabel}>Requested In/Out:</Text>
                      <Text style={styles.adjHoursValue}>
                        {req.requested_clock_in?.slice(0, 5)} — {req.requested_clock_out?.slice(0, 5)}
                      </Text>
                    </View>

                    <Text style={styles.adjReasonText}>"{req.reason}"</Text>

                    {Boolean(req.reviewer_comment) && (
                      <View style={styles.reviewerCommentBox}>
                        <Text style={styles.reviewerCommentLabel}>Manager Comment:</Text>
                        <Text style={styles.reviewerCommentText}>{req.reviewer_comment}</Text>
                      </View>
                    )}

                    {adjustmentsSubTab === 'manager' && isPending && (
                      <TouchableOpacity
                        style={styles.reviewBtn}
                        onPress={() => {
                          setReviewModalItem(req);
                          setReviewerComment('');
                        }}
                      >
                        <ShieldCheck size={14} color="#FFFFFF" />
                        <Text style={styles.reviewBtnText}>Review & Decision</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* 4. TEAM PRESENCE & SHIFTS TAB                                            */}
        {/* ========================================================================= */}
        {activeTab === 'team' && (
          <View style={styles.tabContentWrap}>
            {/* SubTab Switcher: Team Presence vs Organization Schedules */}
            <View style={styles.subTabsRow}>
              <TouchableOpacity
                style={[styles.subTabPill, teamSubTab === 'board' && styles.subTabPillActive]}
                onPress={() => setTeamSubTab('board')}
              >
                <Text
                  style={[
                    styles.subTabPillText,
                    teamSubTab === 'board' && styles.subTabPillTextActive,
                  ]}
                >
                  Live Presence ({teamBoard.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTabPill, teamSubTab === 'schedules' && styles.subTabPillActive]}
                onPress={() => setTeamSubTab('schedules')}
              >
                <Text
                  style={[
                    styles.subTabPillText,
                    teamSubTab === 'schedules' && styles.subTabPillTextActive,
                  ]}
                >
                  Work Shifts ({schedules.length})
                </Text>
              </TouchableOpacity>
            </View>

            {teamSubTab === 'board' && (
              <>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                  <Search size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search colleague by name or department..."
                    placeholderTextColor="#94A3B8"
                    value={teamSearchQuery}
                    onChangeText={setTeamSearchQuery}
                  />
                  {teamSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setTeamSearchQuery('')}>
                      <X size={15} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Department Filter Pills */}
                {departments.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.deptFilterScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.deptPill,
                        selectedDeptId === undefined && styles.deptPillActive,
                      ]}
                      onPress={() => setSelectedDeptId(undefined)}
                    >
                      <Text
                        style={[
                          styles.deptPillText,
                          selectedDeptId === undefined && styles.deptPillTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    {departments.map((d) => {
                      const isSel = selectedDeptId === d.id;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.deptPill, isSel && styles.deptPillActive]}
                          onPress={() => setSelectedDeptId(d.id)}
                        >
                          <Text style={[styles.deptPillText, isSel && styles.deptPillTextActive]}>
                            {d.department_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Team Presence Members Grid */}
                {loadingTeam ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Loading presence board...</Text>
                  </View>
                ) : filteredTeamMembers.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Users size={32} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No Members Found</Text>
                    <Text style={styles.emptySubtitle}>
                      No active colleagues match your search criteria.
                    </Text>
                  </View>
                ) : (
                  filteredTeamMembers.map((member) => {
                    const isWorking = member.liveStatus === 'CLOCKED_IN';
                    const onBreak = member.liveStatus === 'ON_BREAK';
                    const isOut = member.liveStatus === 'CLOCKED_OUT';

                    return (
                      <View key={member.user_id} style={styles.memberCard}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>
                            {(member.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          <Text style={styles.memberDept}>
                            {member.department_name || 'Staff'} • {member.totalWorkHours}h today
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.memberStatusPill,
                            isWorking && styles.statusPillGreen,
                            onBreak && styles.statusPillAmber,
                            isOut && styles.statusPillGray,
                            !isWorking && !onBreak && !isOut && styles.statusPillRed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.memberStatusText,
                              isWorking && styles.statusTextGreen,
                              onBreak && styles.statusTextAmber,
                              isOut && styles.statusTextGray,
                              !isWorking && !onBreak && !isOut && styles.statusTextRed,
                            ]}
                          >
                            {member.liveStatus.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            )}

            {teamSubTab === 'schedules' && (
              <>
                <Text style={styles.sectionHeaderTitle}>Company Shift Schedules</Text>
                {loadingTeam ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                  </View>
                ) : schedules.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Briefcase size={32} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No Schedules Configured</Text>
                  </View>
                ) : (
                  schedules.map((s) => (
                    <View key={s.id} style={styles.scheduleCard}>
                      <View style={styles.scheduleHeaderRow}>
                        <Text style={styles.scheduleName}>{s.name}</Text>
                        {Boolean(s.is_default) && (
                          <View style={styles.defaultPill}>
                            <Text style={styles.defaultPillText}>DEFAULT SHIFT</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.scheduleGrid}>
                        <View style={styles.scheduleGridItem}>
                          <Text style={styles.schedItemLabel}>Start Time</Text>
                          <Text style={styles.schedItemVal}>{s.start_time?.slice(0, 5)}</Text>
                        </View>
                        <View style={styles.scheduleGridItem}>
                          <Text style={styles.schedItemLabel}>End Time</Text>
                          <Text style={styles.schedItemVal}>{s.end_time?.slice(0, 5)}</Text>
                        </View>
                        <View style={styles.scheduleGridItem}>
                          <Text style={styles.schedItemLabel}>Grace Period</Text>
                          <Text style={styles.schedItemVal}>{s.grace_period_minutes ?? 15}m</Text>
                        </View>
                        <View style={styles.scheduleGridItem}>
                          <Text style={styles.schedItemLabel}>Break Allowed</Text>
                          <Text style={styles.schedItemVal}>{s.break_duration_minutes ?? 60}m</Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ────────────────────────────────────────────────────────
          MODAL 1: REQUEST ATTENDANCE REGULARIZATION
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isAdjModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAdjModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAdjModalOpen(false)}
        >
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Request Regularization</Text>
                <Text style={styles.modalSubtitle}>
                  Submit missed punch or time correction
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAdjModalOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Work Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.textInput}
                value={adjDate}
                onChangeText={setAdjDate}
                placeholder="2026-11-27"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Requested In Time *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={adjInTime}
                    onChangeText={setAdjInTime}
                    placeholder="09:00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Requested Out Time *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={adjOutTime}
                    onChangeText={setAdjOutTime}
                    placeholder="18:00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Reason / Justification *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={adjReason}
                onChangeText={setAdjReason}
                placeholder="e.g. Biometric scanner issue, client site visit, power outage..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAdjModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingAdj && styles.btnDisabled]}
                onPress={handleSubmitAdjustment}
                disabled={submittingAdj}
              >
                {submittingAdj ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL 2: REVIEW REGULARIZATION REQUEST (MANAGER)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(reviewModalItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModalItem(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setReviewModalItem(null)}
        >
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Review Attendance Request</Text>
                <Text style={styles.modalSubtitle}>
                  {reviewModalItem?.user_name} ({reviewModalItem?.department_name || 'Staff'})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalItem(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {reviewModalItem && (
              <View style={styles.modalBody}>
                <View style={styles.reviewMetaBox}>
                  <Text style={styles.reviewMetaRow}>
                    <Text style={styles.boldLabel}>Date: </Text>
                    {new Date(reviewModalItem.work_date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.reviewMetaRow}>
                    <Text style={styles.boldLabel}>Requested In/Out: </Text>
                    {reviewModalItem.requested_clock_in?.slice(0, 5)} —{' '}
                    {reviewModalItem.requested_clock_out?.slice(0, 5)}
                  </Text>
                  <Text style={styles.reviewMetaRow}>
                    <Text style={styles.boldLabel}>Reason: </Text>"{reviewModalItem.reason}"
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Reviewer Comment (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textAreaSmall]}
                  placeholder="e.g. Approved per email confirmation"
                  placeholderTextColor="#94A3B8"
                  value={reviewerComment}
                  onChangeText={setReviewerComment}
                  multiline
                />

                <View style={styles.reviewActionsRow}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, reviewingAction && styles.btnDisabled]}
                    onPress={() => handleReviewAdjustment('REJECTED')}
                    disabled={reviewingAction}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.approveBtn, reviewingAction && styles.btnDisabled]}
                    onPress={() => handleReviewAdjustment('APPROVED')}
                    disabled={reviewingAction}
                  >
                    {reviewingAction ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.approveBtnText}>Approve Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
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
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#17365D',
  },
  tabText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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

  /* Punch Hero Card */
  punchHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  punchHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  statusPillGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  statusPillAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  statusPillGray: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: {
    backgroundColor: '#10B981',
  },
  statusDotAmber: {
    backgroundColor: '#F59E0B',
  },
  statusDotGray: {
    backgroundColor: '#94A3B8',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusTextGreen: {
    color: '#047857',
  },
  statusTextAmber: {
    color: '#B45309',
  },
  statusTextGray: {
    color: '#475569',
  },
  todayDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  /* Timer Display */
  timerDisplay: {
    alignItems: 'center',
    marginVertical: 8,
  },
  timerNumbers: {
    fontSize: 34,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#0F172A',
    letterSpacing: 1,
  },
  timerLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* Location Selector */
  miniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 6,
  },
  locationSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 10,
  },
  locationOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  locationOptionActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  locationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  locationTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  notesInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    marginBottom: 14,
  },

  /* Clock Buttons */
  punchActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  clockPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  clockInBtn: {
    backgroundColor: '#059669',
  },
  clockOutBtn: {
    backgroundColor: '#DC2626',
  },
  breakBtn: {
    backgroundColor: '#D97706',
  },
  clockPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  /* Metrics Grid */
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  textBlue: {
    color: '#2563EB',
  },
  textAmber: {
    color: '#D97706',
  },
  textGreen: {
    color: '#059669',
  },

  /* Shift Card */
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  shiftTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  shiftDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  shiftCol: {
    flex: 1,
  },
  shiftSublabel: {
    fontSize: 10,
    color: '#64748B',
  },
  shiftValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  /* Request Banner */
  requestAdjCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestAdjLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  requestAdjTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  requestAdjSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 1,
  },

  /* Timeline Activity Card */
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 14,
  },
  timelineList: {
    gap: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineDotGreen: {
    backgroundColor: '#10B981',
  },
  timelineDotRed: {
    backgroundColor: '#EF4444',
  },
  timelineDotAmber: {
    backgroundColor: '#F59E0B',
  },
  timelineBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  timelineMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineEventName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timelineDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  timelineLocationBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineNotesText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1,
  },

  /* Month Navigator */
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtn: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* History Stats Grid */
  historyStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  statGreen: {
    color: '#059669',
  },
  statAmber: {
    color: '#D97706',
  },
  statSky: {
    color: '#0284C7',
  },
  statBlue: {
    color: '#2563EB',
  },
  statIndigo: {
    color: '#4F46E5',
  },

  /* History Row Card */
  historyRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDateCol: {
    width: 44,
    alignItems: 'center',
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
  },
  historyDayName: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  historyDateNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyTimeCol: {
    flex: 1,
    paddingHorizontal: 12,
  },
  historyPunchTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyPunchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  historyPunchSeparator: {
    color: '#94A3B8',
  },
  historyDurationText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  regularizedTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  historyStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPillSky: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
  },
  statusTextSky: {
    color: '#0369A1',
  },
  statusPillRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  statusTextRed: {
    color: '#B91C1C',
  },

  /* SubTabs Row */
  subTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  subTabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  subTabPillActive: {
    backgroundColor: '#17365D',
  },
  subTabPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  subTabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  newAdjBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17365D',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  newAdjBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Status Filter Chips */
  statusFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },

  /* Adjustment Card */
  adjCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adjCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  adjEmployeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  adjWorkDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  adjStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adjStatusPending: {
    backgroundColor: '#FEF3C7',
  },
  adjStatusApproved: {
    backgroundColor: '#D1FAE5',
  },
  adjStatusRejected: {
    backgroundColor: '#FEE2E2',
  },
  adjStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  adjTextPending: {
    color: '#92400E',
  },
  adjTextApproved: {
    color: '#065F46',
  },
  adjTextRejected: {
    color: '#991B1B',
  },
  adjHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  adjHoursLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  adjHoursValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  adjReasonText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  reviewerCommentBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  reviewerCommentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  reviewerCommentText: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
    marginTop: 10,
  },
  reviewBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Search & Dept Filters */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  deptFilterScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  deptPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deptPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  deptPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  deptPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Member Card */
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  memberDept: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  memberStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },

  /* Schedule Cards */
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  defaultPill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  scheduleGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
  },
  scheduleGridItem: {
    flex: 1,
    alignItems: 'center',
  },
  schedItemLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  schedItemVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalBody: {
    gap: 12,
  },
  modalBodyScroll: {
    maxHeight: 380,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    height: 60,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputCol: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#17365D',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Review Modal Details */
  reviewMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  reviewMetaRow: {
    fontSize: 12,
    color: '#334155',
  },
  boldLabel: {
    fontWeight: '700',
    color: '#0F172A',
  },
  reviewActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Loading & Empty */
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 240,
  },
});
