import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Clipboard,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import {
  Video,
  VideoOff,
  Calendar,
  Clock,
  Search,
  Plus,
  Play,
  Share2,
  Copy,
  PenTool,
  RotateCcw,
  Trash2,
  Save,
  X,
  CheckCircle2,
  Layers,
  Sparkles,
  Radio,
} from 'lucide-react-native';
import { AppHeader } from '../../components/common/AppHeader';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { usePermissionStore } from '../../store/permissionStore';
import {
  getMeetings,
  createInstantMeeting,
  scheduleMeeting,
  saveMeetingWhiteboard,
  getMeetingWhiteboard,
  MeetingItem,
} from '../../api/meetingApi';
import { fetchProjects, ProjectItem } from '../../api/projectApi';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../constants/theme';

interface DrawPath {
  d: string;
  color: string;
  width: number;
  opacity: number;
}

const COLOR_PALETTE = ['#2563EB', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#0F172A'];
const STROKE_WIDTHS = [2, 4, 8];

export const MeetingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { hasPermission, isAdmin } = usePermissionStore();

  const canReadMeetings =
    isAdmin ||
    user?.role === 'admin' ||
    user?.role === 'super admin' ||
    hasPermission('meetings', 'read');

  if (!canReadMeetings) {
    return (
      <NoPermissionView
        moduleName="Meetings & Whiteboard"
        headerTitle="Meetings"
        onBackPress={() => navigation.goBack()}
      />
    );
  }

  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'live' | 'scheduled' | 'ended' | 'whiteboard'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInstantCreating, setIsInstantCreating] = useState(false);

  // Scheduler Modal State
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDesc, setScheduleDesc] = useState('');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [isLobbyEnabled, setIsLobbyEnabled] = useState(true);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Whiteboard State
  const [activeWhiteboardMeetingId, setActiveWhiteboardMeetingId] = useState<number | null>(null);
  const [activeWhiteboardTitle, setActiveWhiteboardTitle] = useState('General Canvas');
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [selectedColor, setSelectedColor] = useState('#2563EB');
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [isSavingWhiteboard, setIsSavingWhiteboard] = useState(false);
  const currentPathRef = useRef<string>('');

  // Fetch Meetings
  const fetchMeetingsList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMeetings({
        status: filterTab === 'whiteboard' ? 'all' : filterTab,
        search: searchQuery.trim() || undefined,
      });
      if (res.success && res.data?.meetings) {
        setMeetings(res.data.meetings);
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, [filterTab, searchQuery]);

  useEffect(() => {
    fetchMeetingsList();
  }, [fetchMeetingsList]);

  // Load projects for scheduler
  useEffect(() => {
    fetchProjects()
      .then((res: any) => {
        if (res.success && res.data) {
          setProjectsList(Array.isArray(res.data) ? res.data : res.data.projects || []);
        }
      })
      .catch(() => {});
  }, []);

  // Handle Start Instant Meeting
  const handleStartInstant = async () => {
    try {
      setIsInstantCreating(true);
      const res = await createInstantMeeting({
        title: `${user?.name || user?.username || 'Team'}'s Instant Meeting`,
        is_lobby_enabled: true,
      });

      if (res.success && res.data?.meeting) {
        const newMeeting = res.data.meeting;
        Alert.alert(
          'Instant Meeting Created!',
          `Room Code: ${newMeeting.room_code}\nTitle: ${newMeeting.title}`,
          [
            {
              text: 'Copy Code',
              onPress: () => Clipboard.setString(newMeeting.room_code),
            },
            {
              text: 'Open Whiteboard',
              onPress: () => openWhiteboardForMeeting(newMeeting),
            },
            { text: 'OK', style: 'cancel' },
          ]
        );
        fetchMeetingsList();
      } else {
        Alert.alert('Notice', res.message || 'Failed to start instant meeting');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start instant meeting');
    } finally {
      setIsInstantCreating(false);
    }
  };

  // Handle Schedule Meeting Submission
  const handleScheduleSubmit = async () => {
    if (!scheduleTitle.trim()) {
      Alert.alert('Required', 'Please enter a meeting title');
      return;
    }

    try {
      setSubmittingSchedule(true);
      const scheduledStart = new Date(`${scheduleDate}T${scheduleTime}:00`);
      const res = await scheduleMeeting({
        title: scheduleTitle.trim(),
        description: scheduleDesc.trim() || undefined,
        scheduled_start: scheduledStart.toISOString(),
        duration_minutes: scheduleDuration,
        project_id: selectedProjectId,
        is_lobby_enabled: isLobbyEnabled,
      });

      if (res.success) {
        Alert.alert('Success', 'Meeting scheduled successfully!');
        setIsSchedulerOpen(false);
        setScheduleTitle('');
        setScheduleDesc('');
        fetchMeetingsList();
      } else {
        Alert.alert('Notice', res.message || 'Failed to schedule meeting');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to schedule meeting');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // Open Whiteboard for a specific meeting
  const openWhiteboardForMeeting = async (meeting?: MeetingItem) => {
    const meetingId = meeting ? meeting.id : 0;
    setActiveWhiteboardMeetingId(meetingId);
    setActiveWhiteboardTitle(meeting ? meeting.title : 'Whiteboard Studio');
    setFilterTab('whiteboard');

    if (meetingId > 0) {
      try {
        const res = await getMeetingWhiteboard(meetingId);
        if (res.success && res.data?.whiteboard?.canvas_data) {
          const parsed = JSON.parse(res.data.whiteboard.canvas_data);
          if (Array.isArray(parsed)) {
            setPaths(parsed);
          }
        } else {
          setPaths([]);
        }
      } catch {
        setPaths([]);
      }
    } else {
      setPaths([]);
    }
  };

  // Save Whiteboard
  const handleSaveWhiteboard = async () => {
    if (!activeWhiteboardMeetingId || activeWhiteboardMeetingId <= 0) {
      Alert.alert('Saved locally', 'Canvas artwork preserved for this session.');
      return;
    }

    try {
      setIsSavingWhiteboard(true);
      const canvasStr = JSON.stringify(paths);
      const res = await saveMeetingWhiteboard(activeWhiteboardMeetingId, { canvas_data: canvasStr });
      if (res.success) {
        Alert.alert('Saved', 'Whiteboard saved successfully to the meeting record.');
      } else {
        Alert.alert('Notice', res.message || 'Could not save whiteboard.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Save failed');
    } finally {
      setIsSavingWhiteboard(false);
    }
  };

  // Copy Room Code
  const handleCopyCode = (roomCode: string) => {
    Clipboard.setString(roomCode);
    Alert.alert('Copied', `Room Code ${roomCode} copied to clipboard!`);
  };

  // PanResponder for Interactive Whiteboard Drawing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
      },
      onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          const newPath: DrawPath = {
            d: currentPathRef.current,
            color: currentTool === 'eraser' ? '#FFFFFF' : selectedColor,
            width: currentTool === 'eraser' ? 24 : currentTool === 'highlighter' ? 16 : selectedWidth,
            opacity: currentTool === 'highlighter' ? 0.35 : 1,
          };
          setPaths((prev) => [...prev, newPath]);
          currentPathRef.current = '';
        }
      },
    })
  ).current;

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Meetings & Whiteboard"
        onBackPress={() => navigation.goBack()}
        showBack
      />

      {/* Action Header Banner */}
      <View style={styles.actionHeaderCard}>
        <View style={styles.actionHeaderTop}>
          <View style={styles.actionIconWrap}>
            <Video size={24} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionHeaderTitle}>Studio & Conference</Text>
            <Text style={styles.actionHeaderSubtitle}>
              Interactive collaboration, meetings & drawing
            </Text>
          </View>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.instantBtn, isInstantCreating && styles.btnDisabled]}
            activeOpacity={0.8}
            onPress={handleStartInstant}
            disabled={isInstantCreating}
          >
            {isInstantCreating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Play size={15} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.instantBtnText}>Instant Meeting</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scheduleBtn}
            activeOpacity={0.8}
            onPress={() => setIsSchedulerOpen(true)}
          >
            <Calendar size={15} color="#17365D" />
            <Text style={styles.scheduleBtnText}>Schedule</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs & Whiteboard Tab */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <TouchableOpacity
            style={[styles.tabPill, filterTab === 'all' && styles.tabPillActive]}
            onPress={() => setFilterTab('all')}
          >
            <Layers size={13} color={filterTab === 'all' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabPillText, filterTab === 'all' && styles.tabPillTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, filterTab === 'live' && styles.tabPillActive]}
            onPress={() => setFilterTab('live')}
          >
            <Radio size={13} color={filterTab === 'live' ? '#FFFFFF' : '#EF4444'} />
            <Text style={[styles.tabPillText, filterTab === 'live' && styles.tabPillTextActive]}>
              Live Now
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, filterTab === 'scheduled' && styles.tabPillActive]}
            onPress={() => setFilterTab('scheduled')}
          >
            <Clock size={13} color={filterTab === 'scheduled' ? '#FFFFFF' : '#2563EB'} />
            <Text style={[styles.tabPillText, filterTab === 'scheduled' && styles.tabPillTextActive]}>
              Scheduled
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, filterTab === 'ended' && styles.tabPillActive]}
            onPress={() => setFilterTab('ended')}
          >
            <CheckCircle2 size={13} color={filterTab === 'ended' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.tabPillText, filterTab === 'ended' && styles.tabPillTextActive]}>
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, styles.tabPillWhiteboard, filterTab === 'whiteboard' && styles.tabPillWhiteboardActive]}
            onPress={() => openWhiteboardForMeeting()}
          >
            <PenTool size={13} color={filterTab === 'whiteboard' ? '#FFFFFF' : '#D97706'} />
            <Text
              style={[
                styles.tabPillText,
                styles.tabPillTextAmber,
                filterTab === 'whiteboard' && styles.tabPillTextActive,
              ]}
            >
              Whiteboard Studio
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {filterTab === 'whiteboard' ? (
        /* Whiteboard Studio Mode */
        <View style={styles.whiteboardContainer}>
          {/* Whiteboard Controls Toolbar */}
          <View style={styles.wbToolbar}>
            <View style={styles.wbHeaderRow}>
              <View style={styles.wbTitleCol}>
                <Text style={styles.wbTitleText}>{activeWhiteboardTitle}</Text>
                <Text style={styles.wbSubtitleText}>Draw, sketch or highlight</Text>
              </View>
              <View style={styles.wbActionRow}>
                <TouchableOpacity
                  style={styles.wbIconBtn}
                  onPress={() => setPaths((prev) => prev.slice(0, -1))}
                  accessibilityLabel="Undo"
                >
                  <RotateCcw size={16} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.wbIconBtn}
                  onPress={() => setPaths([])}
                  accessibilityLabel="Clear"
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wbSaveBtn, isSavingWhiteboard && styles.btnDisabled]}
                  onPress={handleSaveWhiteboard}
                  disabled={isSavingWhiteboard}
                >
                  {isSavingWhiteboard ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Save size={14} color="#FFFFFF" />
                      <Text style={styles.wbSaveText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Tool Selection */}
            <View style={styles.wbToolRow}>
              <TouchableOpacity
                style={[styles.wbToolChip, currentTool === 'pen' && styles.wbToolChipActive]}
                onPress={() => setCurrentTool('pen')}
              >
                <PenTool size={13} color={currentTool === 'pen' ? '#FFFFFF' : '#475569'} />
                <Text style={[styles.wbToolChipText, currentTool === 'pen' && styles.wbToolChipTextActive]}>
                  Pen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.wbToolChip, currentTool === 'highlighter' && styles.wbToolChipActive]}
                onPress={() => setCurrentTool('highlighter')}
              >
                <Sparkles size={13} color={currentTool === 'highlighter' ? '#FFFFFF' : '#475569'} />
                <Text style={[styles.wbToolChipText, currentTool === 'highlighter' && styles.wbToolChipTextActive]}>
                  Highlighter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.wbToolChip, currentTool === 'eraser' && styles.wbToolChipActive]}
                onPress={() => setCurrentTool('eraser')}
              >
                <Text style={[styles.wbToolChipText, currentTool === 'eraser' && styles.wbToolChipTextActive]}>
                  Eraser
                </Text>
              </TouchableOpacity>

              {/* Color Swatches */}
              <View style={styles.wbPaletteRow}>
                {COLOR_PALETTE.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      selectedColor === c && styles.colorDotSelected,
                    ]}
                    onPress={() => setSelectedColor(c)}
                  />
                ))}
              </View>

              {/* Stroke Widths */}
              <View style={styles.strokeWidthRow}>
                {STROKE_WIDTHS.map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[
                      styles.strokeDotWrap,
                      selectedWidth === w && styles.strokeDotWrapActive,
                    ]}
                    onPress={() => setSelectedWidth(w)}
                  >
                    <View
                      style={[
                        styles.strokeDot,
                        { width: w * 2.5, height: w * 2.5, borderRadius: (w * 2.5) / 2 },
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Interactive Canvas Area */}
          <View style={styles.canvasArea} {...panResponder.panHandlers}>
            <Svg style={StyleSheet.absoluteFill}>
              {paths.map((p, idx) => (
                <Path
                  key={`path-${idx}`}
                  d={p.d}
                  stroke={p.color}
                  strokeWidth={p.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={p.opacity}
                />
              ))}
            </Svg>
            {paths.length === 0 && (
              <View style={styles.canvasEmptyOverlay} pointerEvents="none">
                <Text style={styles.canvasEmptyText}>Use your finger to draw on canvas</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Meetings List Mode */
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <Search size={16} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title or room code..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={fetchMeetingsList}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading meetings studio...</Text>
            </View>
          ) : meetings.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <VideoOff size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Meetings Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No meetings match your search query.'
                  : 'Start an instant meeting or schedule one for your team.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={handleStartInstant}
              >
                <Plus size={15} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>Start Instant Meeting</Text>
              </TouchableOpacity>
            </View>
          ) : (
            meetings.map((m) => {
              const isLive = m.status === 'live';
              const isScheduled = m.status === 'scheduled';
              const isEnded = m.status === 'ended';

              return (
                <View key={m.id} style={styles.meetingCard}>
                  {/* Top Status & Room Code */}
                  <View style={styles.cardHeader}>
                    {isLive && (
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveBadgeText}>LIVE NOW</Text>
                      </View>
                    )}
                    {isScheduled && (
                      <View style={styles.scheduledBadge}>
                        <Clock size={11} color="#2563EB" />
                        <Text style={styles.scheduledBadgeText}>
                          {m.meeting_type === 'instant' ? 'Green Room' : 'Scheduled'}
                        </Text>
                      </View>
                    )}
                    {isEnded && (
                      <View style={styles.endedBadge}>
                        <CheckCircle2 size={11} color="#64748B" />
                        <Text style={styles.endedBadgeText}>Completed</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.roomCodePill}
                      onPress={() => handleCopyCode(m.room_code)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.roomCodeText}>{m.room_code}</Text>
                      <Copy size={11} color="#475569" />
                    </TouchableOpacity>
                  </View>

                  {/* Title & Description */}
                  <Text style={styles.cardTitle}>{m.title}</Text>
                  {m.description ? (
                    <Text style={styles.cardDescription} numberOfLines={2}>
                      {m.description}
                    </Text>
                  ) : null}

                  {/* Tags (Project, Task) */}
                  {(m.project_name || m.task_name) && (
                    <View style={styles.tagsRow}>
                      {m.project_name && (
                        <View style={styles.projectTag}>
                          <Text style={styles.projectTagText} numberOfLines={1}>
                            📁 {m.project_name}
                          </Text>
                        </View>
                      )}
                      {m.task_name && (
                        <View style={styles.taskTag}>
                          <Text style={styles.taskTagText} numberOfLines={1}>
                            ✓ {m.task_name}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Host & Date info */}
                  <View style={styles.hostDateRow}>
                    <View style={styles.hostWrap}>
                      <View style={styles.hostAvatar}>
                        <Text style={styles.hostAvatarText}>
                          {(m.host_name || 'H').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.hostNameText} numberOfLines={1}>
                        {m.host_name || 'Host'}
                      </Text>
                    </View>

                    <Text style={styles.dateText}>
                      {m.scheduled_start
                        ? new Date(m.scheduled_start).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Instant'}
                    </Text>
                  </View>

                  {/* Bottom Actions */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.cardFooterActionBtn}
                      onPress={() => handleCopyCode(m.room_code)}
                    >
                      <Share2 size={13} color="#475569" />
                      <Text style={styles.cardFooterActionText}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cardFooterActionBtn}
                      onPress={() => openWhiteboardForMeeting(m)}
                    >
                      <PenTool size={13} color="#D97706" />
                      <Text style={[styles.cardFooterActionText, styles.textAmber]}>
                        Whiteboard
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.cardPrimaryBtn,
                        isLive && styles.cardPrimaryBtnLive,
                        isEnded && styles.cardPrimaryBtnEnded,
                      ]}
                      onPress={() => {
                        if (isEnded) {
                          Alert.alert('Meeting Summary', `Meeting ID: ${m.id}\nTitle: ${m.title}`);
                        } else {
                          openWhiteboardForMeeting(m);
                        }
                      }}
                    >
                      <Text style={styles.cardPrimaryBtnText}>
                        {isLive ? 'Join Live' : isEnded ? 'Summary' : 'Enter Room'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Schedule Meeting Modal */}
      <Modal
        visible={isSchedulerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSchedulerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Schedule Meeting</Text>
                <Text style={styles.modalHeaderSubtitle}>
                  Set date, duration & project linkage
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSchedulerOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} contentContainerStyle={styles.modalFormContent}>
              <Text style={styles.formLabel}>
                Meeting Title <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Architecture Sync & Planning"
                placeholderTextColor="#94A3B8"
                value={scheduleTitle}
                onChangeText={setScheduleTitle}
              />

              <Text style={styles.formLabel}>Agenda & Description</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                placeholder="Key topics, review points..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={scheduleDesc}
                onChangeText={setScheduleDesc}
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="2026-11-26"
                    placeholderTextColor="#94A3B8"
                    value={scheduleDate}
                    onChangeText={setScheduleDate}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>Time (HH:MM)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="10:00"
                    placeholderTextColor="#94A3B8"
                    value={scheduleTime}
                    onChangeText={setScheduleTime}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Duration (Minutes)</Text>
              <View style={styles.durationRow}>
                {[15, 30, 45, 60, 90].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.durationPill,
                      scheduleDuration === d && styles.durationPillActive,
                    ]}
                    onPress={() => setScheduleDuration(d)}
                  >
                    <Text
                      style={[
                        styles.durationPillText,
                        scheduleDuration === d && styles.durationPillTextActive,
                      ]}
                    >
                      {d}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Link Project</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectPickRow}>
                <TouchableOpacity
                  style={[
                    styles.projectPickChip,
                    selectedProjectId === undefined && styles.projectPickChipActive,
                  ]}
                  onPress={() => setSelectedProjectId(undefined)}
                >
                  <Text
                    style={[
                      styles.projectPickText,
                      selectedProjectId === undefined && styles.projectPickTextActive,
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>
                {projectsList.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.projectPickChip,
                      selectedProjectId === p.id && styles.projectPickChipActive,
                    ]}
                    onPress={() => setSelectedProjectId(p.id)}
                  >
                    <Text
                      style={[
                        styles.projectPickText,
                        selectedProjectId === p.id && styles.projectPickTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Lobby Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setIsLobbyEnabled(!isLobbyEnabled)}
                activeOpacity={0.8}
              >
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleTitle}>Enable Waiting Room / Lobby</Text>
                  <Text style={styles.toggleSubtitle}>
                    Host admits participants individually
                  </Text>
                </View>
                <View style={[styles.toggleSwitch, isLobbyEnabled && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleThumb, isLobbyEnabled && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsSchedulerOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingSchedule && styles.btnDisabled]}
                onPress={handleScheduleSubmit}
                disabled={submittingSchedule}
              >
                {submittingSchedule ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Schedule Meeting</Text>
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
  actionHeaderCard: {
    marginHorizontal: 16,
    marginTop: -28,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
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
  actionHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionTextCol: {
    flex: 1,
  },
  actionHeaderTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  actionHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  instantBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  instantBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  scheduleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  scheduleBtnText: {
    color: '#17365D',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  tabsContainer: {
    marginTop: 14,
    marginBottom: 8,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  tabPillWhiteboard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  tabPillWhiteboardActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: '#475569',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  tabPillTextAmber: {
    color: '#B45309',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 16,
    gap: 6,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  meetingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  scheduledBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#2563EB',
  },
  endedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  endedBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#64748B',
  },
  roomCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  roomCodeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#334155',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  cardDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  projectTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  projectTagText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: '#4338CA',
  },
  taskTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  taskTagText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: '#047857',
  },
  hostDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  hostWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
  hostNameText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: '#334155',
    maxWidth: 120,
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardFooterActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  cardFooterActionText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: '#475569',
  },
  textAmber: {
    color: '#D97706',
  },
  cardPrimaryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cardPrimaryBtnLive: {
    backgroundColor: '#DC2626',
  },
  cardPrimaryBtnEnded: {
    backgroundColor: '#64748B',
  },
  cardPrimaryBtnText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },

  /* Whiteboard Styles */
  whiteboardContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  wbToolbar: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  wbHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wbTitleCol: {
    flex: 1,
  },
  wbTitleText: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  wbSubtitleText: {
    fontSize: 11,
    color: '#64748B',
  },
  wbActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wbIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wbSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  wbSaveText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
  wbToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  wbToolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  wbToolChipActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  wbToolChipText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: '#475569',
  },
  wbToolChipTextActive: {
    color: '#FFFFFF',
  },
  wbPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: '#0F172A',
    transform: [{ scale: 1.2 }],
  },
  strokeWidthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  strokeDotWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  strokeDotWrapActive: {
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  strokeDot: {
    backgroundColor: '#0F172A',
  },
  canvasArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  canvasEmptyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasEmptyText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: theme.typography.weights.medium,
  },

  /* Modal Styles */
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
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalForm: {
    maxHeight: 460,
  },
  modalFormContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  requiredAsterisk: {
    color: '#EF4444',
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  formTextArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formCol: {
    flex: 1,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  durationPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semibold,
    color: '#475569',
  },
  durationPillTextActive: {
    color: '#FFFFFF',
  },
  projectPickRow: {
    gap: 8,
    paddingVertical: 4,
  },
  projectPickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  projectPickChipActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  projectPickText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: theme.typography.weights.medium,
  },
  projectPickTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.bold,
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
  toggleTextGroup: {
    flex: 1,
    marginRight: 10,
  },
  toggleTitle: {
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
    backgroundColor: '#2563EB',
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    color: '#64748B',
  },
  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
});
