import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserProvider } from '@/context/UserContext';

export const unstable_settings = {
  anchor: 'landing',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <UserProvider>
          <Stack initialRouteName="landing">
            <Stack.Screen name="landing"     options={{ headerShown: false }} />
            <Stack.Screen name="auth"        options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
            <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
            <Stack.Screen name="modal"       options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="injury-report" options={{ title: 'Injury Profile', headerBackTitle: 'Back' }} />
          </Stack>
        </UserProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}



