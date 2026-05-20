/**
 * Vibevoice App Entry Point
 * React Native TypeScript application shell
 */

import React, {useEffect} from 'react';
import {Appearance, StatusBar} from 'react-native';
import {RootNavigator} from './navigation/RootNavigator';
import {initI18n} from '../i18n';
import {useSettingsStore} from '../shared/store/settingsStore';

export function App(): React.JSX.Element {
  const isLight = Appearance.getColorScheme() === 'light';

  // After AsyncStorage hydration, apply the persisted app language.
  useEffect(() => {
    const apply = (state: {appLanguage: string}) => initI18n(state.appLanguage as any);
    if (useSettingsStore.persist.hasHydrated()) {
      apply(useSettingsStore.getState());
    }
    return useSettingsStore.persist.onFinishHydration(apply);
  }, []);

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} translucent />
      <RootNavigator />
    </>
  );
}

export default App;
