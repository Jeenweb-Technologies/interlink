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
  Linking,
  Switch,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Plus,
  X,
  MapPin,
  Video,
  CheckCircle2,
  ListSortDescending,
  CalendarDays,
  Check,
  Trash2,
  Edit2,
  Users,
  FolderKanban,
  CheckSquare,
  Bell,
  Sparkles,
  ExternalLink,
  Repeat,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  getCalendarFeed,
  getCalendars,
  createCalendar,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  respondRSVP,
  CalendarItem,
  CalendarFeedItem,
  CreateEventPayload,
} from '../../api/calendarApi';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type CalendarViewMode = 'month' | 'agenda' | 'day';

interface FilterOption {
  key: string;
  label: string;
  color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const MODULE_FILTERS: FilterOption[] = [
  { key: 'all', label: 'All', color: '#17365D', icon: ListSortDescending },
  { key: 'events', label: 'Events', color: '#6366F1', icon: CalendarDays },
  { key: 'meetings', label: 'Meetings', color: '#0284C7', icon: Video },
  { key: 'tasks', label: 'Tasks', color: '#10B981', icon: CheckSquare },
  { key: 'projects', label: 'Projects', color: '#8B5CF6', icon: FolderKanban },
  { key: 'reminders', label: 'Reminders', color: '#F43F5E', icon: Bell },
];

const PRESET_COLORS = [
  '#2878C7', // Blue
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

const CATEGORIES = [
  { id: 'general', label: 'General', color: '#2878C7' },
  { id: 'meeting', label: 'Meeting', color: '#0284C7' },
  { id: 'call', label: 'Call', color: '#6366F1' },
  { id: 'work', label: 'Work', color: '#10B981' },
  { id: 'review', label: 'Review', color: '#F59E0B' },
  { id: 'deadline', label: 'Deadline', color: '#EF4444' },
];

const RECURRENCE_OPTIONS = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'DAILY', label: 'Daily (Every day)' },
  { id: 'WEEKLY', label: 'Weekly (Every week)' },
  { id: 'MONTHLY', label: 'Monthly (Every month)' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format date to YYYY-MM-DD
const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Safe date key extraction (YYYY-MM-DD) from ISO or string
const extractDateKey = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  if (isoStr.length >= 10 && isoStr.includes('-')) {
    return isoStr.slice(0, 10);
  }
  try {
    const d = new Date(isoStr);
    return toDateStr(d);
  } catch {
    return '';
  }
};

// Format time from ISO
const formatTimeStr = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const CalendarScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // Route initial params
  const initialOpenCreate = route.params?.openCreateEvent;
  const routeInitialDate = route.params?.initialDate;

