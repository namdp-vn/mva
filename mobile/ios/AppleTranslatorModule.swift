import Foundation
import Translation
import SwiftUI

typealias ResolveBlock = (Any?) -> Void
typealias RejectBlock = (String?, String?, Error?) -> Void

// MARK: - SwiftUI helper view to trigger system language pack download

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
                    // Sheet was dismissed before prepareTranslation() finished.
                    // The user may have tapped "Done" after confirming the download,
                    // in which case iOS continues downloading in the background.
                    // Poll LanguageAvailability.status() to detect silent completion.
                    guard let src = configuration.source, let tgt = configuration.target else {
                        onComplete(false)
                        return
                    }
                    let availability = LanguageAvailability()
                    for _ in 0..<10 { // 10 × 3 s = 30 s max
                        guard !Task.isCancelled else { return }
                        try? await Task.sleep(nanoseconds: 3_000_000_000)
                        guard !Task.isCancelled else { return }
                        let status = await availability.status(from: src, to: tgt)
                        if status == .installed {
                            onComplete(true)
                            return
                        }
                    }
                    onComplete(false)
                }
            }
    }
}

@available(iOS 18.0, *)
private struct TranslationRunTrigger: View {
    let configuration: TranslationSession.Configuration
    let texts: [String]
    let onComplete: ([String]?) -> Void

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .translationTask(configuration) { session in
                do {
                    try await session.prepareTranslation()

                    if texts.count == 1, let text = texts.first {
                        let response = try await session.translate(text)
                        onComplete([response.targetText])
                        return
                    }

                    let requests = texts.enumerated().map { index, text in
                        TranslationSession.Request(sourceText: text, clientIdentifier: String(index))
                    }
                    let responses = try await session.translations(from: requests)
                    let ordered = responses.sorted {
                        Int($0.clientIdentifier ?? "") ?? 0 < Int($1.clientIdentifier ?? "") ?? 0
                    }
                    onComplete(ordered.map { $0.targetText })
                } catch {
                    onComplete(nil)
                }
            }
    }
}

// MARK: - Native module

@objc(AppleTranslatorModule)
class AppleTranslatorModule: NSObject {

    private var isAvailable = false
    private var unavailabilityReason: String = ""

    private let langMap: [String: String] = [
        "en": "en",
        "ja": "ja",
        "ko": "ko",
        "zh": "zh-Hans",
        "vi": "vi"
    ]

    private func normalizeLanguageCode(_ code: String) -> String {
        switch code {
        case "zh-Hans", "zh-Hant", "zh-CN", "zh-TW", "zh-SG", "zh-MO":
            return "zh"
        default:
            return code
        }
    }

    @objc static func moduleName() -> String! {
        return "AppleTranslatorModule"
    }

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - initialize

