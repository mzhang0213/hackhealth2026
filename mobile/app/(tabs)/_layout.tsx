import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { HUD } from '@/constants/hud-theme';

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      {focused && (
        <View
          style={{
            position: 'absolute',
            top: -8,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: HUD.cyan,
            opacity: 0.9,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: HUD.cyan,
                  shadowOffset: { width: 0, height: 0 },
                  shadowRadius: 4,
                  shadowOpacity: 0.8,
                }
              : {}),
          }}
        />
      )}
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: HUD.cyan,
        tabBarInactiveTintColor: 'rgba(0,212,255,0.35)',
        tabBarStyle: {
          backgroundColor: HUD.bg,
          borderTopColor: 'rgba(0,212,255,0.25)',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: HUD.mono,
          fontSize: 9,
          letterSpacing: 2,
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'EXERCISES',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="barbell-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="injury"
        options={{
          title: 'INJURY',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="body-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'EXPLORE',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="compass-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
