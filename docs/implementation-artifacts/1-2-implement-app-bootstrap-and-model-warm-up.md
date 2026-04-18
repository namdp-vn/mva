# Story 1.2: Implement App Bootstrap and Model Warm-Up

Status: ready-for-dev

## Story

As a user, I want the app to show a splash screen with warm-up progress on launch, so that when I reach the Home screen all models are loaded and ready with no cold-start penalty.

## Acceptance Criteria

1. **Given** app launches, **When** splash screen appears, **Then** progress indicator shows status: "Loading speech engine..." → "Loading speaker detection..." → "Ready!"
2. **Given** warm-up is running, **When** all models are loaded + dummy inference complete, **Then** splash navigates to Home screen within 8 seconds on iPhone 14 Pro Max.
3. **Given** warm-up complete, **When** first real speech occurs in a meeting, **Then** STT latency matches subsequent utterances (no >500ms cold-start penalty).

## Tasks

- [ ] Build SplashScreen component with progress indicator and status text
- [ ] Load Whisper-Small ONNX sessions from bundle (encoder + decoder)
- [ ] Run dummy STT inference to warm up Whisper pipeline
- [ ] Load speaker diarization models (pyannote segmentation + CAM++ embedding) from bundle
- [ ] (Android only) Load Opus-MT en-vi model from bundle + run dummy translation
- [ ] (iOS only) Initialize Apple Translation — check language availability, trigger pack download if needed
- [ ] Measure and log warm-up time per component
- [ ] Navigate to microphone permission request → Home screen after warm-up

## Dev Notes

- No model download step — everything loads from app bundle
- iOS does NOT warm up translation model (Apple Translation is managed by OS)
- Android warms up opus-mt-en-vi only (other models loaded on-demand when language detected)
- Target: warm-up < 5s on iPhone 14 Pro Max, < 8s maximum on any supported device
