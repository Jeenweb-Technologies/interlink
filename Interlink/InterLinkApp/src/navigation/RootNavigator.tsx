import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { ProjectsScreen } from '../screens/main/ProjectsScreen';
import { TasksScreen } from '../screens/main/TasksScreen';
import { NotesScratchpadScreen } from '../screens/main/NotesScratchpadScreen';
import { TaskKanbanScreen } from '../screens/tasks/TaskKanbanScreen';
import { TaskCalendarScreen } from '../screens/tasks/TaskCalendarScreen';
import { TaskGanttScreen } from '../screens/tasks/TaskGanttScreen';
import { TaskManagementListScreen } from '../screens/tasks/TaskManagementListScreen';
import { ProjectDurationLogScreen } from '../screens/tasks/ProjectDurationLogScreen';
import { TeamWorkloadScreen } from '../screens/tasks/TeamWorkloadScreen';
import { ProjectDetailScreen } from '../screens/projects/ProjectDetailScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { AddMenuScreen } from '../screens/main/AddMenuScreen';
import { MeetingsScreen } from '../screens/meetings/MeetingsScreen';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { TimesheetsScreen } from '../screens/timesheets/TimesheetsScreen';
import { CalendarScreen } from '../screens/calendar/CalendarScreen';
import { ReminderCenterScreen } from '../screens/reminders/ReminderCenterScreen';
import { RootStackParamList } from './types';
import { InterlinkLogo } from '../components/common/InterlinkLogo';
import { theme } from '../constants/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashVisible(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (isInitializing || splashVisible) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" />
        <InterlinkLogo size="xl" light subtitle="WORKSPACE PORTAL" />
        <ActivityIndicator
          size="large"
          color={theme.colors.sky}
          style={styles.splashSpinner}
        />
        <Text style={styles.splashVersion}>Interlink Mobile v1.0.0</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={!isAuthenticated ? 'Auth' : 'Main'}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen
            name="ProjectsScreen"
            component={ProjectsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TasksScreen"
            component={TasksScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="NotesScratchpadScreen"
            component={NotesScratchpadScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TaskKanbanScreen"
            component={TaskKanbanScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TaskCalendarScreen"
            component={TaskCalendarScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TaskGanttScreen"
            component={TaskGanttScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TaskManagementListScreen"
            component={TaskManagementListScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ProjectDurationLogScreen"
            component={ProjectDurationLogScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TeamWorkloadScreen"
            component={TeamWorkloadScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ProjectDetailScreen"
            component={ProjectDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="EditProfileScreen"
            component={EditProfileScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="MeetingsScreen"
            component={MeetingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="AttendanceScreen"
            component={AttendanceScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="TimesheetsScreen"
            component={TimesheetsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CalendarScreen"
            component={CalendarScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ReminderCenterScreen"
            component={ReminderCenterScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="AddMenuScreen"
            component={AddMenuScreen}
            options={{
              animation: 'slide_from_bottom',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgDarkGradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashSpinner: {
    marginTop: theme.spacing.xl,
  },
  splashVersion: {
    position: 'absolute',
    bottom: 36,
    fontSize: 12,
    color: theme.colors.textWhiteMuted,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
