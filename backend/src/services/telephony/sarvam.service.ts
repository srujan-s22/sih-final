import { env } from "../../config/env.js";
import { VoiceIntentType, SupportedVoiceLanguage } from "../../../../shared/types/voice.js";

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
   * Uses production saaras:v3 model with Indic language coverage
   */
  public async speechToText(
    audioBase64: string,
    languageCode: string = "hi-IN",
    audioFormat: string = "wav"
  ): Promise<SarvamSttResponse> {
    if (!this.isConfigured()) {
      return {
        transcript: "",
        language_code: languageCode,
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
        `${languageCode}\r\n` +
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
        language_code: data.language_code || languageCode,
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
   * Uses current production bulbul:v3 model with verified v3 speaker (roopa / shubh)
   * Formatted for 8kHz / 16kHz PSTN telephony output without v2-only pitch/loudness parameters
   */
  public async textToSpeech(
    text: string,
    targetLanguageCode: string = "hi-IN",
    speaker?: string
  ): Promise<SarvamTtsResponse> {
    if (!this.isConfigured()) {
      return { audios: [] };
    }

    const selectedSpeaker = speaker || this.defaultSpeaker;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech`, {
        method: "POST",
        headers: {
          "api-subscription-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          inputs: [text],
          target_language_code: targetLanguageCode,
          speaker: selectedSpeaker,
          pace: 1.0,
          temperature: 0.6,
          speech_sample_rate: 8000,
          output_audio_codec: "wav",
          model: this.ttsModel,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Sarvam TTS failed with HTTP ${response.status}`);
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
   * Deterministic pattern matching with language-aware context mapping
   */
  public understandIntent(
    transcript: string,
    sessionLanguage: string = "hi-IN"
  ): SarvamIntentExtractionResult {
    const raw = transcript.trim();
    const normalized = raw.toLowerCase();

    // 1. Check for Termination / End Call
    if (
      normalized.includes("bye") ||
      normalized.includes("alvida") ||
      normalized.includes("shukriya") ||
      normalized.includes("thank you") ||
      normalized.includes("dhanyawad") ||
      normalized.includes("band karo") ||
      normalized.includes("end call") ||
      normalized.includes("hang up")
    ) {
      return {
        intent: "END_CALL",
        confidence: 0.95,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 2. Check for Verification / Digits PIN
    const digitsMatch = raw.match(/\b\d{4,12}\b/);
    if (
      normalized.includes("ration") ||
      normalized.includes("card number") ||
      normalized.includes("pin") ||
      normalized.includes("code") ||
      normalized.includes("verify") ||
      digitsMatch
    ) {
      return {
        intent: "VERIFY_IDENTITY",
        confidence: 0.9,
        verificationCode: digitsMatch ? digitsMatch[0] : undefined,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 3. Check for Assistance Status
    if (
      normalized.includes("status") ||
      normalized.includes("progress") ||
      normalized.includes("kaha tak") ||
      normalized.includes("kab milega") ||
      normalized.includes("application status") ||
      normalized.includes("card bana") ||
      normalized.includes("card status")
    ) {
      const schemeId = normalized.includes("ayushman") || normalized.includes("pmjay") || normalized.includes("pm-jay")
        ? "ab-pmjay"
        : normalized.includes("janani") || normalized.includes("jsy") || normalized.includes("maternity")
        ? "jsy"
        : undefined;

      return {
        intent: "CHECK_ASSISTANCE_STATUS",
        confidence: 0.9,
        schemeId,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 4. Check for Follow-up Schedule
    if (
      normalized.includes("follow up") ||
      normalized.includes("followup") ||
      normalized.includes("visit") ||
      normalized.includes("kab aayengi") ||
      normalized.includes("kab aayenge") ||
      normalized.includes("next visit") ||
      normalized.includes("asha kab") ||
      normalized.includes("appointment")
    ) {
      return {
        intent: "CHECK_FOLLOW_UP",
        confidence: 0.88,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 5. Check for Request Assistance / ASHA Help
    if (
      normalized.includes("help") ||
      normalized.includes("madad") ||
      normalized.includes("apply") ||
      normalized.includes("form") ||
      normalized.includes("sahayata") ||
      normalized.includes("banwana hai") ||
      normalized.includes("apply karna hai") ||
      normalized.includes("request assistance") ||
      normalized.includes("enroll")
    ) {
      const schemeId = normalized.includes("ayushman") || normalized.includes("pmjay") || normalized.includes("pm-jay") || normalized.includes("senior")
        ? "ab-pmjay"
        : normalized.includes("janani") || normalized.includes("jsy") || normalized.includes("pregnancy") || normalized.includes("delivery")
        ? "jsy"
        : undefined;

      return {
        intent: "REQUEST_ASSISTANCE",
        confidence: 0.85,
        schemeId,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 6. Check for Specific Eligibility / Member check
    if (
      normalized.includes("eligible") ||
      normalized.includes("eligibility") ||
      normalized.includes("patra") ||
      normalized.includes("patrata") ||
      normalized.includes("yogyata") ||
      normalized.includes("milega kya") ||
      normalized.includes("qualify") ||
      normalized.includes("qualification") ||
      normalized.includes("grandfather") ||
      normalized.includes("dada") ||
      normalized.includes("dadi") ||
      normalized.includes("bujurg") ||
      normalized.includes("70") ||
      normalized.includes("71") ||
      normalized.includes("pregnant") ||
      normalized.includes("garbhwati")
    ) {
      const schemeId = normalized.includes("janani") || normalized.includes("jsy") || normalized.includes("pregnant") || normalized.includes("maternity")
        ? "jsy"
        : "ab-pmjay";

      const memberIdentifier = normalized.includes("grandfather") || normalized.includes("dada") || normalized.includes("71") || normalized.includes("senior")
        ? "senior_grandfather"
        : normalized.includes("pregnant") || normalized.includes("wife") || normalized.includes("mother")
        ? "maternal_mother"
        : undefined;

      return {
        intent: "CHECK_ELIGIBILITY",
        confidence: 0.85,
        schemeId,
        memberIdentifier,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 7. Check for Connected ASHA Worker details
    if (
      normalized.includes("asha worker") ||
      normalized.includes("asha didi") ||
      normalized.includes("meri asha") ||
      normalized.includes("contact asha") ||
      normalized.includes("asha number")
    ) {
      return {
        intent: "CONTACT_ASHA",
        confidence: 0.85,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 8. Check for Public / General Schemes
    if (
      normalized.includes("scheme") ||
      normalized.includes("yojana") ||
      normalized.includes("sarkari") ||
      normalized.includes("benefits") ||
      normalized.includes("list") ||
      normalized.includes("ayushman") ||
      normalized.includes("janani")
    ) {
      return {
        intent: "CHECK_SCHEMES",
        confidence: 0.8,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    // 9. Greeting / Start
    if (
      normalized.includes("namaste") ||
      normalized.includes("hello") ||
      normalized.includes("hi") ||
      normalized.includes("pranam") ||
      normalized.includes("vanakkam") ||
      normalized.includes("namaskara")
    ) {
      return {
        intent: "GREETING",
        confidence: 0.9,
        rawTranscript: raw,
        language: sessionLanguage,
      };
    }

    return {
      intent: "UNKNOWN",
      confidence: 0.5,
      rawTranscript: raw,
      language: sessionLanguage,
    };
  }
}
