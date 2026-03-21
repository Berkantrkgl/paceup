import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { COLORS } from '@/constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.3)',
        tabBarStyle: {
          backgroundColor: '#111111',
          height: Platform.OS === 'ios' ? 96 : 72,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          paddingBottom: Platform.OS === 'ios' ? 34 : 12,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name='(home)'
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='calendar'
        options={{
          title: 'Takvim',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='plans'
        options={{
          title: 'Planlama',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "walk" : "walk-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
