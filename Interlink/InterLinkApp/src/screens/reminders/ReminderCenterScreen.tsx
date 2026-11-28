import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  RefreshControl,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Clock,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Search,
  ChevronRight,
  MoreVertical,
  Trash2,
  ArrowUpRight,
  Check,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import {
  getReminders,
  getReminderMetrics,
  createReminder,
  snoozeReminder,
  completeReminder,
  dismissReminder,
  escalateReminder,
  deleteReminder,
  getReminderPreferences,
  updateReminderPreferences,
  ReminderItem,
  ReminderMetrics,
  ReminderPreferences,
  CreateReminderPayload,
} from '../../api/reminderApi';

type ReminderStatusTab = 'all' | 'overdue' | 'today' | 'upcoming' | 'snoozed' | 'completed';

const STATUS_TABS: Array<{ key: ReminderStatusTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'completed', label: 'Completed' },
];

const SOURCE_OPTIONS = [
  { id: 'all', label: 'All Modules' },
  { id: 'personal', label: 'Personal' },
  { id: 'task', label: 'Tasks' },
  { id: 'project', label: 'Projects' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'approval', label: 'Approvals' },
];

const SNOOZE_PRESETS = [
  { label: '15 Minutes', minutes: 15 },
  { label: '1 Hour', minutes: 60 },
  { label: '3 Hours', minutes: 180 },
  { label: 'Tomorrow 9 AM', minutes: -1 }, // special flag
];

// Helper: format YYYY-MM-DD
const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper: format friendly time display
const formatFriendlyTime = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = toDateStr(d) === toDateStr(now);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Today at ${time}`;
    }
    const isTomorrow =
      toDateStr(d) === toDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    if (isTomorrow) {
      return `Tomorrow at ${time}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  } catch {
    return isoString;
  }
};

