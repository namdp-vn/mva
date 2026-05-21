import AVFoundation
import Foundation
import React

@objc(TTSSpeakerModule)
class TTSSpeakerModule: RCTEventEmitter, AVSpeechSynthesizerDelegate {

  private let synthesizer = AVSpeechSynthesizer()
  private var queue: [(text: String, lang: String, rate: Float)] = []
  private var isBusy = false
  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["tts_started", "tts_finished"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  // MARK: - Bridge methods

  @objc
  func speak(_ text: String, language: String, rate: Float) {
    DispatchQueue.main.async {
      self.queue.append((text: text, lang: language, rate: rate))
      if !self.isBusy {
        self.drainQueue()
      }
    }
  }

  @objc
  func stopAndClear(_ resolve: @escaping (Any?) -> Void,
                    reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      self.queue.removeAll()
      self.isBusy = false
      self.synthesizer.stopSpeaking(at: .immediate)
      resolve(true)
    }
  }

  @objc
  func isSpeaking(_ resolve: @escaping (Any?) -> Void,
                  reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      resolve(self.synthesizer.isSpeaking)
    }
  }

  // MARK: - Queue management

  private func drainQueue() {
    guard !queue.isEmpty else {
      isBusy = false
      return
    }
    isBusy = true
    let item = queue.removeFirst()
    speakItem(item)
  }

  private func speakItem(_ item: (text: String, lang: String, rate: Float)) {
    let utterance = AVSpeechUtterance(string: item.text)
    utterance.rate = item.rate
    utterance.pitchMultiplier = 1.0
    utterance.volume = 1.0

    let tag = bcp47Tag(for: item.lang)
    if let voice = AVSpeechSynthesisVoice(language: tag) {
      utterance.voice = voice
    }

    synthesizer.speak(utterance)
  }

  private func bcp47Tag(for lang: String) -> String {
    switch lang.lowercased() {
    case "vi": return "vi-VN"
    case "en": return "en-US"
    case "ja": return "ja-JP"
    case "ko": return "ko-KR"
    case "zh": return "zh-CN"
    default:   return lang
    }
  }

  // MARK: - AVSpeechSynthesizerDelegate

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
    if hasListeners {
      sendEvent(withName: "tts_started", body: nil)
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    if hasListeners {
      sendEvent(withName: "tts_finished", body: nil)
    }
    DispatchQueue.main.async {
      self.drainQueue()
    }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    DispatchQueue.main.async {
      self.isBusy = false
    }
  }
}
