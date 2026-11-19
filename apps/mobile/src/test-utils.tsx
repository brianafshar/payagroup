import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { ThemeProvider } from './theme';
import { ToastHost } from './ui';

const Stack = createNativeStackNavigator();

/** Renders one screen inside theme + navigation (other routes are empty stubs). */
export async function renderScreen(Screen: ComponentType, params?: object) {
  const Stub = () => null;
  return await render(
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Under test" component={Screen} initialParams={params} />
          {['Tabs', 'Exercise', 'Log', 'Complete', 'Measure', 'Records', 'Health', 'Chat', 'Login', 'Invite'].map((n) => (
            <Stack.Screen key={n} name={n} component={Stub} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
      <ToastHost />
    </ThemeProvider>,
  );
}
