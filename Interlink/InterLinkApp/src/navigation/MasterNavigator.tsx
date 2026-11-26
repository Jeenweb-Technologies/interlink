import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MasterScreen } from '../screens/master/MasterScreen';
import { UserMasterScreen } from '../screens/master/UserMasterScreen';
import { CompanyMasterScreen } from '../screens/master/CompanyMasterScreen';
import { UserTypeMasterScreen } from '../screens/master/UserTypeMasterScreen';
import { DepartmentMasterScreen } from '../screens/master/DepartmentMasterScreen';
import { ChatSettingsMasterScreen } from '../screens/master/ChatSettingsMasterScreen';
import { MasterStackParamList } from './types';

const Stack = createNativeStackNavigator<MasterStackParamList>();

export const MasterNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="MasterHome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MasterHome" component={MasterScreen} />
      <Stack.Screen name="UserMaster" component={UserMasterScreen} />
      <Stack.Screen name="CompanyMaster" component={CompanyMasterScreen} />
      <Stack.Screen name="UserTypeMaster" component={UserTypeMasterScreen} />
      <Stack.Screen name="DepartmentMaster" component={DepartmentMasterScreen} />
      <Stack.Screen name="ChatSettingsMaster" component={ChatSettingsMasterScreen} />
    </Stack.Navigator>
  );
};
