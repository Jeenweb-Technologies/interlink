import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LandingScreen } from '../screens/auth/LandingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { DeviceRegistrationScreen } from '../screens/auth/DeviceRegistrationScreen';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { RegisterOrgScreen } from '../screens/auth/RegisterOrgScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="DeviceRegistration" component={DeviceRegistrationScreen} />
      <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      <Stack.Screen name="RegisterOrg" component={RegisterOrgScreen} />
    </Stack.Navigator>
  );
};
