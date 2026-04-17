#import <React/RCTBridgeModule.h>

/**
 * Apple Translator Module Bridge
 *
 * Exposes the Swift AppleTranslatorModule to React Native.
 */
@interface RCT_EXTERN_MODULE(AppleTranslatorModule, NSObject)

RCT_EXTERN_METHOD(initialize:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(translate:(NSString *)text
                  srcLang:(NSString *)srcLang
                  tgtLang:(NSString *)tgtLang
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(translateBatch:(NSArray<NSString *> *)texts
                  srcLang:(NSString *)srcLang
                  tgtLang:(NSString *)tgtLang
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isLanguageAvailable:(NSString *)srcLang
                  tgtLang:(NSString *)tgtLang
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(downloadLanguageIfNeeded:(NSString *)srcLang
                  tgtLang:(NSString *)tgtLang
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getLanguagePackStatus:(NSString *)srcLang
                  tgtLang:(NSString *)tgtLang
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(unload:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end