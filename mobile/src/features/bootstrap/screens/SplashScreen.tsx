import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Pressable, ActivityIndicator, SafeAreaView, Platform} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {spacing, typography, borderRadius, shadows} from '@shared/constants';
import {useTheme} from '@shared/hooks/useTheme';
import {ReadinessStatus, ProgressCard} from '@shared/components/ui';
import {useBootstrapStore, useModelState, usePrewarmState, useBootstrapOverallStatus, useTargetLanguage} from '@shared/store';
import {ModelInfo} from '@shared/types';
import type {RootStackParamList} from '../../../app/navigation/router';
import {getSTTProcessorInstance} from '../../../native/stt/STTProcessor';
import {warnLog} from '../../../shared/utils/logger';
import {translationService} from '../../../services/TranslationService';
import {ensureBundledModelInstalled, areInstalledModelFilesPresent} from '../../../native/models/BundledModelInstaller';
import getNativeAppleTranslator from '../../../native/NativeAppleTranslator';
import {markPacksDownloaded, markPacksSkipped} from '../../../services/languagePackStatus';

const MOCK_MODEL: ModelInfo = {
  id: 'sensevoice-small',
  name: 'SenseVoice-Small',
  version: '1.2.4-stable',
  quality: 'int8',
  diskFootprintMB: 234,
  languages: ['EN', 'JA', 'KO', 'ZH'],
  inferenceSpeedRTF: 0.05,
  isOptimizedFor: ['iPhone 15 Pro'],
};

const PLATFORM_TRANSLATION_MODEL: ModelInfo = {
  id: Platform.OS === 'ios' ? 'apple-translation' : 'ml-kit-translation',
  name: Platform.OS === 'ios' ? 'Apple Translation' : 'Google ML Kit Translation',
  version: '1.0.0',
  quality: 'int8',
  diskFootprintMB: Platform.OS === 'ios' ? 0 : 30, // iOS uses built-in framework, Android uses ~30MB per language pack
  languages: ['EN', 'JA', 'KO', 'ZH', 'VI'],
  inferenceSpeedRTF: 0.1,
  isOptimizedFor: ['iPhone 15 Pro'],
};

type SplashNavigationProp = StackNavigationProp<RootStackParamList, 'Bootstrap'>;

const TARGET_LANGUAGE_LABELS: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese',
  ko: 'Korean',
  ja: 'Japanese',
};

interface LanguagePackCheck {
  srcLang: string;
  displayName: string;
}

function getLanguagePacksToCheck(targetLang: string): LanguagePackCheck[] {
  const targetLabel = TARGET_LANGUAGE_LABELS[targetLang] || targetLang;
  return [
    {srcLang: 'en', displayName: `English → ${targetLabel}`},
    {srcLang: 'ja', displayName: `Japanese → ${targetLabel}`},
    {srcLang: 'ko', displayName: `Korean → ${targetLabel}`},
    {srcLang: 'zh', displayName: `Chinese → ${targetLabel}`},
  ];
}

