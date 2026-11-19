import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts, Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { branding, restoreBranding, restoreSession } from './api/auth';
import { RootNavigator } from './navigation/RootNavigator';
import { ThemeProvider, useTheme } from './theme';
import { ToastHost } from './ui';

// The athlete app is Persian-only: lay everything out right-to-left.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'fa';
}

function Shell() {
  const { mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      <ToastHost />
    </>
  );
}

export default function App() {
  const [loaded] = useFonts({
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_600SemiBold,
    Vazirmatn_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  const { theme } = branding.use();
  useEffect(() => {
    restoreBranding();
    void restoreSession();
  }, []);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      {/* White-label: in live mode the theme comes from the coach's branding (`ali-fitness`, `northline`, …). */}
      <ThemeProvider brand={theme}>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
