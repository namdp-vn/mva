import Foundation
import Translation
import SwiftUI
import AVFoundation

typealias ResolveBlock = (Any?) -> Void
typealias RejectBlock = (String?, String?, Error?) -> Void

// MARK: - Language pack download trigger (unchanged — foreground-only)

@available(iOS 18.0, *)
private struct LanguageDownloadTrigger: View {
    let configuration: TranslationSession.Configuration
    let onComplete: (Bool) -> Void

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .translationTask(configuration) { session in
                do {
                    try await session.prepareTranslation()
                    onComplete(true)
                } catch {
                    // Sheet was dismissed before the download completed.
                    // iOS does NOT continue downloading in the background after dismissal,
                    // so return false immediately — the JS side will re-show the popup.
                    onComplete(false)
                }
            }
    }
}

// MARK: - Persistent translation channel (background-safe)
//
// Keeps ONE TranslationSession alive for the lifetime of a meeting by holding
// the `.translationTask` closure open indefinitely via an AsyncStream.
//
// Why this works in background:
//   • UIBackgroundModes: audio keeps the process alive (no suspension).
//   • The UIHostingController is attached WHILE foregrounded, so SwiftUI fires
//     `onAppear` and `.translationTask` normally.
//   • The async closure never returns — it loops on the stream — so the
//     TranslationSession object is never deallocated.
//   • When the app is backgrounded, the already-running Task continues; new
//     translation requests are fed through the channel and processed normally.

@available(iOS 18.0, *)
private final class PersistentTranslationChannel: @unchecked Sendable {

    struct Request: @unchecked Sendable {
        let texts: [String]
        let continuation: CheckedContinuation<[String], Error>
    }

    private let lock = NSLock()
    private var streamCont: AsyncStream<Request>.Continuation?
    // nonisolated let: set once in init, safe to access without await
    let stream: AsyncStream<Request>

    private var _ready = false
    private var readyWaiters: [CheckedContinuation<Void, Never>] = []

    init() {
        var c: AsyncStream<Request>.Continuation!
        stream = AsyncStream(bufferingPolicy: .unbounded) { c = $0 }
        streamCont = c
    }

    /// Called by PersistentTranslatorView once `.translationTask` has fired and
    /// `prepareTranslation()` succeeded — the session is warm and ready.
    func markReady() {
        let toResume: [CheckedContinuation<Void, Never>] = lock.withLock {
            guard !_ready else { return [] }
            _ready = true
            let w = readyWaiters
            readyWaiters.removeAll()
            return w
        }
        toResume.forEach { $0.resume() }
    }

    var isReady: Bool { lock.withLock { _ready } }

    /// Suspends the caller until `markReady()` is called or `timeout` elapses.
    /// Returns `true` if ready, `false` on timeout.
    func waitUntilReady(timeout: TimeInterval = 5.0) async -> Bool {
        if isReady { return true }
        return await withTaskGroup(of: Bool.self) { group in
            group.addTask { await self._waitReady(); return true }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                return false
            }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }
    }

    private func _waitReady() async {
        if isReady { return }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            lock.withLock {
                if _ready { cont.resume() }
                else { readyWaiters.append(cont) }
            }
        }
    }

    /// Enqueue a translation request and suspend until the result is ready.
    func translate(texts: [String]) async throws -> [String] {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[String], Error>) in
            lock.withLock {
                streamCont?.yield(Request(texts: texts, continuation: cont))
            }
        }
    }

    /// Finish the stream — causes the `for await` loop in the view to exit,
    /// releasing the TranslationSession.
    func terminate() {
        lock.withLock {
            streamCont?.finish()
            streamCont = nil
        }
    }
}

// MARK: - SwiftUI view that keeps TranslationSession alive indefinitely

@available(iOS 18.0, *)
private struct PersistentTranslatorView: View {
    let config: TranslationSession.Configuration
    let channel: PersistentTranslationChannel

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .translationTask(config) { session in
                do { try await session.prepareTranslation() } catch {}
                // Signal that the session is warm — callers waiting in
                // `waitUntilReady()` will now resume.
                channel.markReady()
                // Infinite loop: the closure NEVER returns.
                // The TranslationSession lives as long as we're awaiting here.
                // With UIBackgroundModes: audio the process isn't suspended, so
                // this Task keeps running in the background.
                for await request in channel.stream {
                    do {
                        let results: [String]
                        if request.texts.count == 1, let text = request.texts.first {
                            let r = try await session.translate(text)
                            results = [r.targetText]
                        } else {
                            let sessionRequests = request.texts.enumerated().map { i, t in
                                TranslationSession.Request(sourceText: t, clientIdentifier: "\(i)")
                            }
                            let responses = try await session.translations(from: sessionRequests)
                            results = responses
                                .sorted {
                                    (Int($0.clientIdentifier ?? "0") ?? 0) <
                                    (Int($1.clientIdentifier ?? "0") ?? 0)
                                }
                                .map { $0.targetText }
                        }
                        request.continuation.resume(returning: results)
                    } catch {
                        request.continuation.resume(throwing: error)
                    }
                }
            }
    }
}

