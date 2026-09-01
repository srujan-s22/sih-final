import {
  VOICE_KNOWLEDGE_BASE,
  LocalizedKnowledgeItem,
} from "./voice-knowledge.js";
import {
  toVoiceLanguage,
  SupportedVoiceLanguage,
  VoiceIntentType,
} from "../../../../shared/types/voice.js";

export interface KnowledgeMatchResult {
  found: boolean;
  text: string;
  topic?: string;
  category?: string;
  confidence: number;
}

export class VoiceKnowledgeService {
  private knowledgeItems: LocalizedKnowledgeItem[];

  constructor(customItems?: LocalizedKnowledgeItem[]) {
    this.knowledgeItems = customItems || VOICE_KNOWLEDGE_BASE;
  }

  /**
   * Retrieves the best-matching knowledge answer for a caller's query
   */
  public queryKnowledge(params: {
    transcript: string;
    language?: SupportedVoiceLanguage | string;
    intent?: VoiceIntentType;
    topic?: string;
    schemeId?: string;
  }): KnowledgeMatchResult {
    const raw = (params.transcript || "").trim().toLowerCase();
    const lang = toVoiceLanguage(params.language || "en-IN");
    const langKey = lang === "kn-IN" ? "kn" : lang === "hi-IN" ? "hi" : "en";

    // 1. Direct Scheme Match
    if (params.schemeId) {
      const schemeItem = this.knowledgeItems.find(
        (k) => k.category === "SCHEME" && k.topic === params.schemeId
      );
      if (schemeItem) {
        return {
          found: true,
          text: schemeItem[langKey],
          topic: schemeItem.topic,
          category: schemeItem.category,
          confidence: 0.95,
        };
      }
    }

    // 2. Direct Topic Match
    if (params.topic) {
      const topicItem = this.knowledgeItems.find((k) => k.topic === params.topic);
      if (topicItem) {
        return {
          found: true,
          text: topicItem[langKey],
          topic: topicItem.topic,
          category: topicItem.category,
          confidence: 0.92,
        };
      }
    }

    // 3. Intent-based Filtering & Keyword Scoring
    let candidateItems = this.knowledgeItems;
    if (params.intent === "ABOUT_SWASTHYASETU") {
      candidateItems = this.knowledgeItems.filter(
        (k) => k.category === "ABOUT_SWASTHYASETU"
      );
    } else if (params.intent === "CITIZEN_PORTAL_INFO") {
      candidateItems = this.knowledgeItems.filter(
        (k) => k.category === "CITIZEN_PORTAL" || k.category === "HOW_TO_WEBSITE"
      );
    } else if (params.intent === "ASHA_PORTAL_INFO") {
      candidateItems = this.knowledgeItems.filter(
        (k) => k.category === "ASHA_PORTAL"
      );
    } else if (params.intent === "ADMIN_PORTAL_INFO") {
      candidateItems = this.knowledgeItems.filter(
        (k) => k.category === "ADMIN_PORTAL"
      );
    } else if (params.intent === "HOW_TO_USE_WEBSITE") {
      candidateItems = this.knowledgeItems.filter(
        (k) => k.category === "HOW_TO_WEBSITE"
      );
    } else if (params.intent === "VOICE_ASSISTANT_HELP" || params.intent === "HELP") {
      candidateItems = this.knowledgeItems.filter(
        (k) => k.category === "VOICE_CAPABILITIES" || k.category === "ABOUT_SWASTHYASETU"
      );
    } else if (params.intent === "SCHEME_INFORMATION" || params.intent === "SPECIFIC_SCHEME_INFORMATION") {
      candidateItems = this.knowledgeItems.filter((k) => k.category === "SCHEME");
    }

    let bestItem: LocalizedKnowledgeItem | null = null;
    let highestScore = 0;

    for (const item of candidateItems) {
      let score = 0;
      for (const kw of item.keywords) {
        const kwLower = kw.toLowerCase();
        if (raw.includes(kwLower)) {
          score += kwLower.split(" ").length * 2; // multi-word keyword match gets higher weight
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestItem = item;
      }
    }

    if (bestItem && highestScore > 0) {
      return {
        found: true,
        text: bestItem[langKey],
        topic: bestItem.topic,
        category: bestItem.category,
        confidence: Math.min(0.9, 0.5 + highestScore * 0.1),
      };
    }

    // 4. Default Category Fallback if candidates were filtered
    if (params.intent === "ABOUT_SWASTHYASETU") {
      const defaultAbout = this.knowledgeItems.find((k) => k.id === "about_platform");
      if (defaultAbout) {
        return {
          found: true,
          text: defaultAbout[langKey],
          topic: defaultAbout.topic,
          category: defaultAbout.category,
          confidence: 0.8,
        };
      }
    }

    return {
      found: false,
      text: "",
      confidence: 0,
    };
  }
}

export const voiceKnowledgeService = new VoiceKnowledgeService();
