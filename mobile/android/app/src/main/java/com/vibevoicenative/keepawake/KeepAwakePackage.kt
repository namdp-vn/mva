package com.vibevoicenative.keepawake

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class KeepAwakePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == KeepAwakeModule.NAME) KeepAwakeModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      KeepAwakeModule.NAME to ReactModuleInfo(
        KeepAwakeModule.NAME,
        KeepAwakeModule.NAME,
        false,
        false,
        true,
        false,
        false,
      ),
    )
  }
}
