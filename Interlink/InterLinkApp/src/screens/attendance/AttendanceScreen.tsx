import React, { useState, useEffect, useCallback } from 'react';
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
  Users,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Building,
  Home,
  Navigation,
  FileEdit,
  ArrowRight,
  X,
  ChevronLeft,
  ChevronRight,
  Briefcase,
} from 'lucide-react-native';
import { AppHeader } from '../../components/common/AppHeader';
import {
  getTodayAttendance,
  recordClockEvent,
  getAttendanceHistory,
  getWorkSchedules,
  getTeamAttendanceBoard,
  requestAttendanceAdjustment,
  AttendanceTodayData,
  AttendanceHistoryData,
  WorkScheduleItem,
  TeamBoardMember,
} from '../../api/attendanceApi';
import { theme } from '../../constants/theme';

export const AttendanceScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'team'>('today');

  // Today Tab State
  const [todayData, setTodayData] = useState<AttendanceTodayData | null>(null);
  const [_loadingToday, setLoadingToday] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [locationType, setLocationType] = useState<'OFFICE' | 'REMOTE' | 'FIELD'>('OFFICE');
  const [clockNotes, setClockNotes] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // History Tab State
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [historyData, setHistoryData] = useState<AttendanceHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Team & Shifts Tab State
  const [schedules, setSchedules] = useState<WorkScheduleItem[]>([]);
  const [teamBoard, setTeamBoard] = useState<TeamBoardMember[]>([]);
  const [_loadingTeam, setLoadingTeam] = useState(false);

  // Regularization Modal State
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjDate, setAdjDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjInTime, setAdjInTime] = useState('09:00');
  const [adjOutTime, setAdjOutTime] = useState('18:00');
  const [adjReason, setAdjReason] = useState('');
  const [submittingAdj, setSubmittingAdj] = useState(false);

  // 1. Fetch Today Status
  const fetchToday = useCallback(async () => {
    try {
      setLoadingToday(true);
      const res = await getTodayAttendance();
      if (res.success && res.data?.data) {
        setTodayData(res.data.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingToday(false);
    }
  }, []);

  // 2. Fetch Monthly History
  const fetchHistory = useCallback(async (month: string) => {
    try {
      setLoadingHistory(true);
      const res = await getAttendanceHistory({ month });
      if (res.success && res.data?.data) {
        setHistoryData(res.data.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // 3. Fetch Team & Schedules
  const fetchTeamAndSchedules = useCallback(async () => {
    try {
      setLoadingTeam(true);
      const [schedRes, teamRes] = await Promise.all([
        getWorkSchedules().catch(() => null),
        getTeamAttendanceBoard().catch(() => null),
      ]);
      if (schedRes?.success && schedRes.data?.schedules) {
        setSchedules(schedRes.data.schedules);
      }
      if (teamRes?.success && teamRes.data?.board) {
        setTeamBoard(teamRes.data.board);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingTeam(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(selectedMonth);
    } else if (activeTab === 'team') {
      fetchTeamAndSchedules();
    }
  }, [activeTab, selectedMonth, fetchHistory, fetchTeamAndSchedules]);

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

  // Clock Event Action
  const handleClockAction = async (eventType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    try {
      setClocking(true);
      const res = await recordClockEvent({
        event_type: eventType,
        location_type: locationType,
        notes: clockNotes.trim() || undefined,
      });

      if (res.success) {
        const labels: Record<string, string> = {
          clock_in: 'Clocked In Successfully!',
          clock_out: 'Clocked Out Successfully!',
          break_start: 'Break Started',
          break_end: 'Break Ended - Welcome Back',
        };
        Alert.alert('Status Updated', labels[eventType] || 'Clock recorded.');
        setClockNotes('');
        fetchToday();
      } else {
        Alert.alert('Notice', res.message || 'Clock action failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record clocking');
    } finally {
      setClocking(false);
    }
  };

  // Submit Regularization Request
  const handleSubmitAdjustment = async () => {
    if (!adjReason.trim()) {
      Alert.alert('Required', 'Please provide a valid reason for regularization.');
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
        Alert.alert('Success', 'Attendance regularization request submitted to your manager.');
        setIsAdjModalOpen(false);
        setAdjReason('');
        if (activeTab === 'history') fetchHistory(selectedMonth);
      } else {
        Alert.alert('Notice', res.message || 'Request submission failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Submission failed');
    } finally {
      setSubmittingAdj(false);
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

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Attendance & Shifts"
        onBackPress={() => navigation.goBack()}
        showBack
      />

      {/* Primary Sub Tabs */}
      <View style={styles.tabsHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
          onPress={() => setActiveTab('today')}
        >
          <Clock size={14} color={activeTab === 'today' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>
            Today Punch
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => setActiveTab('history')}
        >
          <Calendar size={14} color={activeTab === 'history' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History & Log
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'team' && styles.tabButtonActive]}
          onPress={() => setActiveTab('team')}
        >
          <Users size={14} color={activeTab === 'team' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'team' && styles.tabTextActive]}>
            Team & Shifts
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
        {/* ========================================================================= */}
        {/* 1. TODAY'S PUNCH TAB */}
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
                      ? 'CLOCKED IN & WORKING'
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
                  {isClockedIn ? formatStopwatch(elapsedSeconds) : '00:00:00'}
                </Text>
                <Text style={styles.timerLabel}>Total Hours Logged Today</Text>
              </View>

              {/* Location Selector */}
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
                    Remote
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.locationOption,
                    locationType === 'FIELD' && styles.locationOptionActive,
                  ]}
                  onPress={() => setLocationType('FIELD')}
                >
                  <Navigation size={14} color={locationType === 'FIELD' ? '#FFFFFF' : '#475569'} />
                  <Text
                    style={[
                      styles.locationText,
                      locationType === 'FIELD' && styles.locationTextActive,
                    ]}
                  >
                    Field
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Primary Clock Buttons */}
              <View style={styles.punchActionRow}>
                {!isClockedIn && !isOnBreak ? (
                  <TouchableOpacity
                    style={[styles.clockPrimaryBtn, styles.clockInBtn, clocking && styles.btnDisabled]}
                    onPress={() => handleClockAction('clock_in')}
                    disabled={clocking}
                    activeOpacity={0.85}
                  >
                    {clocking ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Clock size={18} color="#FFFFFF" />
                        <Text style={styles.clockPrimaryText}>Clock In</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.clockPrimaryBtn, styles.clockOutBtn, clocking && styles.btnDisabled]}
                    onPress={() => handleClockAction('clock_out')}
                    disabled={clocking}
                    activeOpacity={0.85}
                  >
                    {clocking ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} color="#FFFFFF" />
                        <Text style={styles.clockPrimaryText}>Clock Out</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Break Controls */}
                {isClockedIn && (
                  <TouchableOpacity
                    style={[styles.breakBtn, clocking && styles.btnDisabled]}
                    onPress={() => handleClockAction('break_start')}
                    disabled={clocking}
                  >
                    <Coffee size={16} color="#D97706" />
                    <Text style={styles.breakBtnText}>Take Break</Text>
                  </TouchableOpacity>
                )}

                {isOnBreak && (
                  <TouchableOpacity
                    style={[styles.breakResumeBtn, clocking && styles.btnDisabled]}
                    onPress={() => handleClockAction('break_end')}
                    disabled={clocking}
                  >
                    <Coffee size={16} color="#FFFFFF" />
                    <Text style={styles.breakResumeText}>Resume Work</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Today's Summary Metrics Row */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>First Punch In</Text>
                <Text style={styles.metricValue}>
                  {todayData?.summary?.in_time
                    ? new Date(todayData.summary.in_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Last Punch Out</Text>
                <Text style={styles.metricValue}>
                  {todayData?.summary?.out_time
                    ? new Date(todayData.summary.out_time).toLocaleTimeString([], {
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
                <Text style={styles.metricLabel}>Break Mins</Text>
                <Text style={[styles.metricValue, styles.textAmber]}>
                  {todayData?.summary?.total_break_minutes || 0}m
                </Text>
              </View>
            </View>

            {/* Shift Details Card */}
            <View style={styles.shiftCard}>
              <View style={styles.shiftHeader}>
                <Briefcase size={16} color="#17365D" />
                <Text style={styles.shiftTitle}>Assigned Work Schedule</Text>
              </View>
              <View style={styles.shiftDetailsRow}>
                <View style={styles.shiftCol}>
                  <Text style={styles.shiftSublabel}>Shift Name</Text>
                  <Text style={styles.shiftValue}>{todayData?.shift?.name || 'General Standard'}</Text>
                </View>
                <View style={styles.shiftCol}>
                  <Text style={styles.shiftSublabel}>Working Window</Text>
                  <Text style={styles.shiftValue}>
                    {todayData?.shift?.start_time || '09:00'} - {todayData?.shift?.end_time || '18:00'}
                  </Text>
                </View>
                <View style={styles.shiftCol}>
                  <Text style={styles.shiftSublabel}>Grace Period</Text>
                  <Text style={styles.shiftValue}>
                    {todayData?.shift?.grace_period_mins || 15} mins
                  </Text>
                </View>
              </View>
            </View>

            {/* Request Regularization Action */}
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
          </View>
        )}

        {/* ========================================================================= */}
        {/* 2. MONTHLY HISTORY TAB */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <View style={styles.tabContentWrap}>
            {/* Month Navigator */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => changeMonth(-1)}
              >
                <ChevronLeft size={18} color="#17365D" />
              </TouchableOpacity>
              <Text style={styles.monthNavTitle}>
                {new Date(selectedMonth + '-01').toLocaleDateString([], {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() => changeMonth(1)}
              >
                <ChevronRight size={18} color="#17365D" />
              </TouchableOpacity>
            </View>

            {/* Monthly Stats Summary Row */}
            <View style={styles.historyStatsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.present_days ?? 0}</Text>
                <Text style={[styles.statLabel, styles.statGreen]}>Present</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.late_days ?? 0}</Text>
                <Text style={[styles.statLabel, styles.statAmber]}>Late</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.half_days ?? 0}</Text>
                <Text style={[styles.statLabel, styles.statSky]}>Half Day</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.absent_days ?? 0}</Text>
                <Text style={[styles.statLabel, styles.statRed]}>Absent</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statNum}>{historyData?.stats?.total_work_hours ?? 0}h</Text>
                <Text style={[styles.statLabel, styles.statBlue]}>Total Hrs</Text>
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
              historyData.records.map((r) => {
                const isPresent = r.status === 'PRESENT';
                const isLate = r.status === 'LATE';
                const isHalfDay = r.status === 'HALF_DAY';
                const isAbsent = r.status === 'ABSENT';

                return (
                  <View key={r.id || r.work_date} style={styles.historyRowCard}>
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
                          In: {r.clock_in ? r.clock_in.slice(0, 5) : '--:--'}
                        </Text>
                        <Text style={styles.historyPunchSeparator}>•</Text>
                        <Text style={styles.historyPunchText}>
                          Out: {r.clock_out ? r.clock_out.slice(0, 5) : '--:--'}
                        </Text>
                      </View>
                      <Text style={styles.historyDurationText}>
                        Total: {Math.round((r.total_work_minutes || 0) / 60 * 10) / 10} hrs
                      </Text>
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
        {/* 3. TEAM & SHIFTS TAB */}
        {/* ========================================================================= */}
        {activeTab === 'team' && (
          <View style={styles.tabContentWrap}>
            {/* Work Schedules Section */}
            <Text style={styles.sectionHeaderTitle}>Organization Shifts</Text>
            {schedules.map((s) => (
              <View key={s.id} style={styles.scheduleCard}>
                <View style={styles.scheduleHeaderRow}>
                  <Text style={styles.scheduleName}>{s.name}</Text>
                  {s.is_default && (
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultPillText}>DEFAULT</Text>
                    </View>
                  )}
                </View>
                <View style={styles.scheduleGrid}>
                  <View style={styles.scheduleGridItem}>
                    <Text style={styles.schedItemLabel}>Start Time</Text>
                    <Text style={styles.schedItemVal}>{s.start_time}</Text>
                  </View>
                  <View style={styles.scheduleGridItem}>
                    <Text style={styles.schedItemLabel}>End Time</Text>
                    <Text style={styles.schedItemVal}>{s.end_time}</Text>
                  </View>
                  <View style={styles.scheduleGridItem}>
                    <Text style={styles.schedItemLabel}>Grace Window</Text>
                    <Text style={styles.schedItemVal}>{s.grace_period_minutes ?? 15}m</Text>
                  </View>
                  <View style={styles.scheduleGridItem}>
                    <Text style={styles.schedItemLabel}>Full Day</Text>
                    <Text style={styles.schedItemVal}>{s.full_day_hours ?? 8}h</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Team Live Status Section */}
            <Text style={[styles.sectionHeaderTitle, styles.mt16]}>
              Team Live Status ({teamBoard.length})
            </Text>
            {teamBoard.map((member) => {
              const isWorking = member.status === 'CLOCKED_IN';
              const onBreak = member.status === 'ON_BREAK';

              return (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberDept}>
                      {member.department_name || 'All Departments'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.memberStatusPill,
                      isWorking && styles.statusPillGreen,
                      onBreak && styles.statusPillAmber,
                      !isWorking && !onBreak && styles.statusPillGray,
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberStatusText,
                        isWorking && styles.statusTextGreen,
                        onBreak && styles.statusTextAmber,
                        !isWorking && !onBreak && styles.statusTextGray,
                      ]}
                    >
                      {member.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Regularization / Adjustment Modal */}
      <Modal
        visible={isAdjModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAdjModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Work Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={adjDate}
                onChangeText={setAdjDate}
                placeholder="2026-11-25"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Requested In Time</Text>
                  <TextInput
                    style={styles.textInput}
                    value={adjInTime}
                    onChangeText={setAdjInTime}
                    placeholder="09:00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Requested Out Time</Text>
                  <TextInput
                    style={styles.textInput}
                    value={adjOutTime}
                    onChangeText={setAdjOutTime}
                    placeholder="18:00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>
                Reason for Adjustment <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={adjReason}
                onChangeText={setAdjReason}
                placeholder="Forgot to swipe / on-site client visit..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

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

  /* Punch Hero Card */
  punchHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  punchHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
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
    borderColor: '#CBD5E1',
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    fontWeight: theme.typography.weights.bold,
  },
  statusTextGreen: {
    color: '#047857',
  },
  statusTextAmber: {
    color: '#B45309',
  },
  statusTextGray: {
    color: '#64748B',
  },
  todayDateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: theme.typography.weights.medium,
  },
  timerDisplay: {
    alignItems: 'center',
    marginVertical: 12,
  },
  timerNumbers: {
    fontSize: 38,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  locationSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 6,
    width: '100%',
    marginVertical: 12,
  },
  locationOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  locationOptionActive: {
    backgroundColor: '#17365D',
  },
  locationText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: theme.typography.weights.semibold,
  },
  locationTextActive: {
    color: '#FFFFFF',
  },
  punchActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 6,
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
  clockPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
  },
  breakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  breakBtnText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  breakResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#D97706',
    gap: 6,
  },
  breakResumeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  /* Metrics Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  textBlue: {
    color: '#2563EB',
  },
  textAmber: {
    color: '#D97706',
  },

  /* Shift Card */
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shiftTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  shiftDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shiftCol: {
    flex: 1,
  },
  shiftSublabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  shiftValue: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: '#1E293B',
    marginTop: 2,
  },

  /* Request Regularization Action */
  requestAdjCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  requestAdjLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestAdjTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  requestAdjSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* Month Navigator */
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtn: {
    padding: 6,
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#17365D',
  },

  /* History Stats Grid */
  historyStatsGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    marginTop: 2,
  },
  statGreen: { color: '#10B981' },
  statAmber: { color: '#F59E0B' },
  statSky: { color: '#0284C7' },
  statRed: { color: '#EF4444' },
  statBlue: { color: '#2563EB' },

  /* History Row Card */
  historyRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyDateCol: {
    alignItems: 'center',
    width: 44,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
  },
  historyDayName: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  historyDateNum: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
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
    fontWeight: theme.typography.weights.semibold,
    color: '#1E293B',
  },
  historyPunchSeparator: {
    color: '#CBD5E1',
  },
  historyDurationText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  statusPillSky: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
  },
  statusPillRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  statusTextSky: {
    color: '#0284C7',
  },
  statusTextRed: {
    color: '#DC2626',
  },

  /* Team & Shifts */
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  mt16: {
    marginTop: 16,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  defaultPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultPillText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#4338CA',
  },
  scheduleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scheduleGridItem: {
    flex: 1,
  },
  schedItemLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  schedItemVal: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#1E293B',
    marginTop: 2,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
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
    borderRadius: 8,
  },
  memberStatusText: {
    fontSize: 10,
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
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
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputCol: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
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
});
