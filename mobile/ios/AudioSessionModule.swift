import AVFoundation
import Foundation
import React
import UIKit

@objc(AudioSessionModule)
class AudioSessionModule: RCTEventEmitter {

  private var hasObservers = false
  private var interruptionObserver: NSObjectProtocol?

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
        // Force built-in mic even when wired earphones are connected.
        // iOS auto-routes input to the EarPod mic when earphones are plugged in,
        // but VAD thresholds are tuned for the iPhone mic capturing room audio.
        if let inputs = session.availableInputs,
           let builtIn = inputs.first(where: { $0.portType == .builtInMic }) {
            try session.setPreferredInput(builtIn)
        }
        self.registerInterruptionObserver()
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
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        resolve(true)
      } catch {
        reject("audio_session_deactivation_failed", error.localizedDescription, error)
      }
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
