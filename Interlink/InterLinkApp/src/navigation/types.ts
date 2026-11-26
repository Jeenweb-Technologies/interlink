import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  DeviceRegistration: {
    username: string;
    password: string;
  };
  PendingApproval: {
    type?: 'device' | 'organization';
    title?: string;
    message?: string;
  };
  RegisterOrg: undefined;
};

export type MasterStackParamList = {
  MasterHome: undefined;
  UserMaster: undefined;
  CompanyMaster: undefined;
  UserTypeMaster: undefined;
  DepartmentMaster: undefined;
  ChatSettingsMaster: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ChatTab: undefined;
  AddActionTab?: undefined;
  MasterTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  ProjectsScreen?: { openCreate?: boolean };
  TasksScreen?: { openCreate?: boolean };
  NotesScratchpadScreen: undefined;
  TaskKanbanScreen: undefined;
  TaskCalendarScreen: undefined;
  TaskGanttScreen: undefined;
  TaskManagementListScreen: undefined;
  ProjectDurationLogScreen: undefined;
  TeamWorkloadScreen: undefined;
  ProjectDetailScreen: { projectId: number; projectName?: string };
  EditProfileScreen: undefined;
  AddMenuScreen: undefined;
  MeetingsScreen: undefined;
  AttendanceScreen: undefined;
  TimesheetsScreen: undefined;
};
