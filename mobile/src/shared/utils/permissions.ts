import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';

export async function checkAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const result = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  return result;
}

export async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const hasPermission = await checkAudioPermission();
  if (hasPermission) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission Required',
      message:
        'VibeVoice needs microphone access to record and transcribe meetings.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'Allow',
    },
  );

  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    Alert.alert(
      'Permission Required',
      'Microphone permission was permanently denied. Please enable it in Settings > Apps > VibeVoice > Permissions.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: () => Linking.openSettings()},
      ],
    );
  }

  return false;
}
