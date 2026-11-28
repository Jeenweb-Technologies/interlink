import React, { useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Home,
  MessageSquare,
  Database,
  UserCheck,
  Plus,
} from 'lucide-react-native';
import { HomeScreen } from '../screens/main/HomeScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { MasterNavigator } from './MasterNavigator';
import { MainTabParamList } from './types';
import { theme } from '../constants/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface CenterButtonProps {
  style?: any;
  onPress?: () => void;
}

const CenterAddButton: React.FC<CenterButtonProps> = ({ style }) => {
  const navigation = useNavigation<any>();
  return (
    <View style={[style, styles.centerButtonSlot]} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.centerButtonHalo}
        onPress={() => {
          navigation.navigate('AddMenuScreen');
        }}
        activeOpacity={0.82}
        accessibilityLabel="Quick Actions"
      >
        <View style={styles.centerButtonInner}>
          <Plus size={22} color="#FFFFFF" strokeWidth={2.8} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const renderCenterAddButton = (props: any) => <CenterAddButton {...props} />;
const renderNullLabel = () => null;

const renderHomeIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <View style={focused ? styles.activeIconWrap : undefined}>
    <Home size={size} color={color} />
  </View>
);

const renderChatIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <View style={focused ? styles.activeIconWrap : undefined}>
    <MessageSquare size={size} color={color} />
  </View>
);

const renderMasterIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <View style={focused ? styles.activeIconWrap : undefined}>
    <Database size={size} color={color} />
  </View>
);

const renderProfileIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
  <View style={focused ? styles.activeIconWrap : undefined}>
    <UserCheck size={size} color={color} />
  </View>
);

export const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  // Safe bottom inset to ensure the bottom tab bar and gesture bar/buttons never overlap
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);

  const dynamicTabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        height: 60 + safeBottom,
        paddingBottom: safeBottom,
      },
    ],
    [safeBottom]
  );

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: dynamicTabBarStyle,
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: renderHomeIcon,
        }}
      />

      <Tab.Screen
        name="ChatTab"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: renderChatIcon,
          tabBarHideOnKeyboard: true,
        }}
      />

      <Tab.Screen
        name="AddActionTab"
        component={renderNullLabel}
        options={{
          tabBarLabel: renderNullLabel,
          tabBarButton: renderCenterAddButton,
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
          },
        })}
      />

      <Tab.Screen
        name="MasterTab"
        component={MasterNavigator}
        options={{
          tabBarLabel: 'Master',
          tabBarIcon: renderMasterIcon,
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: renderProfileIcon,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 6,
    overflow: 'visible',
    ...theme.shadows.md,
  },
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
  },
  activeIconWrap: {
    transform: [{ scale: 1.05 }],
  },
  centerButtonSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  centerButtonHalo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    transform: [{ translateY: -16 }],
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  centerButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