  // Active navigation date & view
  const [currentDate, setCurrentDate] = useState<Date>(
    routeInitialDate ? new Date(routeInitialDate) : new Date()
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    routeInitialDate || toDateStr(new Date())
  );
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Filters
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Data state
  const [feedItems, setFeedItems] = useState<CalendarFeedItem[]>([]);
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isEventEditorOpen, setIsEventEditorOpen] = useState(Boolean(initialOpenCreate));
  const [editingEvent, setEditingEvent] = useState<CalendarFeedItem | null>(null);
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<CalendarFeedItem | null>(null);
  const [isAddCalendarOpen, setIsAddCalendarOpen] = useState(false);

  // Event Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventMeetingUrl, setEventMeetingUrl] = useState('');
  const [hasMeeting, setHasMeeting] = useState(false);
  const [eventIsAllDay, setEventIsAllDay] = useState(false);
  const [eventStartDate, setEventStartDate] = useState(selectedDateStr);
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndDate, setEventEndDate] = useState(selectedDateStr);
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [eventCategory, setEventCategory] = useState('general');
  const [eventColor, setEventColor] = useState('#2878C7');
  const [eventCalendarId, setEventCalendarId] = useState<number | undefined>(undefined);
  const [eventRecurrence, setEventRecurrence] = useState<'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('none');
  const [attendeeEmailInput, setAttendeeEmailInput] = useState('');
  const [eventAttendees, setEventAttendees] = useState<Array<{ guest_email: string; guest_name: string }>>([]);
  const [savingEvent, setSavingEvent] = useState(false);

  // Dropdown states in Create New Event modal
  const [isCalendarDropdownOpen, setIsCalendarDropdownOpen] = useState(false);
  const [isRecurrenceDropdownOpen, setIsRecurrenceDropdownOpen] = useState(false);

  // Inline Add Calendar inside Calendar Dropdown
  const [showInlineAddCalendar, setShowInlineAddCalendar] = useState(false);
  const [inlineCalendarName, setInlineCalendarName] = useState('');
  const [inlineCalendarColor, setInlineCalendarColor] = useState('#2878C7');
  const [inlineCreatingCalendar, setInlineCreatingCalendar] = useState(false);

  // Add Calendar Form State
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarColor, setNewCalendarColor] = useState('#2878C7');
  const [creatingCalendar, setCreatingCalendar] = useState(false);

  // Compute start and end date for current month range (with 7 days buffer)
  const queryDateRange = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    const start = new Date(firstDay.getTime() - 8 * 24 * 60 * 60 * 1000);
    const end = new Date(lastDay.getTime() + 8 * 24 * 60 * 60 * 1000);

    return {
      startDate: toDateStr(start),
      endDate: toDateStr(end),
    };
  }, [currentDate]);

  // Load Calendars
  const loadCalendars = useCallback(async () => {
    try {
      const res = await getCalendars();
      if (res.success && Array.isArray(res.data)) {
        setCalendars(res.data);
        if (!eventCalendarId && res.data.length > 0) {
          const def = res.data.find((c) => Boolean(c.is_default)) || res.data[0];
          setEventCalendarId(def.id);
        }
      }
    } catch (err) {
      console.error('Error fetching calendars:', err);
    }
  }, [eventCalendarId]);

  // Load Feed
  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCalendarFeed({
        startDate: queryDateRange.startDate,
        endDate: queryDateRange.endDate,
        includeEvents: activeFilter === 'all' || activeFilter === 'events',
        includeMeetings: activeFilter === 'all' || activeFilter === 'meetings',
        includeTasks: activeFilter === 'all' || activeFilter === 'tasks',
        includeProjects: activeFilter === 'all' || activeFilter === 'projects',
        includeReminders: activeFilter === 'all' || activeFilter === 'reminders',
      });

      if (res.success && Array.isArray(res.data)) {
        setFeedItems(res.data);
      } else {
        setFeedItems([]);
      }
    } catch (err) {
      console.error('Error fetching calendar feed:', err);
      setFeedItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryDateRange, activeFilter]);

  useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCalendars();
    loadFeed();
  };

  // Month navigation
  const handlePrevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(toDateStr(today));
  };

  // Month Grid Calculation
  const monthGridData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      items: CalendarFeedItem[];
    }> = [];

    const todayStr = toDateStr(new Date());

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dStr = toDateStr(prevDate);
      cells.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
        items: feedItems.filter((item) => extractDateKey(item.startTime) === dStr),
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dStr = toDateStr(curDate);
      cells.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
        items: feedItems.filter((item) => extractDateKey(item.startTime) === dStr),
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dStr = toDateStr(nextDate);
      cells.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
        items: feedItems.filter((item) => extractDateKey(item.startTime) === dStr),
      });
    }

    return cells;
  }, [currentDate, selectedDateStr, feedItems]);

  // Selected Day's Items
  const selectedDayItems = useMemo(() => {
    return feedItems.filter((item) => extractDateKey(item.startTime) === selectedDateStr);
  }, [feedItems, selectedDateStr]);

  // Agenda list (all items sorted by date)
  const agendaSortedItems = useMemo(() => {
    return [...feedItems].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [feedItems]);

  // Quick Date Shortcut Picker
  const handleQuickDateShortcut = (preset: 'today' | 'tomorrow' | 'nextWeek') => {
    const target = new Date();
    if (preset === 'tomorrow') {
      target.setDate(target.getDate() + 1);
    } else if (preset === 'nextWeek') {
      target.setDate(target.getDate() + 7);
    }
    const dStr = toDateStr(target);
    setEventStartDate(dStr);
    setEventEndDate(dStr);
  };

  // Inline Create Calendar inside Dropdown
  const handleInlineCreateCalendar = async () => {
    if (!inlineCalendarName.trim()) {
      Alert.alert('Required', 'Please enter a calendar name.');
      return;
    }
    try {
      setInlineCreatingCalendar(true);
      const res = await createCalendar({
        name: inlineCalendarName.trim(),
        color: inlineCalendarColor,
      });
      if (res.success && res.data) {
        await loadCalendars();
        setEventCalendarId(res.data.id);
        setInlineCalendarName('');
        setShowInlineAddCalendar(false);
        setIsCalendarDropdownOpen(false);
        Alert.alert('Success', `Calendar "${res.data.name}" created and selected!`);
      } else {
        Alert.alert('Error', res.message || 'Could not create calendar.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create calendar.');
    } finally {
      setInlineCreatingCalendar(false);
    }
  };

  // Open Event Editor for Create
  const handleOpenCreateEvent = (datePreset?: string) => {
    const targetDate = datePreset || selectedDateStr || toDateStr(new Date());
    setEditingEvent(null);
    setEventTitle('');
    setEventDescription('');
    setEventLocation('');
    setEventMeetingUrl('');
    setHasMeeting(false);
    setEventIsAllDay(false);
    setEventStartDate(targetDate);
    setEventStartTime('09:00');
    setEventEndDate(targetDate);
    setEventEndTime('10:00');
    setEventCategory('general');
    setEventColor('#2878C7');
    setEventRecurrence('none');
    setEventAttendees([]);
    setAttendeeEmailInput('');
    setIsCalendarDropdownOpen(false);
    setIsRecurrenceDropdownOpen(false);
    setShowInlineAddCalendar(false);
    setInlineCalendarName('');
    if (calendars.length > 0) {
      const def = calendars.find((c) => Boolean(c.is_default)) || calendars[0];
      setEventCalendarId(def.id);
    }
    setIsEventEditorOpen(true);
  };

  // Open Event Editor for Edit
  const handleOpenEditEvent = (item: CalendarFeedItem) => {
    setEditingEvent(item);
    setEventTitle(item.title);
    setEventDescription(item.description || '');
    setEventLocation(item.location || '');
    setEventMeetingUrl(item.meetingUrl || '');
    setHasMeeting(Boolean(item.meetingUrl));
    setEventIsAllDay(Boolean(item.isAllDay));

    const sKey = extractDateKey(item.startTime) || selectedDateStr;
    const eKey = extractDateKey(item.endTime) || sKey;
    setEventStartDate(sKey);
    setEventEndDate(eKey);

    setEventStartTime(item.isAllDay ? '09:00' : formatTimeStr(item.startTime) || '09:00');
    setEventEndTime(item.isAllDay ? '10:00' : formatTimeStr(item.endTime) || '10:00');

    setEventCategory(item.category || 'general');
    setEventColor(item.color || '#2878C7');
    setEventCalendarId(item.calendarId);

    let freq: 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'none';
    const rawRule = (item as any).recurrence_rule || (item as any).recurrenceRule;
    if (rawRule) {
      if (typeof rawRule === 'string') {
        try {
          const parsed = JSON.parse(rawRule);
          if (parsed?.freq) freq = parsed.freq;
        } catch {
          freq = 'WEEKLY';
        }
      } else if (typeof rawRule === 'object' && rawRule.freq) {
        freq = rawRule.freq;
      }
    } else if ((item as any).is_recurring || (item as any).isRecurring) {
      freq = 'WEEKLY';
    }
    setEventRecurrence(freq);

    const atts = (item.attendees || []).map((a) => ({
      guest_email: a.guest_email || '',
      guest_name: a.guest_name || a.guest_email || '',
    }));
    setEventAttendees(atts);

    setIsCalendarDropdownOpen(false);
    setIsRecurrenceDropdownOpen(false);
    setShowInlineAddCalendar(false);

    setSelectedDetailEvent(null);
    setIsEventEditorOpen(true);
  };

  // Save Event (Create or Update)
  const handleSaveEvent = async () => {
    if (!eventTitle.trim()) {
      Alert.alert('Required', 'Please enter an event title.');
      return;
    }

    try {
      setSavingEvent(true);

      const startDateTimeStr = `${eventStartDate} ${eventIsAllDay ? '00:00:00' : `${eventStartTime}:00`}`;
      const endDateTimeStr = `${eventEndDate} ${eventIsAllDay ? '23:59:59' : `${eventEndTime}:00`}`;

      let finalMeetingUrl: string | undefined = undefined;
      if (hasMeeting) {
        finalMeetingUrl = eventMeetingUrl.trim() || `/meetings/join/room-${Math.random().toString(36).substring(2, 9)}`;
      }

      const payload: CreateEventPayload = {
        calendar_id: eventCalendarId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        location: eventLocation.trim() || undefined,
        meeting_url: finalMeetingUrl,
        is_all_day: eventIsAllDay,
        start_time: startDateTimeStr,
        end_time: endDateTimeStr,
        category: eventCategory,
        color_override: eventColor,
        is_recurring: eventRecurrence !== 'none',
        recurrence_rule: eventRecurrence !== 'none' ? JSON.stringify({ freq: eventRecurrence }) : undefined,
        attendees: eventAttendees.map((a) => ({
          guest_email: a.guest_email,
          guest_name: a.guest_name,
          rsvp_status: 'needs_action',
        })),
      };

      if (editingEvent && editingEvent.sourceType === 'event') {
        const res = await updateCalendarEvent(editingEvent.sourceId, payload);
        if (res.success) {
          Alert.alert('Success', 'Event updated successfully');
          setIsEventEditorOpen(false);
          loadFeed();
        } else {
          Alert.alert('Error', res.message || 'Failed to update event');
        }
      } else {
        const res = await createCalendarEvent(payload);
        if (res.success) {
          Alert.alert('Success', 'Event created successfully');
          setIsEventEditorOpen(false);
          loadFeed();
        } else {
          Alert.alert('Error', res.message || 'Failed to create event');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save event.');
    } finally {
      setSavingEvent(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = (item: CalendarFeedItem) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteCalendarEvent(item.sourceId);
              if (res.success) {
                Alert.alert('Deleted', 'Event was deleted');
                setSelectedDetailEvent(null);
                loadFeed();
              } else {
                Alert.alert('Error', res.message || 'Could not delete event');
              }
            } catch {
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  // Respond to RSVP
  const handleRSVP = async (item: CalendarFeedItem, status: 'accepted' | 'declined' | 'tentative') => {
    try {
      const res = await respondRSVP(item.sourceId, status);
      if (res.success) {
        Alert.alert('RSVP Sent', `You responded: ${status.toUpperCase()}`);
        loadFeed();
        setSelectedDetailEvent(null);
      } else {
        Alert.alert('Notice', res.message || 'Could not record RSVP');
      }
    } catch {
      Alert.alert('Notice', 'Failed to submit RSVP');
    }
  };

  // Create Calendar
  const handleCreateNewCalendar = async () => {
    if (!newCalendarName.trim()) {
      Alert.alert('Required', 'Please enter a calendar name');
      return;
    }
    try {
      setCreatingCalendar(true);
      const res = await createCalendar({
        name: newCalendarName.trim(),
        color: newCalendarColor,
        type: 'personal',
      });
      if (res.success) {
        Alert.alert('Success', 'New calendar created!');
        setNewCalendarName('');
        setIsAddCalendarOpen(false);
        loadCalendars();
      } else {
        Alert.alert('Error', res.message || 'Failed to create calendar');
      }
    } catch {
      Alert.alert('Error', 'Could not create calendar');
    } finally {
      setCreatingCalendar(false);
    }
  };

  // Add Attendee Pill
  const handleAddAttendee = () => {
    const val = attendeeEmailInput.trim();
    if (!val) return;
    setEventAttendees((prev) => [...prev, { guest_email: val, guest_name: val }]);
    setAttendeeEmailInput('');
  };

  const handleRemoveAttendee = (index: number) => {
    setEventAttendees((prev) => prev.filter((_, i) => i !== index));
  };

  // Month Display Name
  const monthDisplayTitle = currentDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  // Helper for source badges
  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'meeting':
        return { label: 'MEETING', bg: '#E0F2FE', text: '#0284C7' };
      case 'task':
        return { label: 'TASK', bg: '#DCFCE7', text: '#15803D' };
      case 'project':
        return { label: 'PROJECT', bg: '#EDE9FE', text: '#7C3AED' };
      case 'reminder':
        return { label: 'REMINDER', bg: '#FFE4E6', text: '#E11D48' };
      default:
        return { label: 'EVENT', bg: '#EEF2FF', text: '#4F46E5' };
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
        title="Calendar & Schedule"
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
            TOP ACTION BAR (+ SCHEDULE EVENT & + NEW EVENT)
        ──────────────────────────────────────────────────────── */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={styles.scheduleEventBtn}
            activeOpacity={0.8}
            onPress={() => handleOpenCreateEvent()}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.scheduleEventBtnText}>Schedule Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newCalendarBtn}
            activeOpacity={0.8}
            onPress={() => handleOpenCreateEvent()}
          >
            <CalendarIcon size={15} color="#17365D" />
            <Text style={styles.newCalendarBtnText}>New Event</Text>
          </TouchableOpacity>
        </View>

        {/* ────────────────────────────────────────────────────────
            MODULE FILTERS BAR (ALL, EVENTS, MEETINGS, TASKS...)
        ──────────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moduleFiltersContent}
          style={styles.moduleFiltersScroll}
        >
          {MODULE_FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            const IconComp = f.icon;

            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: f.color, borderColor: f.color },
                ]}
                activeOpacity={0.75}
                onPress={() => setActiveFilter(f.key)}
              >
                <IconComp size={13} color={isActive ? '#FFFFFF' : f.color} />
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ────────────────────────────────────────────────────────
            DATE NAVIGATOR & VIEW MODE SELECTOR
        ──────────────────────────────────────────────────────── */}
        <View style={styles.dateNavCard}>
          <View style={styles.dateNavHeader}>
            <View style={styles.dateNavMonthCol}>
              <Text style={styles.dateNavMonthText}>{monthDisplayTitle}</Text>
              <Text style={styles.dateNavSubText}>
                {feedItems.length} total item{feedItems.length === 1 ? '' : 's'} in view
              </Text>
            </View>

            <View style={styles.navButtonsRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={handlePrevMonth}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={18} color="#1E293B" strokeWidth={2.4} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.todayPillBtn}
                onPress={handleGoToday}
                activeOpacity={0.7}
              >
                <Text style={styles.todayPillText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={handleNextMonth}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronRight size={18} color="#1E293B" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          {/* View Mode Switcher Pills */}
          <View style={styles.viewModeBar}>
            {(['month', 'agenda', 'day'] as const).map((mode) => {
              const isModeActive = viewMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.viewModeTab,
                    isModeActive && styles.viewModeTabActive,
                  ]}
                  onPress={() => setViewMode(mode)}
                >
                  <Text
                    style={[
                      styles.viewModeTabText,
                      isModeActive && styles.viewModeTabTextActive,
                    ]}
                  >
                    {mode === 'month' ? 'Month View' : mode === 'agenda' ? 'Agenda' : 'Day View'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────
            VIEW 1: MONTH GRID VIEW
        ──────────────────────────────────────────────────────── */}
        {viewMode === 'month' && (
          <View style={styles.calendarCard}>
            {/* Weekday Labels Header */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((w, idx) => (
                <View key={idx} style={styles.weekdayCol}>
                  <Text style={[styles.weekdayText, idx === 0 && styles.weekdaySunday]}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* Grid Cells */}
            {loading && !refreshing ? (
              <View style={styles.gridLoadingWrap}>
                <ActivityIndicator size="small" color="#17365D" />
                <Text style={styles.gridLoadingText}>Loading calendar...</Text>
              </View>
            ) : (
              <View style={styles.monthGridWrap}>
                {monthGridData.map((cell, idx) => {
                  const hasEvents = cell.items.length > 0;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.gridCell,
                        cell.isSelected && styles.gridCellSelected,
                        cell.isToday && styles.gridCellToday,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedDateStr(cell.dateStr)}
                      onLongPress={() => handleOpenCreateEvent(cell.dateStr)}
                    >
                      <Text
                        style={[
                          styles.cellDayNumber,
                          !cell.isCurrentMonth && styles.cellDayMuted,
                          cell.isToday && styles.cellDayToday,
                          cell.isSelected && styles.cellDaySelected,
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>

                      {/* Event Dots */}
                      {hasEvents && (
                        <View style={styles.cellDotsRow}>
                          {cell.items.slice(0, 3).map((item, dIdx) => (
                            <View
                              key={dIdx}
                              style={[
                                styles.cellDot,
                                { backgroundColor: item.color || '#2878C7' },
                              ]}
                            />
                          ))}
                          {cell.items.length > 3 && (
                            <Text style={styles.cellMoreCount}>
                              +{cell.items.length - 3}
                            </Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ────────────────────────────────────────────────────────
            VIEW 2: SELECTED DAY / AGENDA LIST
        ──────────────────────────────────────────────────────── */}
        <View style={styles.agendaSection}>
          <View style={styles.agendaSectionHeader}>
            <View style={styles.agendaSectionTitleRow}>
              <CalendarIcon size={16} color="#17365D" />
              <Text style={styles.agendaSectionTitle}>
                {viewMode === 'agenda'
                  ? 'All Scheduled Events & Deadlines'
                  : `Schedule for ${selectedDateStr}`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addDayEventBtn}
              onPress={() => handleOpenCreateEvent(selectedDateStr)}
            >
              <Plus size={13} color="#2563EB" />
              <Text style={styles.addDayEventText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Event Items */}
          {(viewMode === 'agenda' ? agendaSortedItems : selectedDayItems).length === 0 ? (
            <View style={styles.emptyAgendaBox}>
              <CalendarDays size={32} color="#CBD5E1" />
              <Text style={styles.emptyAgendaTitle}>No schedule entries</Text>
              <Text style={styles.emptyAgendaSub}>
                {viewMode === 'agenda'
                  ? 'No events or deadlines found for this date range.'
                  : `Nothing scheduled on ${selectedDateStr}. Tap below to schedule.`}
              </Text>
              <TouchableOpacity
                style={styles.emptyScheduleBtn}
                onPress={() => handleOpenCreateEvent(selectedDateStr)}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.emptyScheduleBtnText}>Schedule Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            (viewMode === 'agenda' ? agendaSortedItems : selectedDayItems).map((item) => {
              const badge = getSourceBadge(item.sourceType);
              const timeDisplay = item.isAllDay
                ? 'All Day'
                : `${formatTimeStr(item.startTime)} - ${formatTimeStr(item.endTime)}`;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.eventItemCard}
                  activeOpacity={0.8}
                  onPress={() => setSelectedDetailEvent(item)}
                >
                  {/* Left Color Accent Bar */}
                  <View
                    style={[
                      styles.eventAccentBar,
                      { backgroundColor: item.color || '#2878C7' },
                    ]}
                  />

                  {/* Main Event Info */}
                  <View style={styles.eventCardBody}>
                    <View style={styles.eventCardTopRow}>
                      <View style={[styles.sourceBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.sourceBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>

                      <View style={styles.eventTimeWrap}>
                        <Clock size={11} color="#64748B" />
                        <Text style={styles.eventTimeText}>{timeDisplay}</Text>
                      </View>
                    </View>

                    <Text style={styles.eventItemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    {item.location ? (
                      <View style={styles.eventMetaRow}>
                        <MapPin size={12} color="#64748B" />
                        <Text style={styles.eventMetaText} numberOfLines={1}>
                          {item.location}
                        </Text>
                      </View>
                    ) : null}

                    {item.meetingUrl ? (
                      <View style={styles.eventMetaRow}>
                        <Video size={12} color="#0284C7" />
                        <Text style={[styles.eventMetaText, { color: '#0284C7' }]} numberOfLines={1}>
                          Video Meeting Available
                        </Text>
                      </View>
                    ) : null}

                    {item.calendarName && (
                      <Text style={styles.calendarTagText}>{item.calendarName}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ────────────────────────────────────────────────────────
          MODAL 1: EVENT DETAILS & ACTIONS
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(selectedDetailEvent)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedDetailEvent(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDetailEvent(null)}
        >
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 20) + 16 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {selectedDetailEvent && (
              <>
                <View style={styles.modalSheetHeader}>
                  <View style={styles.modalSheetHeaderLeft}>
                    <View
                      style={[
                        styles.sourceBadgeLarge,
                        {
                          backgroundColor:
                            getSourceBadge(selectedDetailEvent.sourceType).bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sourceBadgeLargeText,
                          {
                            color:
                              getSourceBadge(selectedDetailEvent.sourceType).text,
                          },
                        ]}
                      >
                        {getSourceBadge(selectedDetailEvent.sourceType).label}
                      </Text>
                    </View>
                    <Text style={styles.modalSheetCategory}>
                      {selectedDetailEvent.category?.toUpperCase() || 'GENERAL'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedDetailEvent(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalDetailScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalDetailTitle}>{selectedDetailEvent.title}</Text>

                  {/* Date & Time Row */}
                  <View style={styles.modalDetailInfoRow}>
                    <CalendarIcon size={16} color="#17365D" />
                    <Text style={styles.modalDetailInfoText}>
                      {selectedDetailEvent.isAllDay
                        ? `${extractDateKey(selectedDetailEvent.startTime)} (All Day)`
                        : `${extractDateKey(selectedDetailEvent.startTime)} • ${formatTimeStr(
                            selectedDetailEvent.startTime
                          )} - ${formatTimeStr(selectedDetailEvent.endTime)}`}
                    </Text>
                  </View>

                  {/* Location Row */}
                  {selectedDetailEvent.location ? (
                    <View style={styles.modalDetailInfoRow}>
                      <MapPin size={16} color="#64748B" />
                      <Text style={styles.modalDetailInfoText}>
                        {selectedDetailEvent.location}
                      </Text>
                    </View>
                  ) : null}

                  {/* Calendar Row */}
                  {selectedDetailEvent.calendarName ? (
                    <View style={styles.modalDetailInfoRow}>
                      <CalendarDays size={16} color="#64748B" />
                      <Text style={styles.modalDetailInfoText}>
                        Calendar: {selectedDetailEvent.calendarName}
                      </Text>
                    </View>
                  ) : null}

                  {/* Description Box */}
                  {selectedDetailEvent.description ? (
                    <View style={styles.modalDescBox}>
                      <Text style={styles.modalDescLabel}>Notes & Description</Text>
                      <Text style={styles.modalDescText}>{selectedDetailEvent.description}</Text>
                    </View>
                  ) : null}

                  {/* Video Meeting Action Button */}
                  {selectedDetailEvent.meetingUrl ? (
                    <TouchableOpacity
                      style={styles.joinMeetingBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        const url = selectedDetailEvent.meetingUrl!;
                        if (url.startsWith('http')) {
                          Linking.openURL(url);
                        } else {
                          Alert.alert('Meeting Room', url);
                        }
                      }}
                    >
                      <Video size={18} color="#FFFFFF" />
                      <Text style={styles.joinMeetingBtnText}>Join Video Meeting</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* RSVP Responses */}
                  {selectedDetailEvent.sourceType === 'event' && (
                    <View style={styles.rsvpBox}>
                      <Text style={styles.rsvpLabel}>RSVP Attendance:</Text>
                      <View style={styles.rsvpButtonsRow}>
                        <TouchableOpacity
                          style={[styles.rsvpBtn, styles.rsvpBtnAccept]}
                          onPress={() => handleRSVP(selectedDetailEvent, 'accepted')}
                        >
                          <Check size={14} color="#15803D" />
                          <Text style={styles.rsvpBtnAcceptText}>Accept</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.rsvpBtn, styles.rsvpBtnTentative]}
                          onPress={() => handleRSVP(selectedDetailEvent, 'tentative')}
                        >
                          <Text style={styles.rsvpBtnTentativeText}>Tentative</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.rsvpBtn, styles.rsvpBtnDecline]}
                          onPress={() => handleRSVP(selectedDetailEvent, 'declined')}
                        >
                          <X size={14} color="#DC2626" />
                          <Text style={styles.rsvpBtnDeclineText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Edit & Delete Action Buttons (For editable native events) */}
                {selectedDetailEvent.sourceType === 'event' && !selectedDetailEvent.isReadOnly && (
                  <View style={styles.modalFooterActionsRow}>
                    <TouchableOpacity
                      style={styles.modalEditBtn}
                      activeOpacity={0.8}
                      onPress={() => handleOpenEditEvent(selectedDetailEvent)}
                    >
                      <Edit2 size={16} color="#17365D" />
                      <Text style={styles.modalEditBtnText}>Edit Event</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalDeleteBtn}
                      activeOpacity={0.8}
                      onPress={() => handleDeleteEvent(selectedDetailEvent)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                      <Text style={styles.modalDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL 2: EVENT SCHEDULER (CREATE / EDIT)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isEventEditorOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEventEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsEventEditorOpen(false)}
          />
          <View
            style={[
              styles.modalSheet,
              styles.editorModalContainer,
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalDragHandle} />

            <View style={styles.modalSheetHeader}>
              <Text style={styles.editorModalTitle}>
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsEventEditorOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.editorFormScroll}
              contentContainerStyle={styles.editorFormScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {/* Event Title */}
              <Text style={styles.fieldLabel}>Event Title *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Sprint Planning, Client Sync, Architecture Review..."
                placeholderTextColor="#94A3B8"
                value={eventTitle}
                onChangeText={setEventTitle}
              />

              {/* 1. Target Calendar Dropdown with Inline Creation */}
              <Text style={styles.fieldLabel}>Calendar</Text>
              {(() => {
                const selectedCal = calendars.find((c) => c.id === eventCalendarId) || calendars[0];
                return (
                  <>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      activeOpacity={0.8}
                      onPress={() => {
                        setIsCalendarDropdownOpen(!isCalendarDropdownOpen);
                        setIsRecurrenceDropdownOpen(false);
                      }}
                    >
                      <View style={styles.dropdownTriggerLeft}>
                        <View style={[styles.colorDot, { backgroundColor: selectedCal?.color || '#2878C7' }]} />
                        <Text style={styles.dropdownTriggerText}>
                          {selectedCal ? `${selectedCal.name} (${selectedCal.type || 'Custom'})` : 'Select Calendar'}
                        </Text>
                      </View>
                      <ChevronDown size={18} color="#64748B" />
                    </TouchableOpacity>

                    {isCalendarDropdownOpen && (
                      <View style={styles.dropdownMenu}>
                        {calendars.map((cal) => {
                          const isSelected = eventCalendarId === cal.id;
                          return (
                            <TouchableOpacity
                              key={cal.id}
                              style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                              onPress={() => {
                                setEventCalendarId(cal.id);
                                setIsCalendarDropdownOpen(false);
                              }}
                            >
                              <View style={styles.dropdownItemLeft}>
                                <View style={[styles.colorDot, { backgroundColor: cal.color || '#2878C7' }]} />
                                <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                                  {cal.name} {cal.is_default ? '(Default)' : ''}
                                </Text>
                              </View>
                              {isSelected && <Check size={16} color="#2563EB" strokeWidth={2.5} />}
                            </TouchableOpacity>
                          );
                        })}

                        <View style={styles.inlineAddCalDivider} />

                        {!showInlineAddCalendar ? (
                          <TouchableOpacity
                            style={styles.inlineAddCalTriggerBtn}
                            onPress={() => setShowInlineAddCalendar(true)}
                          >
                            <Plus size={15} color="#2563EB" strokeWidth={2.5} />
                            <Text style={styles.inlineAddCalTriggerText}>+ Create New Calendar</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.inlineAddCalBox}>
                            <Text style={styles.inlineAddCalLabel}>New Calendar Name *</Text>
                            <TextInput
                              style={styles.inlineAddCalInput}
                              placeholder="e.g. Marketing, Personal..."
                              placeholderTextColor="#94A3B8"
                              value={inlineCalendarName}
                              onChangeText={setInlineCalendarName}
                            />
                            <Text style={styles.inlineAddCalLabel}>Color</Text>
                            <View style={styles.inlineColorRow}>
                              {PRESET_COLORS.map((col) => (
                                <TouchableOpacity
                                  key={col}
                                  style={[
                                    styles.inlineColorDot,
                                    { backgroundColor: col },
                                    inlineCalendarColor === col && styles.inlineColorDotActive,
                                  ]}
                                  onPress={() => setInlineCalendarColor(col)}
                                >
                                  {inlineCalendarColor === col && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                                </TouchableOpacity>
                              ))}
                            </View>
                            <View style={styles.inlineAddCalActions}>
                              <TouchableOpacity
                                style={styles.inlineCancelBtn}
                                onPress={() => setShowInlineAddCalendar(false)}
                              >
                                <Text style={styles.inlineCancelText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.inlineSaveBtn}
                                onPress={handleInlineCreateCalendar}
                                disabled={inlineCreatingCalendar}
                              >
                                {inlineCreatingCalendar ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={styles.inlineSaveText}>Save & Select</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                );
              })()}

              {/* 2. Color Override Palette */}
              <Text style={styles.fieldLabel}>Color Override</Text>
              <View style={styles.colorPaletteRow}>
                {PRESET_COLORS.map((c) => {
                  const isSelected = eventColor === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setEventColor(c)}
                    >
                      {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 4. Event Timing Section with Quick Date Shortcuts */}
              <View style={styles.timingCard}>
                <View style={styles.timingHeaderRow}>
                  <Text style={styles.timingSectionTitle}>Event Timing</Text>
                  <View style={styles.dateShortcutsRow}>
                    <TouchableOpacity style={styles.dateShortcutPill} onPress={() => handleQuickDateShortcut('today')}>
                      <Text style={styles.dateShortcutText}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateShortcutPill} onPress={() => handleQuickDateShortcut('tomorrow')}>
                      <Text style={styles.dateShortcutText}>Tomorrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateShortcutPill} onPress={() => handleQuickDateShortcut('nextWeek')}>
                      <Text style={styles.dateShortcutText}>Next Week</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* All Day Toggle */}
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>All-Day Event</Text>
                  <Switch
                    value={eventIsAllDay}
                    onValueChange={setEventIsAllDay}
                    trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                    thumbColor={eventIsAllDay ? '#2563EB' : '#F1F5F9'}
                  />
                </View>

                {/* Date & Time Rows */}
                <View style={styles.dateTimeGrid}>
                  <View style={styles.dateTimeCol}>
                    <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="2026-11-27"
                      placeholderTextColor="#94A3B8"
                      value={eventStartDate}
                      onChangeText={setEventStartDate}
                    />
                  </View>

                  {!eventIsAllDay && (
                    <View style={styles.dateTimeCol}>
                      <Text style={styles.fieldLabel}>Start Time (HH:mm)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="09:00"
                        placeholderTextColor="#94A3B8"
                        value={eventStartTime}
                        onChangeText={setEventStartTime}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.dateTimeGrid}>
                  <View style={styles.dateTimeCol}>
                    <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="2026-11-27"
                      placeholderTextColor="#94A3B8"
                      value={eventEndDate}
                      onChangeText={setEventEndDate}
                    />
                  </View>

                  {!eventIsAllDay && (
                    <View style={styles.dateTimeCol}>
                      <Text style={styles.fieldLabel}>End Time (HH:mm)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="10:00"
                        placeholderTextColor="#94A3B8"
                        value={eventEndTime}
                        onChangeText={setEventEndTime}
                      />
                    </View>
                  )}
                </View>
              </View>

              {/* 5. Repeat / Recurrence Dropdown */}
              <Text style={styles.fieldLabel}>Repeat / Recurrence</Text>
              {(() => {
                const selectedRec = RECURRENCE_OPTIONS.find((r) => r.id === eventRecurrence) || RECURRENCE_OPTIONS[0];
                return (
                  <>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      activeOpacity={0.8}
                      onPress={() => {
                        setIsRecurrenceDropdownOpen(!isRecurrenceDropdownOpen);
                        setIsCalendarDropdownOpen(false);
                      }}
                    >
                      <View style={styles.dropdownTriggerLeft}>
                        <Repeat size={16} color="#2563EB" />
                        <Text style={styles.dropdownTriggerText}>{selectedRec.label}</Text>
                      </View>
                      <ChevronDown size={18} color="#64748B" />
                    </TouchableOpacity>

                    {isRecurrenceDropdownOpen && (
                      <View style={styles.dropdownMenu}>
                        {RECURRENCE_OPTIONS.map((opt) => {
                          const isSelected = eventRecurrence === opt.id;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                              onPress={() => {
                                setEventRecurrence(opt.id as any);
                                setIsRecurrenceDropdownOpen(false);
                              }}
                            >
                              <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                                {opt.label}
                              </Text>
                              {isSelected && <Check size={16} color="#2563EB" strokeWidth={2.5} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                );
              })()}

              {/* 6. LiveKit Video Meeting Integration */}
              <View style={styles.meetingToggleCard}>
                <View style={styles.meetingToggleHeader}>
                  <View style={styles.meetingToggleLeft}>
                    <Video size={18} color="#166534" />
                    <Text style={styles.meetingToggleTitle}>Attach Video Meeting Room</Text>
                  </View>
                  <Switch
                    value={hasMeeting}
                    onValueChange={setHasMeeting}
                    trackColor={{ false: '#CBD5E1', true: '#BBF7D0' }}
                    thumbColor={hasMeeting ? '#16A34A' : '#F1F5F9'}
                  />
                </View>
                {hasMeeting && (
                  <Text style={styles.meetingToggleDesc}>
                    A dedicated LiveKit room will be attached with 1-click video conferencing for all invitees.
                  </Text>
                )}
              </View>

              {hasMeeting && (
                <>
                  <Text style={styles.fieldLabel}>Custom Meeting URL (Optional)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Leave blank to auto-generate room link"
                    placeholderTextColor="#94A3B8"
                    value={eventMeetingUrl}
                    onChangeText={setEventMeetingUrl}
                  />
                </>
              )}

              {/* 7. Location */}
              <Text style={styles.fieldLabel}>Location / Room</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Conference Room A, Main Office or URL"
                placeholderTextColor="#94A3B8"
                value={eventLocation}
                onChangeText={setEventLocation}
              />

              {/* 8. Description & Agenda */}
              <Text style={styles.fieldLabel}>Description & Agenda</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                placeholder="Add meeting agenda, discussion topics..."
                placeholderTextColor="#94A3B8"
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
              />

              {/* 9. Attendees */}
              <Text style={styles.fieldLabel}>Add Attendees</Text>
              <View style={styles.addAttendeeRow}>
                <TextInput
                  style={[styles.fieldInput, styles.addAttendeeInput]}
                  placeholder="Colleague email or username..."
                  placeholderTextColor="#94A3B8"
                  value={attendeeEmailInput}
                  onChangeText={setAttendeeEmailInput}
                />
                <TouchableOpacity
                  style={styles.addAttendeeBtn}
                  onPress={handleAddAttendee}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {eventAttendees.length > 0 && (
                <View style={styles.attendeesPillWrap}>
                  {eventAttendees.map((att, idx) => (
                    <View key={idx} style={styles.attendeePill}>
                      <Text style={styles.attendeePillText}>
                        {att.guest_name || att.guest_email}
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveAttendee(idx)}>
                        <X size={12} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Action Footer with Safe Area (Elevated above Gesture Handle) */}
            <View
              style={[
                styles.editorModalFooter,
                {
                  paddingBottom:
                    Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 20) + 16,
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.saveEventBtn, savingEvent && styles.btnDisabled]}
                onPress={handleSaveEvent}
                disabled={savingEvent}
                activeOpacity={0.8}
              >
                {savingEvent ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveEventBtnText}>
                    {editingEvent ? 'Update Event' : 'Create New Event'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL 3: QUICK ADD CALENDAR
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isAddCalendarOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAddCalendarOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAddCalendarOpen(false)}
        >
          <View
            style={[
              styles.modalSheet,
              {
                paddingBottom:
                  Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 20) + 16,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalSheetHeader}>
              <Text style={styles.editorModalTitle}>Create New Calendar</Text>
              <TouchableOpacity onPress={() => setIsAddCalendarOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Calendar Name *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Product Launches, Personal..."
              placeholderTextColor="#94A3B8"
              value={newCalendarName}
              onChangeText={setNewCalendarName}
            />

            <Text style={styles.fieldLabel}>Calendar Color</Text>
            <View style={styles.colorPaletteRow}>
              {PRESET_COLORS.map((c) => {
                const isSelected = newCalendarColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      isSelected && styles.colorCircleSelected,
                    ]}
                    onPress={() => setNewCalendarColor(c)}
                  >
                    {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.saveEventBtn, creatingCalendar && styles.btnDisabled]}
              onPress={handleCreateNewCalendar}
              disabled={creatingCalendar}
              activeOpacity={0.8}
            >
              {creatingCalendar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveEventBtnText}>Create Calendar</Text>
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
    marginBottom: 12,
  },
  scheduleEventBtn: {
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
  scheduleEventBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  newCalendarBtn: {
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
  newCalendarBtnText: {
    color: '#17365D',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Module Filters */
  moduleFiltersScroll: {
    marginBottom: 12,
  },
  moduleFiltersContent: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  /* Date Navigator Card */
  dateNavCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  dateNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateNavMonthCol: {
    flex: 1,
  },
  dateNavMonthText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateNavSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  navButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPillBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* View Mode Switcher */
  viewModeBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  viewModeTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  viewModeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  viewModeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModeTabTextActive: {
    color: '#17365D',
    fontWeight: '700',
  },

  /* Calendar Month Card */
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 14,
  },
  weekdaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 4,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  weekdaySunday: {
    color: '#EF4444',
  },
  gridLoadingWrap: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLoadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  monthGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '14.28%',
    aspectRatio: 1.05,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    borderRadius: 8,
  },
  gridCellSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  gridCellToday: {
    backgroundColor: '#F8FAFC',
  },
  cellDayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  cellDayMuted: {
    color: '#CBD5E1',
  },
  cellDayToday: {
    color: '#2563EB',
    fontWeight: '800',
  },
  cellDaySelected: {
    color: '#2563EB',
    fontWeight: '800',
  },
  cellDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 3,
  },
  cellDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
  },
  cellMoreCount: {
    fontSize: 7,
    fontWeight: '700',
    color: '#64748B',
  },

  /* Agenda Section */
  agendaSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  agendaSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  agendaSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  agendaSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  addDayEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addDayEventText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Empty State */
  emptyAgendaBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyAgendaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyAgendaSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  emptyScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 14,
  },
  emptyScheduleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Event Cards */
  eventItemCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  eventAccentBar: {
    width: 5,
  },
  eventCardBody: {
    flex: 1,
    padding: 10,
  },
  eventCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  eventTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventTimeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  eventItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  calendarTagText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
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
  modalSheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadgeLarge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceBadgeLargeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modalSheetCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },

  /* Modal Details */
  modalDetailScroll: {
    maxHeight: 380,
    marginBottom: 12,
  },
  modalDetailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  modalDetailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modalDetailInfoText: {
    fontSize: 12.5,
    color: '#334155',
    flex: 1,
  },
  modalDescBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  modalDescLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalDescText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  joinMeetingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  joinMeetingBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rsvpBox: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 6,
  },
  rsvpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  rsvpButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  rsvpBtnAccept: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  rsvpBtnAcceptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  rsvpBtnTentative: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  rsvpBtnTentativeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  rsvpBtnDecline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  rsvpBtnDeclineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  modalFooterActionsRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  modalEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17365D',
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },

  /* Event Editor Form */
  editorModalContainer: {
    height: Math.round(SCREEN_HEIGHT * 0.88),
    maxHeight: '92%',
    paddingBottom: 0,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  editorModalHeight: {
    maxHeight: '92%',
  },
  editorModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  editorFormScroll: {
    flex: 1,
    width: '100%',
  },
  editorFormScrollContent: {
    paddingBottom: 24,
  },
  editorModalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  fieldInputMultiline: {
    height: 70,
    textAlignVertical: 'top',
  },
  categoryPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calendarPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  calendarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarPillActive: {
    borderColor: '#17365D',
    backgroundColor: '#EFF6FF',
  },
  calendarPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calendarPillText: {
    fontSize: 11,
    color: '#475569',
  },
  calendarPillTextActive: {
    color: '#17365D',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  dateTimeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeCol: {
    flex: 1,
  },
  addAttendeeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addAttendeeInput: {
    flex: 1,
  },
  addAttendeeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeesPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  attendeePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  attendeePillText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  saveEventBtn: {
    backgroundColor: '#17365D',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEventBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  /* Add Calendar Modal */
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2.5,
    borderColor: '#0F172A',
  },

  /* Dropdowns */
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 6,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  dropdownItemTextActive: {
    fontWeight: '700',
    color: '#2563EB',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  /* Inline Add Calendar inside Dropdown */
  inlineAddCalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 6,
  },
  inlineAddCalTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  inlineAddCalTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  inlineAddCalBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  inlineAddCalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  inlineAddCalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },
  inlineColorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  inlineColorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineColorDotActive: {
    borderWidth: 2.5,
    borderColor: '#0F172A',
  },
  inlineAddCalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  inlineCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  inlineCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  inlineSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#17365D',
  },
  inlineSaveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Timing Card & Date Shortcuts */
  timingCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  timingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timingSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateShortcutsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dateShortcutPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dateShortcutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Meeting Card Box */
  meetingToggleCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  meetingToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meetingToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetingToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  meetingToggleDesc: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 6,
    lineHeight: 16,
  },
});
