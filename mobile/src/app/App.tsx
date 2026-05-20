/**
 * Vibevoice App Entry Point
 * React Native TypeScript application shell
 */

import React from 'react';
import {Appearance, StatusBar} from 'react-native';
import {RootNavigator} from './navigation/RootNavigator';
import {initI18n} from '../i18n';
import {useSettingsStore} from '../shared/store/settingsStore';

// Init i18n synchronously before first render using persisted language preference
const persistedState = useSettingsStore.getState();
initI18n(persistedState.appLanguage);

export function App(): React.JSX.Element {
  const isLight = Appearance.getColorScheme() === 'light';
  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} translucent />
      <RootNavigator />
    </>
  );
}

export default App;
