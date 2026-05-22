import AVFoundation
import Foundation
import React
import UIKit

@objc(AudioSessionModule)
class AudioSessionModule: RCTEventEmitter {

  private var hasObservers = false
  private var interruptionObserver: NSObjectProtocol?
  private var routeChangeObserver: NSObjectProtocol?
  private var isRecordingActive = false

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["audioSessionInterrupted", "audioSessionResumed"]
  }

  override func startObserving() {
    hasObservers = true
  }

  override func stopObserving() {
    hasObservers = false
  }

  // MARK: - Built-in mic enforcement

  // Re-applies setPreferredInput(builtInMic) on every route change so that
  // when Bluetooth connects for A2DP output (TTS playback), iOS does not
  // silently switch the recording input to the Bluetooth HFP mic.
  private func enforceBuiltInMic() {
    guard isRecordingActive else { return }
    let session = AVAudioSession.sharedInstance()
    guard let inputs = session.availableInputs,
          let builtIn = inputs.first(where: { $0.portType == .builtInMic }) else { return }
    try? session.setPreferredInput(builtIn)
  }

  private func registerRouteChangeObserver() {
    guard routeChangeObserver == nil else { return }
    routeChangeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] _ in
      self?.enforceBuiltInMic()
    }
  }

  private func unregisterRouteChangeObserver() {
    if let observer = routeChangeObserver {
      NotificationCenter.default.removeObserver(observer)
      routeChangeObserver = nil
    }
  }

  // MARK: - Interruption handling

  private func registerInterruptionObserver() {
    guard interruptionObserver == nil else { return }
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      self?.handleAudioInterruption(notification)
    }
  }

  private func handleAudioInterruption(_ notification: Notification) {
    guard
      let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: typeValue)
    else { return }

    if type == .began {
      if hasObservers {
        sendEvent(withName: "audioSessionInterrupted", body: nil)
      }
    } else if type == .ended {
      let optionsValue = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
      let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
      guard options.contains(.shouldResume) else { return }

      do {
        try AVAudioSession.sharedInstance().setActive(true, options: [])
        enforceBuiltInMic()
        if hasObservers {
          sendEvent(withName: "audioSessionResumed", body: nil)
        }
      } catch {
        // Session could not be reactivated — JS will handle via onError
      }
    }
  }

  deinit {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
    }
    unregisterRouteChangeObserver()
  }

  // MARK: - Bridge methods

  @objc
  func activateRecordingSession(_ resolve: @escaping (Any?) -> Void,
                                reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
          .playAndRecord,
          mode: .default,
          options: [.allowBluetoothA2DP, .defaultToSpeaker]
        )
        try session.setPreferredSampleRate(16_000)
        try session.setPreferredIOBufferDuration(0.02)
        try session.setActive(true, options: [])
        self.isRecordingActive = true
        self.enforceBuiltInMic()
        self.registerInterruptionObserver()
        self.registerRouteChangeObserver()
        resolve(true)
      } catch {
        reject("audio_session_activation_failed", error.localizedDescription, error)
      }
    }
  }

  @objc
  func deactivateRecordingSession(_ resolve: @escaping (Any?) -> Void,
                                  reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      self.isRecordingActive = false
      self.unregisterRouteChangeObserver()
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        resolve(true)
      } catch {
        reject("audio_session_deactivation_failed", error.localizedDescription, error)
      }
    }
  }

  // Called from JS after the sherpa-onnx mic stream has fully started.
  // Re-applies setPreferredInput in case stream setup internally called
  // setCategory and reset the preferred input to nil.
  @objc
  func enforceBuiltInMicInput(_ resolve: @escaping (Any?) -> Void,
                               reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      self.enforceBuiltInMic()
      resolve(true)
    }
  }

  @objc
  func activateKeepAwake(_ resolve: @escaping (Any?) -> Void,
                         reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = true
      resolve(true)
    }
  }

  @objc
  func deactivateKeepAwake(_ resolve: @escaping (Any?) -> Void,
                            reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = false
      resolve(true)
    }
  }
}
