import { env } from "../../config/env.js";
import {
  VoiceIntentType,
  SupportedVoiceLanguage,
  ExtractedVoiceEntities,
  toVoiceLanguage,
} from "../../../../shared/types/voice.js";
import { multilingualNLU } from "./multilingual-nlu.js";

export interface SarvamSttResponse {
  transcript: string;
  language_code: string;
}

export interface SarvamTtsResponse {
  audios: string[]; // Base64 encoded audio strings
}

export interface SarvamIntentExtractionResult {
  intent: VoiceIntentType;
  confidence: number;
  schemeId?: string;
  memberIdentifier?: string;
  verificationCode?: string;
  entities?: ExtractedVoiceEntities;
  topic?: string;
  clarificationPrompt?: string;
  notes?: string;
  rawTranscript: string;
  language: string;
}

export class SarvamService {
  private apiKey: string;
  private baseUrl: string;
  private sttModel: string;
  private ttsModel: string;
  private defaultSpeaker: string;
  private timeoutMs: number;

  constructor() {
    this.apiKey = env.SARVAM_API_KEY || "";
    this.baseUrl = env.SARVAM_BASE_URL || "https://api.sarvam.ai";
    this.sttModel = env.SARVAM_MODEL || "saaras:v3";
    this.ttsModel = env.SARVAM_TTS_MODEL || "bulbul:v3";
    this.defaultSpeaker = env.SARVAM_TTS_SPEAKER || "roopa";
    this.timeoutMs = env.SARVAM_TIMEOUT_MS || 10000;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Speech-to-Text via Sarvam AI API
   * POST /speech-to-text
   * Uses production saaras:v3 model with Indic language coverage (en-IN, kn-IN, hi-IN)
   */
  public async speechToText(
    audioBase64: string,
    languageCode?: string,
    audioFormat: string = "wav"
  ): Promise<SarvamSttResponse> {
    const effectiveLanguage = toVoiceLanguage(languageCode || env.VOICE_LANGUAGE || "en-IN");

    if (!this.isConfigured()) {
      return {
        transcript: "",
        language_code: effectiveLanguage,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Decode base64 to binary buffer
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const boundary = "----SarvamFormBoundary" + Math.random().toString(36).substring(2);

      // Construct multipart form-data payload safely
      const mimeType = audioFormat === "mp3" ? "audio/mp3" : "audio/wav";
      const filename = `audio.${audioFormat}`;

      const preBuffer = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
      );

      const postBuffer = Buffer.from(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `${this.sttModel}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="language_code"\r\n\r\n` +
        `${effectiveLanguage}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="mode"\r\n\r\n` +
        `transcribe\r\n` +
        `--${boundary}--\r\n`
      );

      const fullBody = Buffer.concat([preBuffer, audioBuffer, postBuffer]);

      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: "POST",
        headers: {
          "api-subscription-key": this.apiKey,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": fullBody.length.toString(),
        },
        body: fullBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Sarvam STT failed with HTTP ${response.status}`);
      }

      const data = (await response.json()) as SarvamSttResponse;
      return {
        transcript: data.transcript || "",
        language_code: data.language_code || effectiveLanguage,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Sarvam STT request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Text-to-Speech via Sarvam AI API
   * POST /text-to-speech
   * Uses current production bulbul:v3 model with verified v3 speaker (shubh)
   * Formatted for 8kHz / 16kHz PSTN telephony output
   */
  public async textToSpeech(
    text: string,
    targetLanguageCode?: string,
    speaker?: string
  ): Promise<SarvamTtsResponse> {
    if (!this.isConfigured()) {
      return { audios: [] };
    }

    const effectiveLanguage = toVoiceLanguage(targetLanguageCode || env.VOICE_LANGUAGE || "en-IN");
    const sanitizedText = (text || "").trim().slice(0, 2500);
    if (!sanitizedText) {
      return { audios: [] };
    }

    const selectedSpeaker = speaker || this.defaultSpeaker || "shubh";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const payload: Record<string, any> = {
        inputs: [sanitizedText],
        target_language_code: effectiveLanguage,
        speaker: selectedSpeaker,
        speech_sample_rate: 8000,
        enable_preprocessing: true,
        model: this.ttsModel,
      };

      const response = await fetch(`${this.baseUrl}/text-to-speech`, {
        method: "POST",
        headers: {
          "api-subscription-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError: unknown = null;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          // Plaintext error
        }

        console.error("❌ [SarvamService.textToSpeech] Sarvam TTS API Error:", {
          status: response.status,
          statusText: response.statusText,
          errorBody: parsedError || errorText,
          requestDetails: {
            model: this.ttsModel,
            target_language_code: effectiveLanguage,
            speaker: selectedSpeaker,
            speech_sample_rate: 8000,
            textLength: sanitizedText.length,
            textPreview: sanitizedText.slice(0, 80) + (sanitizedText.length > 80 ? "..." : ""),
          },
        });

        throw new Error(`Sarvam TTS failed with HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as SarvamTtsResponse;
      return {
        audios: data.audios || [],
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Sarvam TTS request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Extract Structured Intent & Entities from Transcript
   * Deterministic multilingual NLU with entity extraction and context mapping
   * Supports English, Kannada, and Hindi (with natural code-switching / Hinglish / Kanglish)
   */
  public understandIntent(
    transcript: string,
    sessionLanguage?: string,
    conversationContext?: Record<string, any>
  ): SarvamIntentExtractionResult {
    const parseRes = multilingualNLU.parseTranscript(
      transcript,
      sessionLanguage,
      conversationContext
    );

    // Compute backward-compatible memberIdentifier for legacy test harnesses
    let memberIdentifier: string | undefined;
    if (
      parseRes.entities.pregnancyStatus ||
      parseRes.entities.relation === "mother" ||
      parseRes.entities.relation === "wife"
    ) {
      memberIdentifier = "maternal_mother";
    } else if (
      parseRes.entities.relation === "grandfather" ||
      parseRes.entities.relation === "grandmother" ||
      (parseRes.entities.age !== undefined && parseRes.entities.age >= 60)
    ) {
      memberIdentifier = "senior_grandfather";
    }

    return {
      intent: parseRes.intent,
      confidence: parseRes.confidence,
      schemeId: parseRes.schemeId,
      memberIdentifier,
      verificationCode: parseRes.entities.verificationCode,
      entities: parseRes.entities,
      topic: parseRes.topic,
      clarificationPrompt: parseRes.clarificationPrompt,
      rawTranscript: parseRes.rawTranscript,
      language: parseRes.language,
    };
  }
}