async function checkLanguagePacksStatus(targetLang: string): Promise<{installed: string[]; missing: string[]; allSupported: boolean}> {
  const installed: string[] = [];
  const missing: string[] = [];
  let allSupported = true;

  const packsToCheck = getLanguagePacksToCheck(targetLang);

  if (Platform.OS === 'ios') {
    const nativeModule = getNativeAppleTranslator();
    if (!nativeModule || typeof nativeModule.getLanguagePackStatus !== 'function') {
      return {installed: [], missing: [], allSupported: true};
    }

    for (const pack of packsToCheck) {
      try {
        const status = await nativeModule.getLanguagePackStatus(pack.srcLang, targetLang);
        if (status === 'installed') {
          installed.push(pack.displayName);
        } else if (status === 'available') {
          missing.push(pack.displayName);
        } else if (status === 'unsupported') {
          allSupported = false;
          missing.push(`${pack.displayName} (not supported)`);
        } else {
          missing.push(pack.displayName);
        }
      } catch (error) {
        warnLog(`[SplashScreen] Failed to check ${pack.displayName}:`, error);
        missing.push(pack.displayName);
      }
    }
  } else {
    // Android with ML Kit
    try {
      const packStatus = await translationService.getPackStatus();
      for (const pack of packsToCheck) {
        const key = `${pack.srcLang}-vi`;
        if (packStatus[key]) {
          installed.push(pack.displayName);
        } else {
          missing.push(pack.displayName);
        }
      }
    } catch (error) {
      warnLog(`[SplashScreen] Failed to check ML Kit language packs:`, error);
      // On Android, if check fails, we still allow proceeding
      // ML Kit will auto-download on first use
      return {installed: [], missing: [], allSupported: true};
    }
  }

  return {installed, missing, allSupported};
}

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<SplashNavigationProp>();
  const {theme, isDark} = useTheme();
  const modelState = useModelState();
  const prewarmState = usePrewarmState();
  const overallStatus = useBootstrapOverallStatus();
  const targetLanguage = useTargetLanguage();
  const activeSttModel = MOCK_MODEL;
  const activeSttModelId = 'stt' as const;
  const activeSttLabel = 'SenseVoice • EN / JA / KO / ZH';
  const {
    setModelDownloading,
    setModelDownloadProgress,
    setModelReady,
    setModelError,
    setTranslatorModelDownloading,
    setTranslatorModelReady,
    setTranslatorModelError,
    startPrewarm,
    completePrewarm,
    initialize,
  } = useBootstrapStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [langPackStep, setLangPackStep] = useState<'idle' | 'needs-download' | 'downloading' | 'retry'>('idle');
  const [missingPacks, setMissingPacks] = useState<string[]>([]);
  const [failedPacks, setFailedPacks] = useState<string[]>([]);
  const [dlProgress, setDlProgress] = useState({index: 0, total: 4, packName: '', isVerifying: false});
  const userChoiceRef = useRef<((confirmed: boolean) => void) | null>(null);
  const hasBootstrappedRef = useRef(false);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const handleConfirmDownload = () => userChoiceRef.current?.(true);
  const handleSkipDownload = () => userChoiceRef.current?.(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    const run = async () => {
      try {
        initialize();

        // Step 1: Install STT model
        const resolvedModelId = activeSttModelId;
        const resolvedModel = activeSttModel;
        // Check if already installed to avoid flashing a progress bar that disappears instantly
        const sttAlreadyInstalled = await areInstalledModelFilesPresent(resolvedModelId);
        if (!sttAlreadyInstalled) {
          setModelDownloading(resolvedModel);
        }
        try {
          await ensureBundledModelInstalled(
            resolvedModelId,
            sttAlreadyInstalled
              ? undefined
              : (completed, total) => {
                  setModelDownloadProgress({bytesDownloaded: completed, totalBytes: total, percentage: total > 0 ? completed / total : 0});
                },
          );
          await getSTTProcessorInstance().loadModel();
          setModelReady(resolvedModel);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'STT model install/load failed.';
          warnLog('[SplashScreen] STT model install/load failed:', error);
          setModelError(message);
          setIsInitializing(false);
          return;
        }

        // Step 2: Initialize platform-native translation (Apple Translation on iOS, ML Kit on Android)
        // Apple Translation requires language packs to be downloaded on iOS 26+
        // ML Kit auto-downloads language packs on first use
        setTranslatorModelDownloading(PLATFORM_TRANSLATION_MODEL);
        try {
          // Check language packs availability
          const {installed, missing, allSupported} = await checkLanguagePacksStatus(targetLanguage);
          warnLog(`[SplashScreen] Language packs: ${installed.length} installed, ${missing.length} missing for target ${targetLanguage}`);

          if (missing.length > 0 && Platform.OS === 'ios' && allSupported) {
            setMissingPacks(missing);
            setLangPackStep('needs-download');

            const confirmed = await new Promise<boolean>(resolve => {
              userChoiceRef.current = resolve;
            });

            if (!confirmed) {
              markPacksSkipped();
              warnLog('[SplashScreen] User skipped language pack download');
            } else {
              const nativeModule = getNativeAppleTranslator();
              const allPacks = getLanguagePacksToCheck(targetLanguage);
              // First attempt covers all packs; retries cover only failed ones
              let pendingPacks = allPacks;
              let keepRetrying = true;

              while (keepRetrying && pendingPacks.length > 0) {
                // --- Pre-check: skip download UI if packs are already installed ---
                // Apple LanguageAvailability.status() can inconsistently report .supported
                // for packs that are already installed, causing the progress card to flash
                // briefly when downloadLanguageIfNeeded immediately resolves. Re-verify here.
                if (nativeModule) {
                  const preCheckStatuses = await Promise.all(
                    pendingPacks.map(p =>
                      nativeModule.getLanguagePackStatus(p.srcLang, targetLanguage).catch(() => 'unknown'),
                    ),
                  );
                  const alreadyAllInstalled = preCheckStatuses.every(s => s === 'installed');
                  if (alreadyAllInstalled) {
                    markPacksDownloaded();
                    warnLog('[SplashScreen] All packs already installed, skipping download UI');
                    keepRetrying = false;
                    break;
                  }
                  // Filter to only packs that genuinely need downloading
                  pendingPacks = pendingPacks.filter((_, i) => preCheckStatuses[i] !== 'installed');
                }

                // --- Download phase ---
                setLangPackStep('downloading');
                for (let i = 0; i < pendingPacks.length; i++) {
                  const pack = pendingPacks[i];
                  setDlProgress({index: i + 1, total: pendingPacks.length, packName: pack.displayName, isVerifying: false});
                  if (nativeModule) {
                    try {
                      await nativeModule.downloadLanguageIfNeeded(pack.srcLang, targetLanguage);
                    } catch {
                      warnLog(`[SplashScreen] downloadLanguageIfNeeded threw for ${pack.displayName}`);
                    }
                  }
                }

                // --- Verify phase: check actual installed status for all 4 packs ---
                setDlProgress({index: pendingPacks.length, total: pendingPacks.length, packName: 'Đang kiểm tra...', isVerifying: true});
                const nowFailed: string[] = [];
                for (const pack of allPacks) {
                  if (!nativeModule) {
                    nowFailed.push(pack.displayName);
                    continue;
                  }
                  try {
                    const status = await nativeModule.getLanguagePackStatus(pack.srcLang, targetLanguage);
                    if (status !== 'installed') {
                      nowFailed.push(pack.displayName);
                    }
                  } catch {
                    nowFailed.push(pack.displayName);
                  }
                }

                if (nowFailed.length === 0) {
                  markPacksDownloaded();
                  warnLog('[SplashScreen] All language packs verified as installed');
                  keepRetrying = false;
                } else {
                  // Some packs still not installed — offer retry
                  setFailedPacks(nowFailed);
                  setLangPackStep('retry');
                  warnLog(`[SplashScreen] ${nowFailed.length} pack(s) failed: ${nowFailed.join(', ')}`);

                  const retry = await new Promise<boolean>(resolve => {
                    userChoiceRef.current = resolve;
                  });

                  if (!retry) {
                    markPacksSkipped();
                    warnLog('[SplashScreen] User skipped retry after partial failure');
                    keepRetrying = false;
                  } else {
                    // Next iteration only re-downloads failed packs
                    // (Swift skips already-installed packs automatically)
                    pendingPacks = allPacks.filter(p => nowFailed.includes(p.displayName));
                  }
                }
              }
            }

            setLangPackStep('idle');
          }

          const translatorReady = await translationService.initialize();
          if (translatorReady) {
            warnLog('[SplashScreen] Platform translation initialized successfully');
          } else {
            warnLog('[SplashScreen] Platform translation not available on this device');
            setTranslatorModelError('Translation not available on this device');
          }
        } catch (error) {
          warnLog('[SplashScreen] Platform translation init failed:', error);
          setTranslatorModelError(error instanceof Error ? error.message : 'Translation init failed');
        }

        setTranslatorModelReady(PLATFORM_TRANSLATION_MODEL);

        // Step 3: Mark prewarm complete.
        // Speaker embedding is intentionally NOT warmed here because loading
        // STT + translation + diarization together pushes iOS into critical memory
        // pressure on physical devices. Diarization is only needed after the
        // meeting or when live speaker assignment is explicitly enabled, so it
        // is initialized lazily at point-of-use instead.
        startPrewarm();

        await delay(300);
        completePrewarm();
        setIsInitializing(false);
        navigationRef.current.replace('Meeting');
      } catch (error) {
        warnLog('[SplashScreen] Bootstrap sequence failed:', error);
        setIsInitializing(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getProgressPercentage = (): number => {
    if (modelState.status === 'cached-ready') {
      return prewarmState.status === 'ready' ? 100 : 90;
    }
    if (modelState.status === 'downloading' && modelState.downloadProgress) {
      return Math.round(modelState.downloadProgress.percentage * 0.7);
    }
    return 0;
  };

  // Palette pulled from the active theme so light mode doesn't get the
  // dark-only tokens that were hardcoded here originally.
  const glowTint = isDark ? 'rgba(162,155,254,0.06)' : 'rgba(91,78,217,0.07)';
  const ringBorderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const waveBarColor = isDark ? 'rgba(162,155,254,0.7)' : 'rgba(91,78,217,0.55)';

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.secondary}]}>
      <View style={styles.backgroundGlow}>
        <View style={[styles.glowCenter, {backgroundColor: glowTint}]} />
      </View>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoOuterRing, {borderColor: ringBorderColor}]} />
            <View style={[styles.micCore, {borderColor: theme.colors.secondary}]}>
              <Text style={[styles.micCoreText, {color: theme.colors.secondary}]}>◉</Text>
            </View>
            <View style={styles.waveformBars}>
              <View style={[styles.waveformBar, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, styles.waveformBarTall, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, styles.waveformBarTall, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, {backgroundColor: waveBarColor}]} />
            </View>
          </View>
          <View style={styles.titleSection}>
            <Text style={[styles.appName, {color: theme.colors.text.primary}]}>Meeting Voice Assistant</Text>
            <Text style={[styles.tagline, {color: theme.colors.text.tertiary}]}>Understand every voice</Text>
          </View>
        </View>

        <View style={styles.statusSection}>
          {langPackStep === 'needs-download' ? (
            <View style={[styles.langPackCard, {borderColor: ringBorderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}]}>
              <Text style={[styles.langPackTitle, {color: theme.colors.text.primary}]}>
                Cần tải gói ngôn ngữ dịch thuật
              </Text>
              <Text style={[styles.langPackBody, {color: theme.colors.text.secondary}]}>
                Để dịch thuật real-time trong cuộc họp, app cần tải về các gói ngôn ngữ từ Apple Translation. Các gói này chạy hoàn toàn offline sau khi tải.
              </Text>
              <View style={styles.langPackList}>
                {[
                  'English → Tiếng Việt',
                  'Korean → Tiếng Việt',
                  'Chinese → Tiếng Việt',
                  'Japanese → Tiếng Việt',
                ].map(item => (
                  <View key={item} style={styles.langPackItem}>
                    <Text style={[styles.langPackItemDot, {color: theme.colors.secondary}]}>◆</Text>
                    <Text style={[styles.langPackItemText, {color: theme.colors.text.secondary}]}>{item}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.langPackNote, {color: theme.colors.text.tertiary}]}>
                ~30MB mỗi gói · Chỉ tải một lần · Hoạt động offline
              </Text>
              <View style={styles.langPackActions}>
                <Pressable
                  style={[styles.skipBtn, {borderColor: ringBorderColor}]}
                  onPress={handleSkipDownload}>
                  <Text style={[styles.skipBtnText, {color: theme.colors.text.secondary}]}>Bỏ qua</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, {backgroundColor: theme.colors.secondary}]}
                  onPress={handleConfirmDownload}>
                  <Text style={[styles.confirmBtnText, {color: isDark ? '#0a1a14' : '#ffffff'}]}>Đồng ý</Text>
                </Pressable>
              </View>
            </View>
          ) : langPackStep === 'downloading' ? (
            <View style={[styles.downloadCard, {borderColor: ringBorderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}]}>
              <Text style={[styles.downloadTitle, {color: theme.colors.text.primary}]}>
                {dlProgress.isVerifying ? 'Đang kiểm tra...' : 'Đang tải gói ngôn ngữ...'}
              </Text>
              {!dlProgress.isVerifying && (
                <Text style={[styles.downloadPackName, {color: theme.colors.text.secondary}]}>
                  {dlProgress.packName}
                </Text>
              )}
              <View style={styles.stepDots}>
                {Array.from({length: 4}, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor:
                          i < dlProgress.index - 1
                            ? theme.colors.secondary
                            : i === dlProgress.index - 1
                            ? theme.colors.secondary + 'aa'
                            : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                      },
                    ]}
                  />
                ))}
              </View>
              {!dlProgress.isVerifying && (
                <Text style={[styles.downloadCounter, {color: theme.colors.text.tertiary}]}>
                  {dlProgress.index} / {dlProgress.total} gói
                </Text>
              )}
              <ActivityIndicator size="small" color={theme.colors.secondary} style={{marginTop: spacing.xs}} />
              <Text style={[styles.downloadHint, {color: theme.colors.text.tertiary}]}>
                {dlProgress.isVerifying
                  ? 'Xác nhận trạng thái tải xuống...'
                  : 'Apple sẽ hiển thị hộp thoại tải cho từng gói'}
              </Text>
            </View>
          ) : langPackStep === 'retry' ? (
            <View style={[styles.langPackCard, {borderColor: '#ffb4ab', backgroundColor: isDark ? 'rgba(255,180,171,0.06)' : 'rgba(255,180,171,0.08)'}]}>
              <Text style={[styles.langPackTitle, {color: theme.colors.text.primary}]}>
                Tải xuống thất bại
              </Text>
              <Text style={[styles.langPackBody, {color: theme.colors.text.secondary}]}>
                Một số gói không tải được, có thể do kết nối mạng. Các gói đã tải thành công sẽ được giữ lại khi thử lại.
              </Text>
              <View style={styles.langPackList}>
                {failedPacks.map(pack => (
                  <View key={pack} style={styles.langPackItem}>
                    <Text style={[styles.langPackItemDot, {color: '#ff6b6b'}]}>✗</Text>
                    <Text style={[styles.langPackItemText, {color: theme.colors.text.secondary}]}>{pack}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.langPackActions}>
                <Pressable
                  style={[styles.skipBtn, {borderColor: ringBorderColor}]}
                  onPress={handleSkipDownload}>
                  <Text style={[styles.skipBtnText, {color: theme.colors.text.secondary}]}>Bỏ qua</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, {backgroundColor: theme.colors.secondary}]}
                  onPress={handleConfirmDownload}>
                  <Text style={[styles.confirmBtnText, {color: isDark ? '#0a1a14' : '#ffffff'}]}>Thử lại</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {isInitializing || modelState.status === 'downloading' || useBootstrapStore.getState().state.translatorModel.status === 'downloading' ? (
                <ProgressCard
                  title="Loading on-device models..."
                  subtitle={`${activeSttModel.name} + ${PLATFORM_TRANSLATION_MODEL.name}`}
                  progress={getProgressPercentage()}
                  bytesDownloaded={modelState.downloadProgress?.bytesDownloaded ?? 0}
                  totalBytes={modelState.downloadProgress?.totalBytes ?? activeSttModel.diskFootprintMB * 1024 * 1024}
                  status={modelState.status === 'downloading' ? 'downloading' : 'processing'}
                />
              ) : (
                <View style={styles.readinessGrid}>
                  <ReadinessStatus
                    domain="model"
                    status={modelState.status}
                    label="AI Model"
                    description={modelState.currentModel ? `${modelState.currentModel.name} loaded` : undefined}
                  />
                  <ReadinessStatus
                    domain="model"
                    status={useBootstrapStore.getState().state.translatorModel.status}
                    label="Translation Model"
                    description={useBootstrapStore.getState().state.translatorModel.currentModel ? `${useBootstrapStore.getState().state.translatorModel.currentModel?.name} loaded` : undefined}
                  />
                  <ReadinessStatus
                    domain="prewarm"
                    status={prewarmState.status}
                    label="Speech Recognition"
                    description="Ready for first utterance"
                  />
                </View>
              )}
              <Text style={[styles.statusMessage, {color: theme.colors.text.tertiary}]}>
                {isInitializing ? 'Getting ready...' : overallStatus === 'ready' ? 'Ready to start' : 'Setup required'}
              </Text>
            </>
          )}
        </View>
      </View>

      {langPackStep === 'idle' && (
        <View style={styles.footer}>
          <View style={[styles.metadataContainer, {borderColor: ringBorderColor}]}>
            <Text style={[styles.metadataIconGlyph, {color: theme.colors.secondary}]}>◈</Text>
            <Text style={[styles.metadataText, {color: theme.colors.text.tertiary}]}>{activeSttLabel}</Text>
          </View>

          {isInitializing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.secondary} />
            </View>
          )}

          {!isInitializing && overallStatus === 'ready' && (
            <View style={styles.readyFooter}>
              <Pressable
                style={({pressed}) => [
                  styles.readyButton,
                  {backgroundColor: theme.colors.secondary},
                  pressed && styles.readyButtonPressed,
                ]}
                onPress={() => navigation.replace('Meeting')}>
                <Text style={[styles.readyButtonText, {color: isDark ? theme.colors.text.primary : '#FFFFFF'}]}>Start Meeting</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


const styles = StyleSheet.create({
  container: {flex: 1},
  backgroundGlow: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center'},
  glowCenter: {marginTop: 80, width: 320, height: 320, borderRadius: 160},
  content: {flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg},
  logoSection: {alignItems: 'center', marginBottom: spacing.xl},
  logoContainer: {width: 180, height: 180, alignItems: 'center', justifyContent: 'center'},
  logoOuterRing: {position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1},
  micCore: {width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  micCoreText: {fontSize: 26},
  waveformBars: {position: 'absolute', bottom: 42, flexDirection: 'row', gap: 6},
  waveformBar: {width: 4, height: 24, borderRadius: 2},
  waveformBarTall: {height: 36},
  titleSection: {marginTop: spacing.md, alignItems: 'center'},
  appName: {fontFamily: typography.fontFamily.headline, fontSize: 24, fontWeight: '700', textAlign: 'center'},
  tagline: {fontFamily: typography.fontFamily.label, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 8},
  statusSection: {gap: spacing.md},
  readinessGrid: {gap: spacing.md},
  statusMessage: {textAlign: 'center', fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xl, marginTop: spacing.sm},
  footer: {paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center'},
  metadataContainer: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, marginBottom: spacing.lg},
  metadataIconGlyph: {},
  metadataText: {},
  loadingContainer: {marginTop: spacing.md},
  readyFooter: {width: '100%', marginTop: spacing.md},
  readyButton: {borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', ...shadows.card.elevated},
  readyButtonPressed: {opacity: 0.9},
  readyButtonText: {fontWeight: '700'},
  // Language pack explanation card
  langPackCard: {borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md},
  langPackTitle: {fontFamily: typography.fontFamily.headline, fontSize: typography.fontSize.xl, fontWeight: '700'},
  langPackBody: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, lineHeight: 22},
  langPackList: {gap: spacing.sm},
  langPackItem: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  langPackItemDot: {fontSize: 8},
  langPackItemText: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md},
  langPackNote: {fontFamily: typography.fontFamily.label, fontSize: typography.fontSize.sm, textAlign: 'center'},
  langPackActions: {flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs},
  skipBtn: {flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center'},
  skipBtnText: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, fontWeight: '600'},
  confirmBtn: {flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', ...shadows.card.elevated},
  confirmBtnText: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, fontWeight: '700'},
  // Download progress card
  downloadCard: {borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.lg, alignItems: 'center', gap: spacing.md},
  downloadTitle: {fontFamily: typography.fontFamily.headline, fontSize: typography.fontSize.xl, fontWeight: '700', textAlign: 'center'},
  downloadPackName: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, textAlign: 'center'},
  stepDots: {flexDirection: 'row', gap: spacing.sm},
  stepDot: {width: 10, height: 10, borderRadius: 5},
  downloadCounter: {fontFamily: typography.fontFamily.label, fontSize: typography.fontSize.sm},
  downloadHint: {fontFamily: typography.fontFamily.label, fontSize: typography.fontSize.xs, textAlign: 'center'},
});

export default SplashScreen;