// MARK: - Session entry wrapper
//
// Holds the UIHostingController + channel together.
// Using NSObject as base lets us store in NSMutableDictionary without
// @available constraints on the class's stored properties.

private final class SessionEntry: NSObject {
    let hostingVC: UIHostingController<AnyView>
    /// Typed as AnyObject to avoid @available(iOS 18.0,*) on the property.
    /// Always a PersistentTranslationChannel at runtime (checked on access).
    let channelAny: AnyObject

    init(hostingVC: UIHostingController<AnyView>, channelAny: AnyObject) {
        self.hostingVC = hostingVC
        self.channelAny = channelAny
    }
}

// MARK: - Native module

@objc(AppleTranslatorModule)
class AppleTranslatorModule: NSObject {

    private var isAvailable = false

    private let langMap: [String: String] = [
        "en": "en",
        "ja": "ja",
        "ko": "ko",
        "zh": "zh-Hans",
        "vi": "vi"
    ]

    /// Persistent sessions keyed by "srcId→tgtId" (e.g. "en→vi").
    /// NSMutableDictionary avoids @available constraints on stored properties.
    private let sessionEntries = NSMutableDictionary()   // [String: SessionEntry]

    private func normalizeLanguageCode(_ code: String) -> String {
        switch code {
        case "zh-Hans", "zh-Hant", "zh-CN", "zh-TW", "zh-SG", "zh-MO":
            return "zh"
        default:
            return code
        }
    }

    @objc static func moduleName() -> String! { return "AppleTranslatorModule" }
    @objc static func requiresMainQueueSetup() -> Bool { return false }

    // MARK: - initialize

