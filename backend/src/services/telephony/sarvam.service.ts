import { env } from "../../config/env.js";
import {
  VoiceIntentType,
  SupportedVoiceLanguage,
  toVoiceLanguage,
} from "../../../../shared/types/voice.js";

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
   * Deterministic pattern matching with language-aware context mapping
   * Supports English, Kannada, and Hindi (with natural code-switching / Hinglish / Kanglish)
   */
  public understandIntent(
    transcript: string,
    sessionLanguage?: string
  ): SarvamIntentExtractionResult {
    const raw = transcript.trim();
    const normalized = raw.toLowerCase();
    const resolvedLanguage = toVoiceLanguage(sessionLanguage || env.VOICE_LANGUAGE || "en-IN");

    // 0. Check for Medical Emergency (Instant safety redirection)
    if (
      normalized.includes("emergency") ||
      normalized.includes("ambulance") ||
      normalized.includes("108") ||
      normalized.includes("102") ||
      normalized.includes("chest pain") ||
      normalized.includes("heart attack") ||
      normalized.includes("dil ka daura") ||
      normalized.includes("bleeding") ||
      normalized.includes("khoon nikal") ||
      normalized.includes("unconscious") ||
      normalized.includes("behosh") ||
      normalized.includes("accident") ||
      normalized.includes("saans nahi aa rahi") ||
      // Kannada keywords
      normalized.includes("ತುರ್ತು") ||
      normalized.includes("ಆಂಬ್ಯುಲೆನ್ಸ್") ||
      normalized.includes("ಎದೆ ನೋವು") ||
      normalized.includes("ಹೃದಯಾಘಾತ") ||
      normalized.includes("ರಕ್ತಸ್ರಾವ") ||
      normalized.includes("ಉಸಿರಾಟ") ||
      normalized.includes("ಪ್ರಜ್ಞೆ") ||
      normalized.includes("ಅಪಘಾತ") ||
      // Hindi keywords
      normalized.includes("आपातकालीन") ||
      normalized.includes("एम्बुलेंस") ||
      normalized.includes("सीने में दर्द") ||
      normalized.includes("खून") ||
      normalized.includes("बेहोश")
    ) {
      return {
        intent: "EMERGENCY",
        confidence: 0.99,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 1. Check for Termination / End Call
    if (
      normalized.includes("bye") ||
      normalized.includes("alvida") ||
      normalized.includes("shukriya") ||
      normalized.includes("thank you") ||
      normalized.includes("dhanyawad") ||
      normalized.includes("band karo") ||
      normalized.includes("end call") ||
      normalized.includes("hang up") ||
      // Kannada keywords
      normalized.includes("ಧನ್ಯವಾದ") ||
      normalized.includes("ಮುಕ್ತಾಯ") ||
      normalized.includes("ಸಾಕು") ||
      normalized.includes("ಕಟ್ ಮಾಡಿ") ||
      // Hindi keywords
      normalized.includes("धन्यवाद") ||
      normalized.includes("अलविदा") ||
      normalized.includes("कॉल समाप्त")
    ) {
      return {
        intent: "END_CALL",
        confidence: 0.95,
        rawTranscript: raw,
        language: resolvedLanguage,
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
      // Kannada keywords
      normalized.includes("ರೇಷನ್") ||
      normalized.includes("ಪಡಿತರ") ||
      normalized.includes("ಕಾರ್ಡ್ ಸಂಖ್ಯೆ") ||
      normalized.includes("ಕೋಡ್") ||
      normalized.includes("ಪರಿಶೀಲನೆ") ||
      // Hindi keywords
      normalized.includes("राशन") ||
      normalized.includes("कार्ड नंबर") ||
      normalized.includes("पिन") ||
      normalized.includes("सत्यापन") ||
      digitsMatch
    ) {
      return {
        intent: "VERIFY_IDENTITY",
        confidence: 0.9,
        verificationCode: digitsMatch ? digitsMatch[0] : undefined,
        rawTranscript: raw,
        language: resolvedLanguage,
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
      normalized.includes("card status") ||
      // Kannada keywords
      normalized.includes("ಸ್ಥಿತಿ") ||
      normalized.includes("ಪ್ರಗತಿ") ||
      normalized.includes("ಎಲ್ಲಿಯವರೆಗೆ ಬಂತು") ||
      normalized.includes("ಯಾವಾಗ ಬರುತ್ತೆ") ||
      normalized.includes("ಅರ್ಜಿ ಸ್ಥಿತಿ") ||
      normalized.includes("ಕಾರ್ಡ್ ಬಂದಿದೆಯಾ") ||
      // Hindi keywords
      normalized.includes("स्थिति") ||
      normalized.includes("प्रगति") ||
      normalized.includes("आवेदन स्थिति")
    ) {
      const schemeId =
        normalized.includes("ayushman") ||
        normalized.includes("pmjay") ||
        normalized.includes("pm-jay") ||
        normalized.includes("ಆಯುಷ್ಮಾನ್") ||
        normalized.includes("आयुष्मान")
          ? "ab-pmjay"
          : normalized.includes("janani") ||
            normalized.includes("jsy") ||
            normalized.includes("maternity") ||
            normalized.includes("ಜನನಿ") ||
            normalized.includes("जननी")
          ? "jsy"
          : undefined;

      return {
        intent: "CHECK_ASSISTANCE_STATUS",
        confidence: 0.9,
        schemeId,
        rawTranscript: raw,
        language: resolvedLanguage,
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
      normalized.includes("appointment") ||
      // Kannada keywords
      normalized.includes("ಭೇಟಿ") ||
      normalized.includes("ಆಶಾ ಯಾವಾಗ ಬರುತ್ತಾರೆ") ||
      normalized.includes("ಮನೆಭೇಟಿ") ||
      normalized.includes("ಮುಂದಿನ ಭೇಟಿ") ||
      // Hindi keywords
      normalized.includes("दौरा") ||
      normalized.includes("आशा कब आएंगी") ||
      normalized.includes("अगली भेंट")
    ) {
      return {
        intent: "CHECK_FOLLOW_UP",
        confidence: 0.88,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 5. Check for Request Assistance / ASHA Help
    if (
      normalized.includes("help") ||
      normalized.includes("madad") ||
      normalized.includes("apply") ||
      /\bform\b/.test(normalized) ||
      normalized.includes("sahayata") ||
      normalized.includes("banwana hai") ||
      normalized.includes("apply karna hai") ||
      normalized.includes("request assistance") ||
      normalized.includes("enroll") ||
      // Kannada keywords
      normalized.includes("ಸಹಾಯ") ||
      normalized.includes("ಅರ್ಜಿ ಸಲ್ಲಿಸಬೇಕು") ||
      normalized.includes("ಮಾಡಿಸಿಕೊಡಿ") ||
      normalized.includes("ಸಹಾಯ ಬೇಕು") ||
      normalized.includes("ನೋಂದಣಿ") ||
      // Hindi keywords
      normalized.includes("मदद") ||
      normalized.includes("सहायता") ||
      normalized.includes("आवेदन करना है") ||
      normalized.includes("बनवाना है") ||
      normalized.includes("पंजीकरण")
    ) {
      const schemeId =
        normalized.includes("ayushman") ||
        normalized.includes("pmjay") ||
        normalized.includes("pm-jay") ||
        normalized.includes("senior") ||
        normalized.includes("ಆಯುಷ್ಮಾನ್") ||
        normalized.includes("आयुष्मान")
          ? "ab-pmjay"
          : normalized.includes("janani") ||
            normalized.includes("jsy") ||
            normalized.includes("pregnancy") ||
            normalized.includes("delivery") ||
            normalized.includes("ಜನನಿ") ||
            normalized.includes("जननी") ||
            normalized.includes("ಗರ್ಭಿಣಿ") ||
            normalized.includes("गर्भवती")
          ? "jsy"
          : undefined;

      return {
        intent: "REQUEST_ASSISTANCE",
        confidence: 0.85,
        schemeId,
        rawTranscript: raw,
        language: resolvedLanguage,
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
      normalized.includes("garbhwati") ||
      normalized.includes("senior") ||
      // Kannada keywords
      normalized.includes("ಅರ್ಹತೆ") ||
      normalized.includes("ಅರ್ಹರೇ") ||
      normalized.includes("ಸಿಗುತ್ತಾ") ||
      normalized.includes("ಸಿಗುವುದೇ") ||
      normalized.includes("ತಾತ") ||
      normalized.includes("ಅಜ್ಜ") ||
      normalized.includes("ಅಜ್ಜಿ") ||
      normalized.includes("ಹಿರಿಯ") ||
      normalized.includes("ಗರ್ಭಿಣಿ") ||
      // Hindi keywords
      normalized.includes("पात्र") ||
      normalized.includes("पात्रता") ||
      normalized.includes("योग्यता") ||
      normalized.includes("मिलेगा क्या") ||
      normalized.includes("दादा") ||
      normalized.includes("दादी") ||
      normalized.includes("बुजुर्ग") ||
      normalized.includes("गर्भवती")
    ) {
      const schemeId =
        normalized.includes("janani") ||
        normalized.includes("jsy") ||
        normalized.includes("pregnant") ||
        normalized.includes("maternity") ||
        normalized.includes("ಜನನಿ") ||
        normalized.includes("जननी") ||
        normalized.includes("ಗರ್ಭಿಣಿ") ||
        normalized.includes("गर्भवती")
          ? "jsy"
          : "ab-pmjay";

      const memberIdentifier =
        normalized.includes("grandfather") ||
        normalized.includes("dada") ||
        normalized.includes("dadi") ||
        normalized.includes("71") ||
        normalized.includes("70") ||
        normalized.includes("senior") ||
        normalized.includes("bujurg") ||
        normalized.includes("ತಾತ") ||
        normalized.includes("ಅಜ್ಜ") ||
        normalized.includes("ಅಜ್ಜಿ") ||
        normalized.includes("ಹಿರಿಯ") ||
        normalized.includes("दादा") ||
        normalized.includes("दादी") ||
        normalized.includes("बुजुर्ग")
          ? "senior_grandfather"
          : normalized.includes("pregnant") ||
            normalized.includes("wife") ||
            normalized.includes("mother") ||
            normalized.includes("garbhwati") ||
            normalized.includes("ಗರ್ಭಿಣಿ") ||
            normalized.includes("ತಾಯಿ") ||
            normalized.includes("गर्भवती")
          ? "maternal_mother"
          : undefined;

      return {
        intent: "CHECK_ELIGIBILITY",
        confidence: 0.85,
        schemeId,
        memberIdentifier,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 7. Check for Connected ASHA Worker details
    if (
      normalized.includes("asha worker") ||
      normalized.includes("asha didi") ||
      normalized.includes("meri asha") ||
      normalized.includes("contact asha") ||
      normalized.includes("asha number") ||
      // Kannada keywords
      normalized.includes("ಆಶಾ ಕಾರ್ಯಕರ್ತೆ") ||
      normalized.includes("ನಮ್ಮ ಆಶಾ") ||
      normalized.includes("ಆಶಾ ನಂಬರ್") ||
      // Hindi keywords
      normalized.includes("आशा दीदी") ||
      normalized.includes("मेरी आशा") ||
      normalized.includes("आशा नंबर") ||
      normalized.includes("आशा कार्यकर्ता")
    ) {
      return {
        intent: "CONTACT_ASHA",
        confidence: 0.85,
        rawTranscript: raw,
        language: resolvedLanguage,
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
      normalized.includes("janani") ||
      normalized.includes("pmjay") ||
      normalized.includes("pm-jay") ||
      // Kannada keywords
      normalized.includes("ಯೋಜನೆ") ||
      normalized.includes("ಸರ್ಕಾರಿ") ||
      normalized.includes("ಆಯುಷ್ಮಾನ್") ||
      normalized.includes("ಜನನಿ") ||
      // Hindi keywords
      normalized.includes("योजना") ||
      normalized.includes("सरकारी") ||
      normalized.includes("आयुष्मान") ||
      normalized.includes("जननी")
    ) {
      const schemeId =
        normalized.includes("ayushman") ||
        normalized.includes("pmjay") ||
        normalized.includes("pm-jay") ||
        normalized.includes("ಆಯುಷ್ಮಾನ್") ||
        normalized.includes("आयुष्मान")
          ? "ab-pmjay"
          : normalized.includes("janani") ||
            normalized.includes("jsy") ||
            normalized.includes("ಜನನಿ") ||
            normalized.includes("जननी")
          ? "jsy"
          : undefined;

      return {
        intent: "CHECK_SCHEMES",
        confidence: 0.8,
        schemeId,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    // 9. Greeting / Start
    if (
      normalized.includes("namaste") ||
      normalized.includes("hello") ||
      normalized.includes("hi") ||
      normalized.includes("pranam") ||
      normalized.includes("vanakkam") ||
      normalized.includes("namaskara") ||
      // Kannada keywords
      normalized.includes("ನಮಸ್ಕಾರ") ||
      normalized.includes("ಹಲೋ") ||
      // Hindi keywords
      normalized.includes("नमस्ते") ||
      normalized.includes("प्रणाम")
    ) {
      return {
        intent: "GREETING",
        confidence: 0.9,
        rawTranscript: raw,
        language: resolvedLanguage,
      };
    }

    return {
      intent: "UNKNOWN",
      confidence: 0.5,
      rawTranscript: raw,
      language: resolvedLanguage,
    };
  }
}
