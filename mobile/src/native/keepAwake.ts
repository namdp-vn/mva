import { NativeModules, Platform } from 'react-native';

type KeepAwakeNative = {
  activateKeepAwake?: () => Promise<void>;
  deactivateKeepAwake?: () => Promise<void>;
};

const nativeModule: KeepAwakeNative =
  Platform.OS === 'ios'
    ? (NativeModules.AudioSessionModule as KeepAwakeNative)
    : (NativeModules.KeepAwakeModule as KeepAwakeNative);

export async function activateKeepAwake(): Promise<void> {
  await nativeModule?.activateKeepAwake?.();
}

export async function deactivateKeepAwake(): Promise<void> {
  await nativeModule?.deactivateKeepAwake?.();
}
