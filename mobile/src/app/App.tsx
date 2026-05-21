import React, {useEffect} from 'react';
import {Appearance, StatusBar} from 'react-native';
import {RootNavigator} from './navigation/RootNavigator';
import {initI18n} from '../i18n';
import {useSettingsStore} from '../shared/store/settingsStore';

export function App(): React.JSX.Element {
  const isLight = Appearance.getColorScheme() === 'light';

  useEffect(() => {
    // After AsyncStorage hydrates, apply the persisted app language to i18n.
    const applyStored = (state: {appLanguage: string}) => {
      initI18n(state.appLanguage as any);
    };
    if (useSettingsStore.persist.hasHydrated()) {
      applyStored(useSettingsStore.getState());
    }
    const unsub = useSettingsStore.persist.onFinishHydration(applyStored);
    return () => { unsub(); };
  }, []);

  return (
    <>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} translucent />
      <RootNavigator />
    </>
  );
}

export default App;
