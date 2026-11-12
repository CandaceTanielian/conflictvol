import type React from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import Shell from './src/components/Shell';
import Alerts from './src/screens/Alerts';
import Archive from './src/screens/Archive';
import Auth from './src/screens/Auth';
import Conflicts from './src/screens/Conflicts';
import Exposure from './src/screens/Exposure';
import Notifications from './src/screens/Notifications';
import Overview from './src/screens/Overview';
import Projections from './src/screens/Projections';
import Settings from './src/screens/Settings';
import { AppProvider, Screen, useApp } from './src/state';
import { C } from './src/theme';
import { FadeIn } from './src/motion';

const SCREENS: Record<Screen, () => React.ReactElement | null> = {
  overview: Overview, projections: Projections, conflicts: Conflicts, exposure: Exposure,
  archive: Archive, alerts: Alerts, notifications: Notifications, settings: Settings,
};

function Root() {
  const { user, ready, screen } = useApp();
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.lime} /></View>;
  if (!user) return <Auth />;
  const Page = SCREENS[screen];
  return <Shell><FadeIn key={screen} distance={14} duration={380}><Page /></FadeIn></Shell>;
}

export default function App() {
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold });
  useEffect(() => { if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = 'ConflictVol — Market Intelligence'; }, []);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.ink }} />;
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Root />
    </AppProvider>
  );
}
