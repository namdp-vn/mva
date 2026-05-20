import React, {useEffect} from 'react';
import {AppState, Appearance, StatusBar} from 'react-native';
import {RootNavigator} from './navigation/RootNavigator';
import {detectDeviceLanguage, initI18n} from '../i18n';
import {useSettingsStore} from '../shared/store/settingsStore';

export function App(): React.JSX.Element {
  const isLight = Appearance.getColorScheme() === 'light';

  useEffect(() => {
    // Apply language after AsyncStorage hydration.
    // If auto mode (user hasn't manually chosen), always use current device language.
    const applyStored = (state: {appLanguage: string; appLanguageIsAuto?: boolean}) => {
      if (state.appLanguageIsAuto !== false) {
        useSettingsStore.getState().setAppLanguageAuto(detectDeviceLanguage());
      } else {
        initI18n(state.appLanguage as any);
      }
    };
    if (useSettingsStore.persist.hasHydrated()) {
      applyStored(useSettingsStore.getState());
    }
    const unsubHydration = useSettingsStore.persist.onFinishHydration(applyStored);

    // When app comes back to foreground, re-detect device language if user hasn't set one manually.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const {appLanguageIsAuto, setAppLanguageAuto} = useSettingsStore.getState();
        if (appLanguageIsAuto) {
          setAppLanguageAuto(detectDeviceLanguage());
        }
      }
    });

    return () => {
      unsubHydration();
      appStateSub.remove();
    };
  }, []);

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} translucent />
      <RootNavigator />
    </>
  );
}

export default App;