    @objc func initialize(_ resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        if #available(iOS 18.0, *) {
            self.isAvailable = true
            resolve(true as Any?)
        } else {
            self.isAvailable = false
            self.unavailabilityReason = "Apple Translation requires iOS 18.0+"
            resolve(false as Any?)
        }
    }

    // MARK: - translate

    @objc func translate(_ text: String, srcLang: String, tgtLang: String, resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        let normalizedSrcLang = normalizeLanguageCode(srcLang)
        let normalizedTgtLang = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[normalizedSrcLang], let tgtId = langMap[normalizedTgtLang] else {
            reject("INVALID_LANG", "Unsupported language: \(normalizedSrcLang) → \(normalizedTgtLang)", nil)
            return
        }

        if normalizedSrcLang == normalizedTgtLang {
            resolve(text as Any?)
            return
        }

        if #available(iOS 18.0, *) {
            Task {
                do {
                    let srcLocale = Locale.Language(identifier: srcId)
                    let tgtLocale = Locale.Language(identifier: tgtId)

                    let availability = LanguageAvailability()
                    let status = await availability.status(from: srcLocale, to: tgtLocale)

                    if status == .installed || status == .supported {
                        let config = TranslationSession.Configuration(source: srcLocale, target: tgtLocale)
                        await MainActor.run {
                            self.triggerTranslationUI(config: config, texts: [text], fallback: text as Any?, resolve: resolve)
                        }
                    } else {
                        resolve(text as Any?)
                    }
                } catch {
                    resolve(text as Any?)
                }
            }
        } else {
            resolve(text as Any?)
        }
    }

    // MARK: - translateBatch

    @objc func translateBatch(_ texts: [String], srcLang: String, tgtLang: String, resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        let normalizedSrcLang = normalizeLanguageCode(srcLang)
        let normalizedTgtLang = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[normalizedSrcLang], let tgtId = langMap[normalizedTgtLang] else {
            reject("INVALID_LANG", "Unsupported language pair", nil)
            return
        }

        if normalizedSrcLang == normalizedTgtLang {
            resolve(texts as Any?)
            return
        }

        if #available(iOS 18.0, *) {
            Task {
                do {
                    let srcLocale = Locale.Language(identifier: srcId)
                    let tgtLocale = Locale.Language(identifier: tgtId)

                    let availability = LanguageAvailability()
                    let status = await availability.status(from: srcLocale, to: tgtLocale)

                    if status == .installed || status == .supported {
                        let config = TranslationSession.Configuration(source: srcLocale, target: tgtLocale)
                        await MainActor.run {
                            self.triggerTranslationUI(config: config, texts: texts, fallback: texts as Any?, resolve: resolve)
                        }
                    } else {
                        resolve(texts as Any?)
                    }
                } catch {
                    resolve(texts as Any?)
                }
            }
        } else {
            resolve(texts as Any?)
        }
    }

    // MARK: - isLanguageAvailable

    @objc func isLanguageAvailable(_ srcLang: String, tgtLang: String, resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        let normalizedSrcLang = normalizeLanguageCode(srcLang)
        let normalizedTgtLang = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[normalizedSrcLang], let tgtId = langMap[normalizedTgtLang] else {
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

    @objc func downloadLanguageIfNeeded(_ srcLang: String, tgtLang: String, resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        let normalizedSrcLang = normalizeLanguageCode(srcLang)
        let normalizedTgtLang = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[normalizedSrcLang], let tgtId = langMap[normalizedTgtLang] else {
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
    private func triggerTranslationUI(config: TranslationSession.Configuration, texts: [String], fallback: Any?, resolve: @escaping ResolveBlock) {
        guard let topVC = self.topViewController() else {
            resolve(fallback)
            return
        }

        final class HolderRef {
            var vc: UIHostingController<AnyView>?
            var didResolve = false
        }
        let holder = HolderRef()

        let complete: ([String]?) -> Void = { results in
            Task { @MainActor in
                guard !holder.didResolve else {
                    return
                }
                holder.didResolve = true
                holder.vc?.beginAppearanceTransition(false, animated: false)
                holder.vc?.willMove(toParent: nil)
                holder.vc?.view.removeFromSuperview()
                holder.vc?.endAppearanceTransition()
                holder.vc?.removeFromParent()
                holder.vc = nil

                if let results {
                    if texts.count == 1 {
                        resolve((results.first ?? texts.first ?? "") as Any?)
                    } else {
                        resolve(results as Any?)
                    }
                } else {
                    resolve(fallback)
                }
            }
        }

        let trigger = TranslationRunTrigger(configuration: config, texts: texts, onComplete: complete)
        let hostingVC = UIHostingController(rootView: AnyView(trigger))
        holder.vc = hostingVC
        hostingVC.view.backgroundColor = UIColor.clear
        hostingVC.view.alpha = 0.0
        hostingVC.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)

        topVC.addChild(hostingVC)
        hostingVC.beginAppearanceTransition(true, animated: false)
        topVC.view.addSubview(hostingVC.view)
        hostingVC.endAppearanceTransition()
        hostingVC.didMove(toParent: topVC)
    }

    @available(iOS 18.0, *)
    @MainActor
    private func triggerDownloadUI(config: TranslationSession.Configuration, resolve: @escaping ResolveBlock) {
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

        // addChild after topVC is already visible requires explicit appearance
        // transitions — without them UIKit never calls viewWillAppear/viewDidAppear
        // on the child, so SwiftUI's onAppear (and thus translationTask) never fires.
        topVC.addChild(hostingVC)
        hostingVC.beginAppearanceTransition(true, animated: false)
        topVC.view.addSubview(hostingVC.view)
        hostingVC.endAppearanceTransition()
        hostingVC.didMove(toParent: topVC)

        // 150-second hard timeout — covers 120s for prepareTranslation() plus
        // 30s for the background-download polling loop in LanguageDownloadTrigger.
        // If nothing resolves by then, remove the VC and fail gracefully.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 150_000_000_000)
            finish(false)
        }
    }

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
        while let presented = vc?.presentedViewController {
            vc = presented
        }
        return vc
    }

    // MARK: - getLanguagePackStatus

    @objc func getLanguagePackStatus(_ srcLang: String, tgtLang: String, resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        let normalizedSrcLang = normalizeLanguageCode(srcLang)
        let normalizedTgtLang = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[normalizedSrcLang], let tgtId = langMap[normalizedTgtLang] else {
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
        resolve(nil)
    }
}
