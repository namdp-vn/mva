#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(TTSSpeakerModule, RCTEventEmitter)

RCT_EXTERN_METHOD(speak:(NSString *)text
                  language:(NSString *)language
                  rate:(float)rate)

RCT_EXTERN_METHOD(stopAndClear:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isSpeaking:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
