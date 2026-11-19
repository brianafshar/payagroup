// Keeps the training tabs current (#74): reloads when the tab is focused, and pull-to-refresh.
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { refreshTraining } from '../data/live';
import { useTheme } from '../theme';

/** `refreshControl` for the screen's ScrollView. */
export function useTrainingRefresh() {
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void refreshTraining();
    }, []),
  );
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTraining(true);
    setRefreshing(false);
  }, []);
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c['brand-primary']} colors={[c['brand-primary']]} />;
}
