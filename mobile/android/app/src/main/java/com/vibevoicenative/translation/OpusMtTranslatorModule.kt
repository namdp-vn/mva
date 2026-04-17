package com.vibevoicenative.translation

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule

@ReactModule(name = OpusMtTranslatorModule.NAME)
class OpusMtTranslatorModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TurboModule {

  private val helper = OpusMtTranslatorHelper(reactContext)

  override fun getName(): String = NAME

  @ReactMethod
  fun initialize(promise: Promise) {
    promise.resolve(helper.initialize())
  }

  @ReactMethod
  fun translate(text: String, srcLang: String, promise: Promise) {
    try {
      val result = helper.translate(text, srcLang)
      promise.resolve(result)
    } catch (e: TranslationException) {
      promise.reject("OPUS_ERROR", e.message, e)
    } catch (e: Exception) {
      promise.reject("OPUS_UNEXPECTED", e.message, e)
    }
  }

  @ReactMethod
  fun isLoaded(promise: Promise) {
    promise.resolve(helper.isLoaded())
  }

  @ReactMethod
  fun isLanguagePairReady(srcLang: String, tgtLang: String, promise: Promise) {
    promise.resolve(helper.isLanguagePairReady(srcLang, tgtLang))
  }

  @ReactMethod
  fun unload(promise: Promise) {
    helper.unload()
    promise.resolve(null)
  }

  companion object {
    const val NAME = "OpusMtTranslatorModule"
  }
}