
import { Tabs } from 'expo-router';

import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';


export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: 'red',
      }}
    >
      <Tabs.Screen name='(home)' options={{
        title: 'Home',
        tabBarIcon: ({color, size}) => (<AntDesign name="home" size={size} color={color} />)
      }}/>
      <Tabs.Screen name='calendar' options={{
        title: 'Calendar',
        tabBarIcon: ({color, size}) => (<FontAwesome name="calendar" size={size} color={color} />)
      }}/>
      <Tabs.Screen name='profile' options={{
        tabBarBadge: 3,
        title: 'Profile',
        tabBarIcon: ({color, size}) => (<MaterialIcons name="account-circle" size={size} color={color} />)
      }}/>
    </Tabs>
  );
}
