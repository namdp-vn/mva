import Foundation
import Translation

typealias ResolveBlock = (Any?) -> Void
typealias RejectBlock = (String?, String?, Error?) -> Void

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

    @objc func initialize(_ resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        if #available(iOS 26.0, *) {
            // iOS 26.0+ - translator framework available
            self.isAvailable = true
            resolve(true as Any?)
        } else {
            // iOS < 26: TranslationSession not available
            self.isAvailable = true
            self.unavailabilityReason = "Apple Translation requires iOS 26.0+"
            resolve(true as Any?)
        }
    }

    @objc func translate(_ text: String, srcLang: String, tgtLang: String, resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        let normalizedSrcLang = normalizeLanguageCode(srcLang)
        let normalizedTgtLang = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[normalizedSrcLang], let tgtId = langMap[normalizedTgtLang] else {
            reject("INVALID_LANG", "Unsupported language: \(normalizedSrcLang) → \(normalizedTgtLang)", nil)
            return
        }

        // Same language - no translation needed
        if normalizedSrcLang == normalizedTgtLang {
            resolve(text as Any?)
            return
        }

        if #available(iOS 26.0, *) {
            Task {
                do {
                    let sessionKey = "\(srcId)-\(tgtId)"

                    // Check if we already have a session
                    if let existing = sessions[sessionKey] {
                        let response = try await existing.translate(text)
                        resolve(response.targetText as Any?)
                        return
                    }

                    let srcLocale = Locale.Language(identifier: srcId)
                    let tgtLocale = Locale.Language(identifier: tgtId)

                    let availability = LanguageAvailability()
                    let status = await availability.status(from: srcLocale, to: tgtLocale)

                    // Only translate if pack is installed
                    if status == .installed {
                        let session = try await TranslationSession(installedSource: srcLocale, target: tgtLocale)
                        self.sessions[sessionKey] = session
                        let response = try await session.translate(text)
                        resolve(response.targetText as Any?)
                    } else {
                        // Pack not installed - return original text
                        resolve(text as Any?)
                    }
                } catch {
                    // On any error, return original text
                    resolve(text as Any?)
                }
            }
        } else {
            // iOS < 26: Return original text
            resolve(text as Any?)
        }
    }

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

                    // Only translate if pack is installed
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
                // Return true if supported OR installed (pack downloaded)
                resolve((status == .supported || status == .installed) as Any?)
            }
        } else {
            resolve(false as Any?)
        }
    }

    @objc func downloadLanguageIfNeeded(_ srcLang: String, tgtLang: String, resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        let normalizedSrcLang = normalizeLanguageCode(srcLang)
        let normalizedTgtLang = normalizeLanguageCode(tgtLang)

        guard let srcId = langMap[normalizedSrcLang], let tgtId = langMap[normalizedTgtLang] else {
            reject("INVALID_LANG", "Unsupported language: \(normalizedSrcLang) → \(normalizedTgtLang)", nil)
            return
        }

        if #available(iOS 26.0, *) {
            Task {
                let srcLocale = Locale.Language(identifier: srcId)
                let tgtLocale = Locale.Language(identifier: tgtId)

                let availability = LanguageAvailability()
                let status = await availability.status(from: srcLocale, to: tgtLocale)

                // Return true only if pack is already installed
                resolve((status == .installed) as Any?)
            }
        } else {
            resolve(false as Any?)
        }
    }

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

    @objc func unload(_ resolve: @escaping ResolveBlock, reject: @escaping RejectBlock) {
        sessions.removeAll()
        resolve(nil)
    }
}