export const ReminderCenterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const initialOpenCreate = route.params?.openCreate;

  // Filter states
  const [activeTab, setActiveTab] = useState<ReminderStatusTab>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [metrics, setMetrics] = useState<ReminderMetrics>({
    overdue_count: 0,
    today_count: 0,
    snoozed_count: 0,
    upcoming_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(Boolean(initialOpenCreate));
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [snoozeModalTarget, setSnoozeModalTarget] = useState<ReminderItem | null>(null);
  const [actionSheetTarget, setActionSheetTarget] = useState<ReminderItem | null>(null);

  // Create Reminder Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSourceType, setNewSourceType] = useState('personal');
  const [newTriggerDate, setNewTriggerDate] = useState(toDateStr(new Date()));
  const [newTriggerTime, setNewTriggerTime] = useState('10:00');
  const [newEscalationEnabled, setNewEscalationEnabled] = useState(false);
  const [submittingReminder, setSubmittingReminder] = useState(false);

  // Preferences State
  const [prefs, setPrefs] = useState<ReminderPreferences>({
    channel_in_app: true,
    channel_push: true,
    channel_email: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    timezone: 'UTC',
  });
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // 1. Fetch Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await getReminderMetrics();
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error('Failed to load reminder metrics:', err);
    }
  }, []);

  // 2. Fetch Reminders
  const fetchRemindersList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getReminders({
        status: activeTab,
        sourceType: sourceTypeFilter !== 'all' ? sourceTypeFilter : undefined,
      });
      if (res.success && Array.isArray(res.data)) {
        setReminders(res.data);
      } else {
        setReminders([]);
      }
    } catch (err) {
      console.error('Failed to load reminders:', err);
      setReminders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, sourceTypeFilter]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchRemindersList();
  }, [fetchRemindersList]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
    fetchRemindersList();
  };

  // Actions
  const handleComplete = async (id: number) => {
    try {
      const res = await completeReminder(id);
      if (res.success) {
        Alert.alert('Done', 'Reminder marked as completed');
        fetchRemindersList();
        fetchMetrics();
      }
    } catch {
      Alert.alert('Notice', 'Failed to complete reminder');
    }
  };

  const handleSnooze = async (id: number, minutes: number) => {
    try {
      let snoozeDate: Date;
      if (minutes === -1) {
        // Tomorrow at 9:00 AM
        const now = new Date();
        snoozeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
      } else {
        snoozeDate = new Date(Date.now() + minutes * 60 * 1000);
      }

      const res = await snoozeReminder(id, {
        snoozeUntil: snoozeDate.toISOString(),
      });

      if (res.success) {
        Alert.alert('Snoozed', `Reminder snoozed until ${formatFriendlyTime(snoozeDate.toISOString())}`);
        setSnoozeModalTarget(null);
        fetchRemindersList();
        fetchMetrics();
      }
    } catch {
      Alert.alert('Notice', 'Failed to snooze reminder');
    }
  };

  const handleDismiss = async (id: number) => {
    try {
      const res = await dismissReminder(id);
      if (res.success) {
        Alert.alert('Dismissed', 'Reminder dismissed');
        setActionSheetTarget(null);
        fetchRemindersList();
        fetchMetrics();
      }
    } catch {
      Alert.alert('Notice', 'Failed to dismiss reminder');
    }
  };

  const handleEscalate = async (id: number) => {
    try {
      const res = await escalateReminder(id);
      if (res.success) {
        Alert.alert('Escalated', 'Reminder escalated to your manager');
        setActionSheetTarget(null);
        fetchRemindersList();
        fetchMetrics();
      }
    } catch {
      Alert.alert('Notice', 'Failed to escalate reminder');
    }
  };

  const handleDelete = (id: number, title: string) => {
    Alert.alert('Delete Reminder', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteReminder(id);
            if (res.success) {
              setActionSheetTarget(null);
              fetchRemindersList();
              fetchMetrics();
            }
          } catch {
            Alert.alert('Notice', 'Could not delete reminder');
          }
        },
      },
    ]);
  };

  // Create Reminder
  const handleCreateReminder = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required', 'Please enter a reminder title');
      return;
    }

    try {
      setSubmittingReminder(true);
      const triggerAt = `${newTriggerDate} ${newTriggerTime}:00`;

      const payload: CreateReminderPayload = {
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        source_type: newSourceType,
        trigger_at: triggerAt,
        escalation_enabled: newEscalationEnabled,
      };

      const res = await createReminder(payload);
      if (res.success) {
        Alert.alert('Success', 'Reminder scheduled successfully!');
        setIsCreateModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        fetchRemindersList();
        fetchMetrics();
      } else {
        Alert.alert('Notice', res.message || 'Failed to schedule reminder');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create reminder');
    } finally {
      setSubmittingReminder(false);
    }
  };

  // Open Preferences Modal
  const handleOpenPreferences = async () => {
    setIsPreferencesOpen(true);
    try {
      setLoadingPrefs(true);
      const res = await getReminderPreferences();
      if (res.success && res.data) {
        setPrefs(res.data);
      }
    } catch {
      // quiet
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true);
      const res = await updateReminderPreferences(prefs);
      if (res.success) {
        Alert.alert('Preferences Saved', 'Your reminder preferences have been updated');
        setIsPreferencesOpen(false);
      } else {
        Alert.alert('Notice', 'Could not save preferences');
      }
    } catch {
      Alert.alert('Notice', 'Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Client-side search filtering
  const filteredReminders = useMemo(() => {
    if (!searchQuery.trim()) return reminders;
    const q = searchQuery.toLowerCase().trim();
    return reminders.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [reminders, searchQuery]);

  // Source Type Badge Details
  const getSourceBadge = (sourceType: string) => {
    switch (sourceType?.toLowerCase()) {
      case 'task':
        return { label: 'TASK', bg: '#DCFCE7', text: '#15803D' };
      case 'project':
        return { label: 'PROJECT', bg: '#EDE9FE', text: '#7C3AED' };
      case 'meeting':
        return { label: 'MEETING', bg: '#E0F2FE', text: '#0284C7' };
      case 'approval':
        return { label: 'APPROVAL', bg: '#FEF3C7', text: '#B45309' };
      default:
        return { label: 'PERSONAL', bg: '#EFF6FF', text: '#2563EB' };
    }
  };

  // Status Badge Details
  const getStatusBadge = (status: string, triggerAt: string) => {
    const isOverdue =
      status === 'pending' && new Date(triggerAt).getTime() < Date.now();

    if (isOverdue) {
      return { label: 'OVERDUE', bg: '#FEF2F2', text: '#DC2626' };
    }
    switch (status?.toLowerCase()) {
      case 'snoozed':
        return { label: 'SNOOZED', bg: '#FFFBEB', text: '#D97706' };
      case 'completed':
        return { label: 'COMPLETED', bg: '#F0FDF4', text: '#16A34A' };
      case 'dismissed':
        return { label: 'DISMISSED', bg: '#F1F5F9', text: '#64748B' };
      case 'escalated':
        return { label: 'ESCALATED', bg: '#FAF5FF', text: '#9333EA' };
      default:
        return { label: 'PENDING', bg: '#EFF6FF', text: '#2563EB' };
    }
  };

  return (
    <ScreenWrapper
      dark={false}
      edges={['left', 'right']}
      statusBarStyle="light-content"
    >
      {/* ────────────────────────────────────────────────────────
          HEADER
      ──────────────────────────────────────────────────────── */}
      <AppHeader
        title="Reminder Center"
        showBack={true}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={styles.mainScrollContent}
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
            TOP ACTION BUTTONS (+ NEW REMINDER & PREFERENCES)
        ──────────────────────────────────────────────────────── */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={styles.newReminderBtn}
            activeOpacity={0.8}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.newReminderBtnText}>New Reminder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.preferencesBtn}
            activeOpacity={0.8}
            onPress={handleOpenPreferences}
          >
            <Sliders size={15} color="#17365D" />
            <Text style={styles.preferencesBtnText}>Preferences</Text>
          </TouchableOpacity>
        </View>

        {/* ────────────────────────────────────────────────────────
            METRIC SUMMARY CARDS (OVERDUE, TODAY, SNOOZED, UPCOMING)
        ──────────────────────────────────────────────────────── */}
        <View style={styles.metricsGrid}>
          {/* Overdue Card */}
          <TouchableOpacity
            style={[
              styles.metricCard,
              activeTab === 'overdue' && styles.metricCardActiveOverdue,
            ]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('overdue')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricCardLabelOverdue}>Overdue</Text>
              <AlertTriangle size={13} color="#DC2626" />
            </View>
            <Text style={styles.metricCardCountOverdue}>{metrics.overdue_count}</Text>
          </TouchableOpacity>

          {/* Today Card */}
          <TouchableOpacity
            style={[
              styles.metricCard,
              activeTab === 'today' && styles.metricCardActiveToday,
            ]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('today')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricCardLabelToday}>Today</Text>
              <Clock size={13} color="#2563EB" />
            </View>
            <Text style={styles.metricCardCountToday}>{metrics.today_count}</Text>
          </TouchableOpacity>

          {/* Snoozed Card */}
          <TouchableOpacity
            style={[
              styles.metricCard,
              activeTab === 'snoozed' && styles.metricCardActiveSnoozed,
            ]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('snoozed')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricCardLabelSnoozed}>Snoozed</Text>
              <Bell size={13} color="#D97706" />
            </View>
            <Text style={styles.metricCardCountSnoozed}>{metrics.snoozed_count}</Text>
          </TouchableOpacity>

          {/* Upcoming Card */}
          <TouchableOpacity
            style={[
              styles.metricCard,
              activeTab === 'upcoming' && styles.metricCardActiveUpcoming,
            ]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('upcoming')}
          >
            <View style={styles.metricCardHeader}>
              <Text style={styles.metricCardLabelUpcoming}>Upcoming</Text>
              <Calendar size={13} color="#16A34A" />
            </View>
            <Text style={styles.metricCardCountUpcoming}>{metrics.upcoming_count}</Text>
          </TouchableOpacity>
        </View>

        {/* ────────────────────────────────────────────────────────
            STATUS TABS BAR (ALL, OVERDUE, TODAY, UPCOMING...)
        ──────────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusTabsScroll}
          contentContainerStyle={styles.statusTabsContent}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.statusTabPill, isActive && styles.statusTabPillActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusTabPillText,
                    isActive && styles.statusTabPillTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ────────────────────────────────────────────────────────
            SEARCH & SOURCE FILTER BAR
        ──────────────────────────────────────────────────────── */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInputWrap}>
            <Search size={15} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search reminders by title..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Module Source Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sourceChipsScroll}
          contentContainerStyle={styles.sourceChipsContent}
        >
          {SOURCE_OPTIONS.map((opt) => {
            const isSelected = sourceTypeFilter === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.sourceChip,
                  isSelected && styles.sourceChipActive,
                ]}
                onPress={() => setSourceTypeFilter(opt.id)}
              >
                <Text
                  style={[
                    styles.sourceChipText,
                    isSelected && styles.sourceChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ────────────────────────────────────────────────────────
            REMINDERS LIST
        ──────────────────────────────────────────────────────── */}
        <View style={styles.remindersListWrap}>
          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#17365D" />
              <Text style={styles.loadingText}>Loading reminders...</Text>
            </View>
          ) : filteredReminders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Bell size={36} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No reminders found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No reminders matched your search query.'
                  : activeTab !== 'all'
                  ? `No ${activeTab} reminders right now.`
                  : 'You have no scheduled reminders.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyCreateBtn}
                onPress={() => setIsCreateModalOpen(true)}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.emptyCreateBtnText}>Create Reminder</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredReminders.map((item) => {
              const srcBadge = getSourceBadge(item.source_type);
              const statBadge = getStatusBadge(item.status, item.trigger_at);
              const isCompleted = item.status === 'completed';

              return (
                <View key={item.id} style={styles.reminderCard}>
                  {/* Card Header: Source & Status */}
                  <View style={styles.reminderCardHeader}>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: srcBadge.bg }]}>
                        <Text style={[styles.badgeText, { color: srcBadge.text }]}>
                          {srcBadge.label}
                        </Text>
                      </View>

                      <View style={[styles.badge, { backgroundColor: statBadge.bg }]}>
                        <Text style={[styles.badgeText, { color: statBadge.text }]}>
                          {statBadge.label}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => setActionSheetTarget(item)}
                      style={styles.moreBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MoreVertical size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Card Title & Description */}
                  <Text
                    style={[
                      styles.reminderTitle,
                      isCompleted && styles.reminderTitleCompleted,
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  {item.description ? (
                    <Text style={styles.reminderDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Trigger Time / Snooze Info */}
                  <View style={styles.timeRow}>
                    <Clock size={12} color="#64748B" />
                    <Text style={styles.timeText}>
                      {item.status === 'snoozed' && item.snooze_until
                        ? `Snoozed until: ${formatFriendlyTime(item.snooze_until)}`
                        : `Trigger: ${formatFriendlyTime(item.trigger_at)}`}
                    </Text>
                  </View>

                  {/* Escalation Tag */}
                  {Boolean(item.escalation_enabled) && (
                    <View style={styles.escalationTagRow}>
                      <ArrowUpRight size={11} color="#7C3AED" />
                      <Text style={styles.escalationTagText}>
                        Escalation to Lead Enabled
                      </Text>
                    </View>
                  )}

                  {/* Card Quick Actions Footer */}
                  {!isCompleted && (
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.completeBtn}
                        activeOpacity={0.8}
                        onPress={() => handleComplete(item.id)}
                      >
                        <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.completeBtnText}>Complete</Text>
                      </TouchableOpacity>

                      {/* <TouchableOpacity
                        style={styles.snoozeBtn}
                        activeOpacity={0.8}
                        onPress={() => setSnoozeModalTarget(item)}
                      >
                        <Clock size={13} color="#D97706" />
                        <Text style={styles.snoozeBtnText}>Snooze</Text>
                      </TouchableOpacity> */}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ────────────────────────────────────────────────────────
          MODAL 1: CREATE REMINDER
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isCreateModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCreateModalOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Create Reminder</Text>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Submit Quarterly Budget, Review PR..."
                placeholderTextColor="#94A3B8"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {/* Source Type Pills */}
              <Text style={styles.formLabel}>Source Category</Text>
              <View style={styles.formPillsRow}>
                {['personal', 'task', 'project', 'meeting', 'approval'].map((src) => {
                  const isSelected = newSourceType === src;
                  return (
                    <TouchableOpacity
                      key={src}
                      style={[styles.formPill, isSelected && styles.formPillActive]}
                      onPress={() => setNewSourceType(src)}
                    >
                      <Text
                        style={[
                          styles.formPillText,
                          isSelected && styles.formPillTextActive,
                        ]}
                      >
                        {src.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Quick Preset Buttons */}
             

              {/* Date & Time Input Grid */}
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.formLabel}>Trigger Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="2026-11-27"
                    placeholderTextColor="#94A3B8"
                    value={newTriggerDate}
                    onChangeText={setNewTriggerDate}
                  />
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.formLabel}>Trigger Time (HH:mm)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="10:00"
                    placeholderTextColor="#94A3B8"
                    value={newTriggerTime}
                    onChangeText={setNewTriggerTime}
                  />
                </View>
              </View>

              {/* Description */}
              <Text style={styles.formLabel}>Notes / Description</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMultiline]}
                placeholder="Optional details, instructions or links..."
                placeholderTextColor="#94A3B8"
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              {/* Escalation Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfoCol}>
                  <Text style={styles.toggleTitle}>Escalate to Manager</Text>
                  <Text style={styles.toggleSubtitle}>
                    Notify lead/manager if reminder remains unacknowledged
                  </Text>
                </View>
                <Switch
                  value={newEscalationEnabled}
                  onValueChange={setNewEscalationEnabled}
                  trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                  thumbColor={newEscalationEnabled ? '#2563EB' : '#F1F5F9'}
                />
              </View>
            </ScrollView>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                submittingReminder && styles.btnDisabled,
              ]}
              onPress={handleCreateReminder}
              disabled={submittingReminder}
              activeOpacity={0.8}
            >
              {submittingReminder ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Schedule Reminder</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL 2: SNOOZE OPTIONS MODAL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(snoozeModalTarget)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSnoozeModalTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSnoozeModalTarget(null)}
        >
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Snooze Reminder</Text>
              <TouchableOpacity onPress={() => setSnoozeModalTarget(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.snoozePromptText}>
              Choose when you would like to be reminded again for:
            </Text>
            <Text style={styles.snoozeTargetTitle} numberOfLines={2}>
              "{snoozeModalTarget?.title}"
            </Text>

            <View style={styles.snoozeOptionsGrid}>
              {SNOOZE_PRESETS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.snoozeOptionCard}
                  onPress={() => {
                    if (snoozeModalTarget) {
                      handleSnooze(snoozeModalTarget.id, p.minutes);
                    }
                  }}
                >
                  <Clock size={16} color="#D97706" />
                  <Text style={styles.snoozeOptionCardText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL 3: MORE ACTIONS BOTTOM SHEET
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(actionSheetTarget)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionSheetTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionSheetTarget(null)}
        >
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Reminder Options</Text>
              <TouchableOpacity onPress={() => setActionSheetTarget(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.actionSheetTitleText} numberOfLines={1}>
              {actionSheetTarget?.title}
            </Text>

            <View style={styles.actionSheetOptionsList}>
              {/* Dismiss */}
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  if (actionSheetTarget) handleDismiss(actionSheetTarget.id);
                }}
              >
                <X size={18} color="#64748B" />
                <View style={styles.actionSheetTextCol}>
                  <Text style={styles.actionSheetItemTitle}>Dismiss</Text>
                  <Text style={styles.actionSheetItemSubtitle}>
                    Mark as dismissed without completing
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Escalate */}
              <TouchableOpacity
                style={styles.actionSheetItem}
                onPress={() => {
                  if (actionSheetTarget) handleEscalate(actionSheetTarget.id);
                }}
              >
                <ArrowUpRight size={18} color="#7C3AED" />
                <View style={styles.actionSheetTextCol}>
                  <Text style={styles.actionSheetItemTitle}>Escalate to Manager</Text>
                  <Text style={styles.actionSheetItemSubtitle}>
                    Trigger urgent alert to supervisory lead
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={[styles.actionSheetItem, styles.actionSheetItemDanger]}
                onPress={() => {
                  if (actionSheetTarget) {
                    handleDelete(actionSheetTarget.id, actionSheetTarget.title);
                  }
                }}
              >
                <Trash2 size={18} color="#EF4444" />
                <View style={styles.actionSheetTextCol}>
                  <Text style={[styles.actionSheetItemTitle, { color: '#EF4444' }]}>
                    Delete Reminder
                  </Text>
                  <Text style={styles.actionSheetItemSubtitle}>
                    Permanently delete this reminder
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL 4: PREFERENCES MODAL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isPreferencesOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPreferencesOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsPreferencesOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Reminder Preferences</Text>
              <TouchableOpacity onPress={() => setIsPreferencesOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {loadingPrefs ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#17365D" />
                <Text style={styles.loadingText}>Loading preferences...</Text>
              </View>
            ) : (
              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.prefSectionHeader}>Delivery Channels</Text>

                {/* In-App Notifications */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfoCol}>
                    <Text style={styles.toggleTitle}>In-App Notifications</Text>
                    <Text style={styles.toggleSubtitle}>Alert banners inside the app</Text>
                  </View>
                  <Switch
                    value={prefs.channel_in_app}
                    onValueChange={(val) =>
                      setPrefs((prev) => ({ ...prev, channel_in_app: val }))
                    }
                    trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                    thumbColor={prefs.channel_in_app ? '#2563EB' : '#F1F5F9'}
                  />
                </View>

                {/* Push Notifications */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfoCol}>
                    <Text style={styles.toggleTitle}>Mobile Push Alerts</Text>
                    <Text style={styles.toggleSubtitle}>System lock-screen push notifications</Text>
                  </View>
                  <Switch
                    value={prefs.channel_push}
                    onValueChange={(val) =>
                      setPrefs((prev) => ({ ...prev, channel_push: val }))
                    }
                    trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                    thumbColor={prefs.channel_push ? '#2563EB' : '#F1F5F9'}
                  />
                </View>

                {/* Email Notifications */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfoCol}>
                    <Text style={styles.toggleTitle}>Email Summaries</Text>
                    <Text style={styles.toggleSubtitle}>Send reminder emails for major milestones</Text>
                  </View>
                  <Switch
                    value={prefs.channel_email}
                    onValueChange={(val) =>
                      setPrefs((prev) => ({ ...prev, channel_email: val }))
                    }
                    trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                    thumbColor={prefs.channel_email ? '#2563EB' : '#F1F5F9'}
                  />
                </View>

                {/* Quiet Hours */}
                <Text style={styles.prefSectionHeader}>Quiet Hours (DND)</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfoCol}>
                    <Text style={styles.toggleTitle}>Enable Quiet Hours</Text>
                    <Text style={styles.toggleSubtitle}>Mute non-urgent alerts during sleep</Text>
                  </View>
                  <Switch
                    value={prefs.quiet_hours_enabled}
                    onValueChange={(val) =>
                      setPrefs((prev) => ({ ...prev, quiet_hours_enabled: val }))
                    }
                    trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                    thumbColor={prefs.quiet_hours_enabled ? '#2563EB' : '#F1F5F9'}
                  />
                </View>

                {prefs.quiet_hours_enabled && (
                  <View style={styles.gridRow}>
                    <View style={styles.gridCol}>
                      <Text style={styles.formLabel}>Start Time</Text>
                      <TextInput
                        style={styles.formInput}
                        value={prefs.quiet_hours_start}
                        onChangeText={(val) =>
                          setPrefs((prev) => ({ ...prev, quiet_hours_start: val }))
                        }
                      />
                    </View>
                    <View style={styles.gridCol}>
                      <Text style={styles.formLabel}>End Time</Text>
                      <TextInput
                        style={styles.formInput}
                        value={prefs.quiet_hours_end}
                        onChangeText={(val) =>
                          setPrefs((prev) => ({ ...prev, quiet_hours_end: val }))
                        }
                      />
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                savingPrefs && styles.btnDisabled,
              ]}
              onPress={handleSavePreferences}
              disabled={savingPrefs}
              activeOpacity={0.8}
            >
              {savingPrefs ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Save Preferences</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 60,
  },

  /* Top Actions Row */
  topActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  newReminderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#17365D',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  newReminderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  preferencesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  preferencesBtnText: {
    color: '#17365D',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Metric Cards Grid */
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  metricCardActiveOverdue: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  metricCardActiveToday: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  metricCardActiveSnoozed: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  metricCardActiveUpcoming: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricCardLabelOverdue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  metricCardCountOverdue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#DC2626',
  },
  metricCardLabelToday: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  metricCardCountToday: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563EB',
  },
  metricCardLabelSnoozed: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  metricCardCountSnoozed: {
    fontSize: 20,
    fontWeight: '800',
    color: '#D97706',
  },
  metricCardLabelUpcoming: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
  },
  metricCardCountUpcoming: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16A34A',
  },

  /* Status Tabs Bar */
  statusTabsScroll: {
    marginBottom: 10,
  },
  statusTabsContent: {
    gap: 6,
  },
  statusTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTabPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  statusTabPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  statusTabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Search Bar */
  searchBarContainer: {
    marginBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    padding: 0,
  },

  /* Source Chips */
  sourceChipsScroll: {
    marginBottom: 14,
  },
  sourceChipsContent: {
    gap: 6,
  },
  sourceChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sourceChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  sourceChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  sourceChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },

  /* Reminders List */
  remindersListWrap: {
    gap: 10,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyCreateBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Reminder Card */
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  reminderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  moreBtn: {
    padding: 2,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
    marginBottom: 4,
  },
  reminderTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  reminderDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  escalationTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  escalationTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    borderRadius: 8,
  },
  completeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  snoozeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },

  /* Modals Common */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '90%',
  },
  modalSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  formScroll: {
    maxHeight: 460,
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  formInputMultiline: {
    height: 60,
    textAlignVertical: 'top',
  },
  formPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  formPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  formPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  formPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  presetPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridCol: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  toggleInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalSubmitBtn: {
    backgroundColor: '#17365D',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  /* Snooze Modal Specific */
  snoozePromptText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  snoozeTargetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  snoozeOptionsGrid: {
    gap: 8,
    marginBottom: 10,
  },
  snoozeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    borderRadius: 12,
  },
  snoozeOptionCardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },

  /* Action Sheet Specific */
  actionSheetTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 14,
  },
  actionSheetOptionsList: {
    gap: 8,
    marginBottom: 10,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  actionSheetItemDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionSheetTextCol: {
    flex: 1,
  },
  actionSheetItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  actionSheetItemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  /* Preferences Modal Specific */
  prefSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#17365D',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 4,
  },
});
