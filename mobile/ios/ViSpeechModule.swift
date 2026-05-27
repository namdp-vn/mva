import AVFoundation
import Foundation
import React
import Speech

/// Native wrapper around SFSpeechRecognizer (vi-VN) for continuous offline
/// Vietnamese speech recognition.  Emits the same event-shape as SenseVoice
/// (vi_speech_partial / vi_speech_final) so the JS VietnameseSpeechRecognizer
/// can map them to the shared MeetingPipelineEvent format without extra logic.
///
/// Audio strategy: keeps AVAudioEngine running across utterances; swaps a new
/// SFSpeechAudioBufferRecognitionRequest per utterance so we get clean isFinal
/// boundaries while avoiding the latency of stopping/restarting the engine.
///
/// NOTE: Add Speech.framework to "Link Binary With Libraries" in Xcode before
/// building.  NSSpeechRecognitionUsageDescription must also exist in Info.plist.
@objc(ViSpeechModule)
class ViSpeechModule: RCTEventEmitter {

    // MARK: - State

    private let recognizer: SFSpeechRecognizer? = {
        let r = SFSpeechRecognizer(locale: Locale(identifier: "vi-VN"))
        r?.defaultTaskHint = .dictation
        return r
    }()

    private var audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    private var sessionId: String = ""
    private var utteranceCounter = 0
    private var currentRevision = 0
    private var hasListeners = false
    private var isRunning = false
    private var engineStarted = false

    // MARK: - RCTEventEmitter

    override static func requiresMainQueueSetup() -> Bool { return false }

    override func supportedEvents() -> [String]! {
        return ["vi_speech_partial", "vi_speech_final"]
    }

    override func startObserving() { hasListeners = true }
    override func stopObserving()  { hasListeners = false }

    // MARK: - Bridge methods

    @objc func requestPermission(_ resolve: @escaping RCTPromiseResolveBlock,
                                  reject: @escaping RCTPromiseRejectBlock) {
        // iOS requires microphone to be granted BEFORE Speech Recognition dialog
        // will appear. If we call SFSpeechRecognizer.requestAuthorization while
        // mic is still .notDetermined, iOS silently returns .denied for speech
        // recognition without showing any dialog.
        //
        // Correct order: mic first → speech recognition second.

        let requestMicThenSpeech = {
            SFSpeechRecognizer.requestAuthorization { authStatus in
                resolve(authStatus == .authorized)
            }
        }

        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission { micGranted in
                guard micGranted else { resolve(false); return }
                requestMicThenSpeech()
            }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { micGranted in
                guard micGranted else { resolve(false); return }
                requestMicThenSpeech()
            }
        }
    }

    @objc func startListening(_ sid: String,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        guard !isRunning else { resolve(true); return }
        guard recognizer?.isAvailable == true else {
            reject("VI_SPEECH_UNAVAILABLE", "SFSpeechRecognizer (vi-VN) is not available on this device.", nil)
            return
        }

        sessionId = sid
        utteranceCounter = 0
        isRunning = true

        do {
            try startRecognitionCycle()
            resolve(true)
        } catch {
            isRunning = false
            reject("VI_SPEECH_START_FAILED", error.localizedDescription, error)
        }
    }

    @objc func stopListening(_ resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        stopInternal()
        resolve(true)
    }

    // MARK: - Recognition lifecycle

    /// Starts one recognition cycle. The audio engine is started on the first
    /// call and keeps running; subsequent calls only swap the request object.
    ///
    /// AVAudioSession lifecycle is managed by AudioSessionModule (called from JS
    /// before startListening). ViSpeechModule only manages AVAudioEngine and
    /// SFSpeechRecognizer, so the session category (.playAndRecord + Bluetooth)
    /// and background task set up by AudioSessionModule are preserved.
    private func startRecognitionCycle() throws {
        // Cancel any in-flight task and close the old request cleanly.
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil

        // Start the audio engine on the first call only.
        // AVAudioSession is already configured by AudioSessionModule — do NOT
        // call setCategory/setActive here, as that would override the
        // .playAndRecord session needed for TTS headphone output.
        if !engineStarted {
            let inputNode = audioEngine.inputNode
            let fmt = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }
            audioEngine.prepare()
            try audioEngine.start()
            engineStarted = true
        }

        // Create fresh request for the new utterance.
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        recognitionRequest = request

        utteranceCounter += 1
        let uttId = "\(sessionId)_utt_\(utteranceCounter)"
        let startMs = Int(Date().timeIntervalSince1970 * 1000)
        currentRevision = 0

        recognitionTask = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let text = result.bestTranscription.formattedString
                guard !text.isEmpty else { return }

                let ts = Int(Date().timeIntervalSince1970 * 1000)

                if result.isFinal {
                    let segments = result.bestTranscription.segments
                    let avgConf: Double = segments.isEmpty ? 0.8 :
                        segments.map { Double($0.confidence) }.reduce(0, +) / Double(segments.count)

                    if self.hasListeners {
                        self.sendEvent(withName: "vi_speech_final", body: [
                            "session_id":    self.sessionId,
                            "utterance_id":  uttId,
                            "text":          text,
                            "language":      "vi",
                            "confidence":    avgConf,
                            "timestamp_ms":  ts,
                            "offset_ms":     ts - startMs,
                            "start_ms":      startMs,
                            "end_ms":        ts,
                            "revision":      self.currentRevision + 1,
                            "audio_samples": [] as [Int],
                            "sample_rate":   16000,
                        ] as [String: Any])
                    }

                    // Immediately start the next utterance cycle.
                    if self.isRunning {
                        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + 0.05) {
                            guard self.isRunning else { return }
                            try? self.startRecognitionCycle()
                        }
                    }

                } else {
                    self.currentRevision += 1
                    if self.hasListeners {
                        self.sendEvent(withName: "vi_speech_partial", body: [
                            "session_id":   self.sessionId,
                            "utterance_id": uttId,
                            "text":         text,
                            "language":     "vi",
                            "timestamp_ms": ts,
                            "offset_ms":    ts - startMs,
                            "revision":     self.currentRevision,
                        ] as [String: Any])
                    }
                }
            }

            if let error = error {
                // Ignore cancellation errors (triggered by stopInternal / cycle swap).
                let nsErr = error as NSError
                let isCancelled = nsErr.domain == "kAFAssistantErrorDomain" && nsErr.code == 216
                let isSessionEnd = nsErr.domain == "kAFAssistantErrorDomain" && nsErr.code == 1110
                guard !isCancelled && !isSessionEnd else { return }

                // For real errors, restart the cycle if we're still supposed to run.
                if self.isRunning {
                    DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + 0.3) {
                        guard self.isRunning else { return }
                        try? self.startRecognitionCycle()
                    }
                }
            }
        }
    }

    private func stopInternal() {
        isRunning = false
        engineStarted = false

        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil

        if audioEngine.isRunning {
            audioEngine.stop()
        }
        audioEngine.inputNode.removeTap(onBus: 0)

        // AVAudioSession deactivation is handled by AudioSessionModule
        // (deactivateRecordingSession is called from JS after stopListening).
        // Do NOT call setActive(false) here — it would prematurely tear down
        // the session while AudioSessionModule still owns the background task.
    }
}
