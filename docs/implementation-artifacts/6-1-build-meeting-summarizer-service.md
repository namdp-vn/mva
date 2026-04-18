# Story 6.1: Build Meeting Summarizer Service

Status: ready-for-dev

## Story

As a developer, I want a MeetingSummarizer service that generates structured meeting minutes using extractive summarization (TF-IDF, pattern matching), so that users get automatic meeting notes without AI/LLM.

## Acceptance Criteria

1. **Given** 20+ utterances, **When** generateMinutes(sessionId) called, **Then** returns: metadata, 5-7 key points, action items, keywords, topic segments, speaker stats.
2. **Given** processing, **Then** completes in <500ms for 50 utterances (pure text processing).
3. **Given** multilingual meeting (EN+JA+ZH), **Then** keyword extraction and action detection work across all languages.

## Tasks

- [ ] Create KeywordExtractor.ts — TF-IDF on Vietnamese translations, with Vietnamese + English + Chinese stopwords
- [ ] Create SentenceScorer.ts — 6 signals: keyword density (0.3), length (0.15), position (0.15), numbers (0.15), action language (0.2), question (0.05)
- [ ] Create ActionItemDetector.ts — multilingual pattern matching: EN("need to"), JA("する必要"), KO("해야"), ZH("需要"), VI("cần phải") + deadline extraction
- [ ] Create TopicSegmenter.ts — segment by time gaps >30s + keyword shifts between consecutive utterance groups
- [ ] Create MeetingSummarizer.ts — orchestrator that composes all above
- [ ] Create data/stopwords.ts — Vietnamese (~100 words), English (~80 words), Chinese (~50 characters) stopwords
- [ ] Add Chinese bigram tokenizer for keyword extraction (Chinese has no spaces)
- [ ] Add meeting_summaries table to SQLite schema
- [ ] Wire into PipelineOrchestrator.handleStopMeeting()

## Dev Notes

- Zero additional RAM — pure TypeScript string processing on SQLite data
- Extractive summary = picks existing sentences, does NOT generate new text
- Quality depends on NLLB/Opus-MT translation quality (keywords extracted from Vietnamese translations)
