import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronRight,
  FolderKanban,
  CheckSquare,
  Sparkles,
  FileText,
  Video,
  Clock,
  Calendar,
  CalendarDays,
  Bell,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { theme } from '../../constants/theme';
import { usePermissionStore } from '../../store/permissionStore';

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  screenName: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconColor: string;
  iconBg: string;
  badgeBg: string;
  badgeColor: string;
}

const ACTION_ITEMS: ActionItem[] = [

  
  {
    id: 'projects',
    title: 'Project & Portfolio',
    subtitle: 'View active projects, budget tracking, and milestones',
    badge: 'PORTFOLIO',
    screenName: 'ProjectsScreen',
    icon: FolderKanban,
    iconColor: '#2563EB',
    iconBg: '#EFF6FF',
    badgeBg: '#DBEAFE',
    badgeColor: '#1D4ED8',
  },
  {
    id: 'tasks',
    title: 'Task Management',
    subtitle: 'Manage tasks, Kanban backlog, and calendar schedules',
    badge: 'WORKFLOW',
    screenName: 'TasksScreen',
    icon: CheckSquare,
    iconColor: '#059669',
    iconBg: '#ECFDF5',
    badgeBg: '#D1FAE5',
    badgeColor: '#065F46',
  },
  {
    id: 'notes',
    title: 'Notes & Scratchpad',
    subtitle: 'Personal sticky notes, ideas, checklists, and scratchpad',
    badge: 'WORKSPACE',
    screenName: 'NotesScratchpadScreen',
    icon: FileText,
    iconColor: '#D97706',
    iconBg: '#FFFBEB',
    badgeBg: '#FEF3C7',
    badgeColor: '#92400E',
  },
    
  {
    id: 'meetings',
    title: 'Meeting & Whiteboard',
    subtitle: 'Start instant video sync, room scheduling, and live whiteboard',
    badge: 'COLLABORATION',
    screenName: 'MeetingsScreen',
    icon: Video,
    iconColor: '#7C3AED',
    iconBg: '#F5F3FF',
    badgeBg: '#EDE9FE',
    badgeColor: '#5B21B6',
  },
  {
    id: 'calendar',
    title: 'Calendar & Schedule',
    subtitle: 'Unified workspace calendar, schedule events, and meetings',
    badge: 'SCHEDULE',
    screenName: 'CalendarScreen',
    icon: CalendarDays,
    iconColor: '#6366F1',
    iconBg: '#EEF2FF',
    badgeBg: '#E0E7FF',
    badgeColor: '#4338CA',
  },
  {
    id: 'reminders',
    title: 'Reminder Center',
    subtitle: 'Centralized alerting, snooze workflows, and escalation rules',
    badge: 'ALERTS',
    screenName: 'ReminderCenterScreen',
    icon: Bell,
    iconColor: '#F43F5E',
    iconBg: '#FFF1F2',
    badgeBg: '#FFE4E6',
    badgeColor: '#BE123C',
  },
  {
    id: 'attendance',
    title: 'Attendance & Shifts',
    subtitle: 'Digital punch in/out, shift timelines, and monthly logs',
    badge: 'OPERATIONS',
    screenName: 'AttendanceScreen',
    icon: Clock,
    iconColor: '#0284C7',
    iconBg: '#F0F9FF',
    badgeBg: '#E0F2FE',
    badgeColor: '#075985',
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    subtitle: 'Weekly hours logging, billable tracking, and team approvals',
    badge: 'TRACKING',
    screenName: 'TimesheetsScreen',
    icon: Calendar,
    iconColor: '#E11D48',
    iconBg: '#FFF1F2',
    badgeBg: '#FFE4E6',
    badgeColor: '#9F1239',
  },
];

export const AddMenuScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { hasPermission, isAdmin } = usePermissionStore();

  const handleBackToHome = () => {
    navigation.navigate('Main', { screen: 'HomeTab' });
  };

  useEffect(() => {
    const onBackPress = () => {
      navigation.navigate('Main', { screen: 'HomeTab' });
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => subscription.remove();
  }, [navigation]);

  // Filter modules based on user permissions
  const allowedActionItems = ACTION_ITEMS.filter((item) => {
    if (isAdmin) return true;
    if (item.id === 'calendar' || item.id === 'reminders') return true;
    return hasPermission(item.id, 'read');
  });

  const handleNavigate = (item: ActionItem) => {
    if (
      !isAdmin &&
      item.id !== 'calendar' &&
      item.id !== 'reminders' &&
      !hasPermission(item.id, 'read')
    ) {
      return;
    }
    navigation.navigate(item.screenName);
  };

  if (allowedActionItems.length === 0) {
    return (
      <NoPermissionView
        moduleName="Quick Actions"
        headerTitle="Quick Actions"
        onBackPress={handleBackToHome}
      />
    );
  }

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      {/* Full Screen Header */}
      <AppHeader
        title="Quick Actions"
        onBackPress={handleBackToHome}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Action List Cards */}
        <View style={styles.actionsList}>
          {allowedActionItems.map((item) => {
            const IconComponent = item.icon;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.actionCard}
                activeOpacity={0.75}
                onPress={() => handleNavigate(item)}
              >
                {/* Left Icon */}
                <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                  <IconComponent size={24} color={item.iconColor} strokeWidth={2.2} />
                </View>

                {/* Center Content */}
                <View style={styles.cardContent}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={[styles.tagBadge, { backgroundColor: item.badgeBg }]}>
                      <Text style={[styles.tagBadgeText, { color: item.badgeColor }]}>
                        {item.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </View>

                {/* Right Arrow Button */}
                <View style={styles.arrowWrap}>
                  <ChevronRight size={18} color="#94A3B8" strokeWidth={2.4} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sparkleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  introBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.heavy,
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  actionsList: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.heavy,
    letterSpacing: 0.4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  arrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