    @objc func initialize(_ resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        if #available(iOS 18.0, *) {
            isAvailable = true
            resolve(true as Any?)
        } else {
            isAvailable = false
            resolve(false as Any?)
        }
    }

    // MARK: - translate

    @objc func translate(_ text: String,
                         srcLang: String,
                         tgtLang: String,
                         resolve: @escaping ResolveBlock,
                         reject: @escaping RejectBlock) {
        let src = normalizeLanguageCode(srcLang)
        let tgt = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[src], let tgtId = langMap[tgt] else {
            reject("INVALID_LANG", "Unsupported language: \(src) → \(tgt)", nil)
            return
        }

        if src == tgt { resolve(text as Any?); return }

        if #available(iOS 18.0, *) {
            Task {
                let result = await self.persistentTranslate(
                    texts: [text], srcId: srcId, tgtId: tgtId
                )
                resolve((result?.first ?? text) as Any?)
            }
        } else {
            resolve(text as Any?)
        }
    }

    // MARK: - translateBatch

    @objc func translateBatch(_ texts: [String],
                              srcLang: String,
                              tgtLang: String,
                              resolve: @escaping ResolveBlock,
                              reject: @escaping RejectBlock) {
        let src = normalizeLanguageCode(srcLang)
        let tgt = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[src], let tgtId = langMap[tgt] else {
            reject("INVALID_LANG", "Unsupported language pair", nil)
            return
        }

        if src == tgt { resolve(texts as Any?); return }

        if #available(iOS 18.0, *) {
            Task {
                let result = await self.persistentTranslate(
                    texts: texts, srcId: srcId, tgtId: tgtId
                )
                resolve((result ?? texts) as Any?)
            }
        } else {
            resolve(texts as Any?)
        }
    }

    // MARK: - Persistent translation (background-safe core)

    @available(iOS 18.0, *)
    private func persistentTranslate(texts: [String],
                                     srcId: String,
                                     tgtId: String) async -> [String]? {
        let key = "\(srcId)→\(tgtId)"

        // Fast path: session already exists — no availability re-check needed.
        if let existing = await MainActor.run(body: { sessionEntries[key] as? SessionEntry }),
           let channel = existing.channelAny as? PersistentTranslationChannel {
            let ready = await channel.waitUntilReady(timeout: 5.0)
            guard ready else { return nil }
            return try? await channel.translate(texts: texts)
        }

        // Slow path: new language pair — check availability first.
        let srcLocale = Locale.Language(identifier: srcId)
        let tgtLocale = Locale.Language(identifier: tgtId)
        let availability = LanguageAvailability()
        let status = await availability.status(from: srcLocale, to: tgtLocale)
        guard status == .installed || status == .supported else { return nil }

        // Create and attach persistent hosting controller on MainActor.
        // Must be done while the process is alive (guaranteed by UIBackgroundModes: audio).
        // If foregrounded: .translationTask fires immediately (normal path).
        // If backgrounded on first call (rare): the VC is attached to the root window;
        //   .translationTask may not fire until foregrounded → waitUntilReady times out
        //   and we return nil for this call only. Next call (when foregrounded) will succeed.
        let entry: SessionEntry? = await MainActor.run {
            // Double-check: another concurrent call might have created it while we awaited.
            if let existing = sessionEntries[key] as? SessionEntry { return existing }

            guard let rootVC = anyRootViewController() else { return nil }

            let config = TranslationSession.Configuration(source: srcLocale, target: tgtLocale)
            let channel = PersistentTranslationChannel()
            let view = PersistentTranslatorView(config: config, channel: channel)
            let hostingVC = UIHostingController(rootView: AnyView(view))

            hostingVC.view.backgroundColor = .clear
            hostingVC.view.alpha = 0.0
            hostingVC.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)

            // Explicit appearance transitions required so SwiftUI fires onAppear
            // (and thus .translationTask) on the child controller.
            rootVC.addChild(hostingVC)
            hostingVC.beginAppearanceTransition(true, animated: false)
            rootVC.view.addSubview(hostingVC.view)
            hostingVC.endAppearanceTransition()
            hostingVC.didMove(toParent: rootVC)

            let newEntry = SessionEntry(hostingVC: hostingVC, channelAny: channel)
            sessionEntries[key] = newEntry
            return newEntry
        }

        guard let entry,
              let channel = entry.channelAny as? PersistentTranslationChannel else { return nil }

        let ready = await channel.waitUntilReady(timeout: 5.0)
        guard ready else { return nil }

        return try? await channel.translate(texts: texts)
    }

    // MARK: - Root VC helpers

    /// Returns a root VC from ANY window scene, preferring foregrounded.
    /// Unlike `topViewController()` this does NOT require `foregroundActive` —
    /// needed so we can attach the hosting controller while backgrounded
    /// (UIBackgroundModes: audio keeps the process and window hierarchy alive).
    @MainActor
    private func anyRootViewController() -> UIViewController? {
        var keyWindow: UIWindow?
        for scene in UIApplication.shared.connectedScenes {
            if let ws = scene as? UIWindowScene {
                if ws.activationState == .foregroundActive {
                    keyWindow = ws.keyWindow
                    break
                }
                if keyWindow == nil {
                    keyWindow = ws.keyWindow
                }
            }
        }
        var vc = keyWindow?.rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }

    /// Returns the top VC only when the app is foregrounded.
    /// Used by downloadLanguageIfNeeded — that UI must be foregrounded.
    @MainActor
    private func topViewController() -> UIViewController? {
        var keyWindow: UIWindow?
        for scene in UIApplication.shared.connectedScenes {
            if let ws = scene as? UIWindowScene, ws.activationState == .foregroundActive {
                keyWindow = ws.keyWindow
                break
            }
        }
        var vc = keyWindow?.rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }

    // MARK: - isLanguageAvailable

    @objc func isLanguageAvailable(_ srcLang: String,
                                   tgtLang: String,
                                   resolve: @escaping ResolveBlock,
                                   reject: @escaping RejectBlock) {
        let src = normalizeLanguageCode(srcLang)
        let tgt = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[src], let tgtId = langMap[tgt] else {
            resolve(false as Any?)
            return
        }

        if #available(iOS 18.0, *) {
            Task {
                let availability = LanguageAvailability()
                let status = await availability.status(
                    from: Locale.Language(identifier: srcId),
                    to: Locale.Language(identifier: tgtId)
                )
                resolve((status == .supported || status == .installed) as Any?)
            }
        } else {
            resolve(false as Any?)
        }
    }

    // MARK: - downloadLanguageIfNeeded
    //
    // Triggers the Apple system download sheet for the given language pair.
    // Uses UIHostingController + SwiftUI .translationTask() to present the
    // native download UI from a React Native context.
    // This is a foreground-only operation — the system sheet requires an active UI.

    @objc func downloadLanguageIfNeeded(_ srcLang: String,
                                        tgtLang: String,
                                        resolve: @escaping ResolveBlock,
                                        reject: @escaping RejectBlock) {
        let src = normalizeLanguageCode(srcLang)
        let tgt = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[src], let tgtId = langMap[tgt] else {
            resolve(false as Any?)
            return
        }

        if #available(iOS 18.0, *) {
            let srcLocale = Locale.Language(identifier: srcId)
            let tgtLocale = Locale.Language(identifier: tgtId)

            Task {
                let availability = LanguageAvailability()
                let status = await availability.status(from: srcLocale, to: tgtLocale)

                if status == .installed {
                    resolve(true as Any?)
                    return
                }

                if status == .unsupported {
                    resolve(false as Any?)
                    return
                }

                // status == .supported → trigger system download sheet
                let config = TranslationSession.Configuration(source: srcLocale, target: tgtLocale)

                await MainActor.run {
                    self.triggerDownloadUI(config: config, resolve: resolve)
                }
            }
        } else {
            resolve(false as Any?)
        }
    }

    @available(iOS 18.0, *)
    @MainActor
    private func triggerDownloadUI(config: TranslationSession.Configuration,
                                   resolve: @escaping ResolveBlock) {
        guard let topVC = self.topViewController() else {
            resolve(false as Any?)
            return
        }

        final class State {
            var vc: UIHostingController<AnyView>?
            var didResolve = false
        }
        let state = State()

        // finish() is always called on @MainActor; the didResolve guard prevents double-resolve.
        func finish(_ success: Bool) {
            guard !state.didResolve else { return }
            state.didResolve = true
            // Manually signal disappearance so SwiftUI cancels the translationTask.
            state.vc?.beginAppearanceTransition(false, animated: false)
            state.vc?.willMove(toParent: nil)
            state.vc?.view.removeFromSuperview()
            state.vc?.endAppearanceTransition()
            state.vc?.removeFromParent()
            state.vc = nil
            resolve(success as Any?)
        }

        let trigger = LanguageDownloadTrigger(configuration: config) { success in
            Task { @MainActor in finish(success) }
        }

        let hostingVC = UIHostingController(rootView: AnyView(trigger))
        state.vc = hostingVC
        hostingVC.view.backgroundColor = UIColor.clear
        hostingVC.view.alpha = 0.0
        hostingVC.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)

        topVC.addChild(hostingVC)
        hostingVC.beginAppearanceTransition(true, animated: false)
        topVC.view.addSubview(hostingVC.view)
        hostingVC.endAppearanceTransition()
        hostingVC.didMove(toParent: topVC)

        // Dismissal monitor: poll every 300 ms to detect when the Apple download
        // sheet disappears. This fires finish(false) quickly so JS can re-show the
        // popup — prepareTranslation() does NOT throw when the user taps "Done"
        // without pressing Download; it just keeps waiting indefinitely.
        Task { @MainActor [weak topVC] in
            var sheetWasVisible = false
            while !state.didResolve {
                try? await Task.sleep(nanoseconds: 300_000_000)
                guard !state.didResolve, let topVC else { break }
                let isSheetPresented = (topVC.presentedViewController != nil)
                    || (state.vc?.presentedViewController != nil)
                if isSheetPresented {
                    sheetWasVisible = true
                } else if sheetWasVisible {
                    // Sheet was visible then disappeared → user dismissed the popup
                    finish(false)
                    break
                }
            }
        }

        // Hard timeout fallback for very slow downloads (180 s).
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 180_000_000_000)
            finish(false)
        }
    }

    // MARK: - getLanguagePackStatus

    @objc func getLanguagePackStatus(_ srcLang: String,
                                     tgtLang: String,
                                     resolve: @escaping ResolveBlock,
                                     reject: @escaping RejectBlock) {
        let src = normalizeLanguageCode(srcLang)
        let tgt = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[src], let tgtId = langMap[tgt] else {
            resolve("unsupported" as Any?)
            return
        }

        if #available(iOS 18.0, *) {
            Task {
                let srcLocale = Locale.Language(identifier: srcId)
                let tgtLocale = Locale.Language(identifier: tgtId)

                let availability = LanguageAvailability()
                let status = await availability.status(from: srcLocale, to: tgtLocale)

                switch status {
                case .installed:
                    resolve("installed" as Any?)
                case .supported:
                    resolve("available" as Any?)
                case .unsupported:
                    resolve("unsupported" as Any?)
                @unknown default:
                    resolve("unknown" as Any?)
                }
            }
        } else {
            resolve("unsupported" as Any?)
        }
    }

    // MARK: - unload

    @objc func unload(_ resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        if #available(iOS 18.0, *) {
            Task { @MainActor in
                for case let entry as SessionEntry in self.sessionEntries.allValues {
                    if let channel = entry.channelAny as? PersistentTranslationChannel {
                        channel.terminate()
                    }
                    // Manually signal disappearance so SwiftUI/UIKit clean up.
                    entry.hostingVC.beginAppearanceTransition(false, animated: false)
                    entry.hostingVC.willMove(toParent: nil)
                    entry.hostingVC.view.removeFromSuperview()
                    entry.hostingVC.endAppearanceTransition()
                    entry.hostingVC.removeFromParent()
                }
                self.sessionEntries.removeAllObjects()
                resolve(nil)
            }
        } else {
            resolve(nil)
        }
    }
}
