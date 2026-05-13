import Foundation
import Translation
import SwiftUI

typealias ResolveBlock = (Any?) -> Void
typealias RejectBlock = (String?, String?, Error?) -> Void

// MARK: - SwiftUI helper view to trigger system language pack download

@available(iOS 17.4, *)
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
                    onComplete(false)
                }
            }
    }
}

// MARK: - Native module

@objc(AppleTranslatorModule)
class AppleTranslatorModule: NSObject {

    private var sessions: [String: TranslationSession] = [:]
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
        if #available(iOS 26.0, *) {
            self.isAvailable = true
            resolve(true as Any?)
        } else {
            self.isAvailable = true
            self.unavailabilityReason = "Apple Translation requires iOS 26.0+"
            resolve(true as Any?)
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

        if #available(iOS 26.0, *) {
            Task {
                do {
                    let sessionKey = "\(srcId)-\(tgtId)"

                    if let existing = sessions[sessionKey] {
                        let response = try await existing.translate(text)
                        resolve(response.targetText as Any?)
                        return
                    }

                    let srcLocale = Locale.Language(identifier: srcId)
                    let tgtLocale = Locale.Language(identifier: tgtId)

                    let availability = LanguageAvailability()
                    let status = await availability.status(from: srcLocale, to: tgtLocale)

                    if status == .installed {
                        let session = try await TranslationSession(installedSource: srcLocale, target: tgtLocale)
                        self.sessions[sessionKey] = session
                        let response = try await session.translate(text)
                        resolve(response.targetText as Any?)
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

        if #available(iOS 26.0, *) {
            Task {
                do {
                    let srcLocale = Locale.Language(identifier: srcId)
                    let tgtLocale = Locale.Language(identifier: tgtId)

                    let availability = LanguageAvailability()
                    let status = await availability.status(from: srcLocale, to: tgtLocale)

                    if status == .installed {
                        let session = try await TranslationSession(installedSource: srcLocale, target: tgtLocale)
                        let requests = texts.map { TranslationSession.Request(sourceText: $0) }
                        let responses = try await session.translations(from: requests)
                        let results = responses.map { $0.targetText }
                        resolve(results as Any?)
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

        if #available(iOS 26.0, *) {
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

        if #available(iOS 17.4, *) {
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

    @available(iOS 17.4, *)
    @MainActor
    private func triggerDownloadUI(config: TranslationSession.Configuration, resolve: @escaping ResolveBlock) {
        guard let topVC = self.topViewController() else {
            resolve(false as Any?)
            return
        }

        // Use a reference holder so the closure can remove the VC after completion
        final class HolderRef { var vc: UIHostingController<AnyView>? }
        let holder = HolderRef()

        let trigger = LanguageDownloadTrigger(configuration: config) { success in
            holder.vc?.willMove(toParent: nil)
            holder.vc?.view.removeFromSuperview()
            holder.vc?.removeFromParent()
            holder.vc = nil
            resolve(success as Any?)
        }

        let hostingVC = UIHostingController(rootView: AnyView(trigger))
        holder.vc = hostingVC
        hostingVC.view.backgroundColor = UIColor.clear
        hostingVC.view.alpha = 0.0
        hostingVC.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)

        topVC.addChild(hostingVC)
        topVC.view.addSubview(hostingVC.view)
        hostingVC.didMove(toParent: topVC)
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

        if #available(iOS 26.0, *) {
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
        sessions.removeAll()
        resolve(nil)
    }
}
