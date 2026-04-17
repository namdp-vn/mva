package com.vibevoicenative

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.vibevoicenative.securestorage.SecureStorageBridgePackage
import com.vibevoicenative.speaker.OfflineSpeakerDiarizationPackage
import com.vibevoicenative.translation.OpusMtTranslatorPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SecureStorageBridgePackage())
          add(OfflineSpeakerDiarizationPackage())
          add(OpusMtTranslatorPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
