import { SupportedVoiceLanguage, toVoiceLanguage } from "../../../../shared/types/voice.js";

export interface FormatterSchemeMatch {
  id: string;
  name: string;
}

/**
 * VoiceResponseFormatter
 * Centralizes all user-facing voice assistant dialogue generation across en-IN, kn-IN, and hi-IN.
 * Keeps healthcare decisions and business logic language-neutral while delivering natural, empathetic speech.
 */
export class VoiceResponseFormatter {
  public static getEmergencyRedirection(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಕೇವಲ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ಆಡಳಿತಾತ್ಮಕ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತದೆ ಮತ್ತು ತುರ್ತು ಚಿಕಿತ್ಸೆ ನೀಡಲು ಸಾಧ್ಯವಿಲ್ಲ. ನಿಮಗೆ ಅಥವಾ ನಿಮ್ಮ ಸುತ್ತಮುತ್ತಲಿನವರಿಗೆ ತುರ್ತು ವೈದ್ಯಕೀಯ ಪರಿಸ್ಥಿತಿ ಇದ್ದರೆ, ದಯವಿಟ್ಟು ತಕ್ಷಣ 108 ಅಥವಾ 102 ಗೆ ಕರೆ ಮಾಡಿ, ಅಥವಾ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.";
    }
    if (l === "hi-IN") {
      return "स्वास्थ्यसेतु केवल स्वास्थ्य योजनाओं की प्रशासनिक जानकारी प्रदान करता है और आपातकालीन चिकित्सा सहायता प्रदान नहीं कर सकता। यदि आपको या आपके आसपास किसी को आपातकालीन चिकित्सा सहायता चाहिए, तो कृपया तुरंत 108 या 102 पर कॉल करें, या निकटतम अस्पताल जाएं।";
    }
    return "SwasthyaSetu provides administrative health scheme guidance and cannot provide emergency medical triage. If you or someone around you is experiencing a medical emergency, please call 108 or 102 immediately, or visit your nearest hospital emergency ward.";
  }

  public static getGreeting(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ನಮಸ್ಕಾರ! ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸಹಾಯವಾಣಿಗೆ ಸುಸ್ವಾಗತ. ನಾನು ನಿಮಗೆ ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆಗಳು, ಕುಟುಂಬದ ಅರ್ಹತೆ, ಆಶಾ ಸಹಾಯ ವಿನಂತಿಗಳು ಮತ್ತು ಮನೆಭೇಟಿಗಳ ಬಗ್ಗೆ ಮಾಹಿತಿ ನೀಡಬಲ್ಲೆ. ತಮಗೆ ಏನು ಮಾಹಿತಿ ಬೇಕು?";
    }
    if (l === "hi-IN") {
      return "नमस्ते! स्वास्थ्यसेतु में आपका स्वागत है। मैं आपको सरकारी स्वास्थ्य योजनाओं, परिवार की पात्रता, आशा सहायता और घर-द्वार दौरों के बारे में जानकारी दे सकता हूँ। आप क्या जानना चाहते हैं?";
    }
    return "Namaste! Welcome to SwasthyaSetu. I can assist you with government health scheme details, family eligibility, assistance requests, and ASHA worker visits. What would you like to know?";
  }

  public static getVerificationPrompt(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ನಿಮ್ಮ ಕುಟುಂಬದ ವೈಯಕ್ತಿಕ ದಾಖಲೆಗಳು ಮತ್ತು ಯೋಜನೆಗಳ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಲು ನಿಮ್ಮ ಗುರುತನ್ನು ದೃಢೀಕರಿಸಬೇಕಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ನೋಂದಾಯಿತ ರೇಷನ್ ಕಾರ್ಡ್‌ನ ಕೊನೆಯ 4 ಅಂಕಿಗಳನ್ನು ತಿಳಿಸಿ.";
    }
    if (l === "hi-IN") {
      return "आपके परिवार के व्यक्तिगत रिकॉर्ड और योजना पात्रता की जांच के लिए मुझे आपकी पहचान सत्यापित करनी होगी। कृपया अपने पंजीकृत राशन कार्ड के अंतिम 4 अंक बताएं।";
    }
    return "To check personal family records and scheme entitlements, I need to verify your identity. Please tell me the last 4 digits of your registered Ration Card.";
  }

  public static getVerificationSuccess(headName: string, lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return `${headName} ಅವರ ಕುಟುಂಬದ ಗುರುತು ಯಶಸ್ವಿಯಾಗಿ ದೃಢೀಕರಿಸಲ್ಪಟ್ಟಿದೆ. ಇಂದು ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`;
    }
    if (l === "hi-IN") {
      return `${headName} के परिवार की पहचान सफलतापूर्वक सत्यापित हो गई है। आज मैं आपके परिवार की क्या सहायता कर सकता हूँ?`;
    }
    return `Identity verified for ${headName}'s household. How can I assist your family today?`;
  }

  public static getVerificationMismatch(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ನೀವು ನೀಡಿದ ಪರಿಶೀಲನಾ ಕೋಡ್ ನೋಂದಾಯಿತ ಕುಟುಂಬ ದಾಖಲೆಗಳಿಗೆ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಗೌಪ್ಯತೆಯ ರಕ್ಷಣೆಗಾಗಿ ಖಾಸಗಿ ವಿವರಗಳನ್ನು ಸುರಕ್ಷಿತವಾಗಿರಿಸಲಾಗಿದೆ.";
    }
    if (l === "hi-IN") {
      return "प्रदान किया गया सत्यापन कोड आपके पंजीकृत परिवार के रिकॉर्ड से मेल नहीं खाता है। आपकी गोपनीयता की सुरक्षा के लिए व्यक्तिगत जानकारी सुरक्षित रखी गई है।";
    }
    return "The verification code provided did not match your registered household records. For your privacy, private information remains protected.";
  }

  public static getGeneralSchemeInfo(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಪ್ರಮುಖ ರಾಷ್ಟ್ರೀಯ ಆರೋಗ್ಯ ಯೋಜನೆಗಳನ್ನು ಒಳಗೊಂಡಿದೆ, ಅದರಲ್ಲಿ ಹಿರಿಯ ನಾಗರಿಕರು ಮತ್ತು ಕಡಿಮೆ ಆದಾಯದ ಕುಟುಂಬಗಳಿಗೆ ಆಯುಷ್ಮಾನ್ ಭಾರತ್ PM-JAY, ಹಾಗೂ ತಾಯಂದಿರ ಆರೈಕೆಗಾಗಿ ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ (JSY) ಸೇರಿವೆ.";
    }
    if (l === "hi-IN") {
      return "स्वास्थ्यसेतु प्रमुख राष्ट्रीय स्वास्थ्य योजनाओं को शामिल करता है, जिसमें वरिष्ठ नागरिकों और कम आय वाले परिवारों के लिए आयुष्मान भारत PM-JAY और मातृ देखभाल के लिए जननी सुरक्षा योजना (JSY) शामिल हैं।";
    }
    return "SwasthyaSetu covers major national healthcare initiatives including Ayushman Bharat PM-JAY for senior citizens and low-income families, and Janani Suraksha Yojana for maternal care.";
  }

  public static getSchemeDetails(
    name: string,
    shortName: string,
    shortDesc: string,
    coverageAmount?: number,
    lang?: string
  ): string {
    const l = toVoiceLanguage(lang);
    const covText = coverageAmount
      ? `Rs. ${coverageAmount.toLocaleString()}`
      : l === "kn-IN"
      ? "ಉಚಿತ ಚಿಕಿತ್ಸೆ"
      : l === "hi-IN"
      ? "मुफ्त इलाज"
      : "free treatment";

    if (l === "kn-IN") {
      return `${name} (${shortName}): ${shortDesc}. ಗರಿಷ್ಠ ವ್ಯಾಪ್ತಿ: ${covText}.`;
    }
    if (l === "hi-IN") {
      return `${name} (${shortName}): ${shortDesc}। अधिकतम कवरेज: ${covText}।`;
    }
    return `${name} (${shortName}): ${shortDesc}. Coverage up to ${covText}.`;
  }

  public static getHouseholdEligibleSchemes(
    headName: string,
    schemes: FormatterSchemeMatch[],
    lang?: string
  ): string {
    const l = toVoiceLanguage(lang);
    if (schemes.length === 0) {
      if (l === "kn-IN") {
        return `ಪ್ರಸ್ತುತ ದಾಖಲೆಗಳ ಪ್ರಕಾರ, ${headName} ಅವರ ಕುಟುಂಬಕ್ಕೆ ಯಾವುದೇ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು ತಕ್ಷಣ ಹೊಂದಾಣಿಕೆಯಾಗುತ್ತಿಲ್ಲ, ಆದರೆ ಸಾರ್ವಜನಿಕ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರದ ಸೇವೆಗಳು ಲಭ್ಯವಿವೆ.`;
      }
      if (l === "hi-IN") {
        return `वर्तमान रिकॉर्ड के अनुसार, ${headName} के परिवार के लिए कोई सरकारी योजना सीधे मेल नहीं खाती है, लेकिन सार्वजनिक स्वास्थ्य केंद्र की सेवाएं हमेशा उपलब्ध हैं।`;
      }
      return `Based on current records, no government schemes are immediately matched for ${headName}'s family, but public health center services remain available.`;
    }

    const schemeNames = schemes.map((s) => s.name).join(l === "kn-IN" ? " ಮತ್ತು " : l === "hi-IN" ? " और " : " and ");
    if (l === "kn-IN") {
      return `ನಿಮ್ಮ ಕುಟುಂಬವು ${schemes.length} ಪರಿಶೀಲಿತ ಯೋಜನೆಗಳಿಗೆ ಅರ್ಹವಾಗಿದೆ: ${schemeNames}. ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರ ಸಹಾಯ ಬೇಕೇ?`;
    }
    if (l === "hi-IN") {
      return `आपका परिवार ${schemes.length} सत्यापित योजनाओं के लिए पात्र है: ${schemeNames}। क्या आप अपनी आशा कार्यकर्ता की सहायता से आवेदन करना चाहते हैं?`;
    }
    return `Your household is eligible for ${schemes.length} verified scheme(s): ${schemeNames}. Would you like help applying with your ASHA worker?`;
  }

  public static getMemberEligibility(
    isEligible: boolean,
    memberName: string,
    age: number,
    relationship: string,
    schemeId: string,
    lang?: string
  ): string {
    const l = toVoiceLanguage(lang);
    const schemeLabel = schemeId === "ab-pmjay"
      ? "PM-JAY"
      : schemeId === "jsy"
      ? "JSY"
      : schemeId.toUpperCase();

    if (isEligible) {
      if (l === "kn-IN") {
        return `ಹೌದು! ನಿಮ್ಮ ಪರಿಶೀಲಿತ ಕುಟುಂಬ ದಾಖಲೆಗಳ ಆಧಾರದ ಮೇಲೆ, ${memberName} (ವಯಸ್ಸು ${age}, ${relationship}) ಅವರು ${schemeLabel} ಯೋಜನೆಗೆ ಅರ್ಹರಾಗಿದ್ದಾರೆ. ನೋಂದಣಿಗೆ ಸಹಾಯ ಮಾಡಲು ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರಿಗೆ ತಿಳಿಸಬೇಕೇ?`;
      }
      if (l === "hi-IN") {
        return `हाँ! आपके सत्यापित पारिवारिक रिकॉर्ड के आधार पर, ${memberName} (उम्र ${age}, ${relationship}) ${schemeLabel} योजना के लिए पात्र हैं। क्या आप चाहते हैं कि मैं आपकी आशा कार्यकर्ता को पंजीकरण में सहायता के लिए सूचित करूँ?`;
      }
      return `Yes! Based on your verified household records, ${memberName} (Age ${age}, ${relationship}) is eligible for ${schemeId === "ab-pmjay" ? "PM-JAY Ayushman Bharat senior citizen benefits" : "scheme coverage"}. Would you like me to notify your ASHA worker to assist with registration?`;
    }

    if (l === "kn-IN") {
      return `ನಿಮ್ಮ ವಿವರಗಳ ಪ್ರಕಾರ, ${memberName} ಅವರು ಪ್ರಸ್ತುತ ಈ ಯೋಜನೆಯ ನಿಯಮಾನುಸಾರ ಅರ್ಹತಾ ಮಾನದಂಡಗಳನ್ನು ಪೂರೈಸುತ್ತಿಲ್ಲ.`;
    }
    if (l === "hi-IN") {
      return `आपके प्रोफाइल के अनुसार, ${memberName} वर्तमान में इस योजना के पात्रता मानदंडों को पूरा नहीं करते हैं।`;
    }
    return `Based on your profile, ${memberName} does not currently meet the deterministic criteria for this scheme.`;
  }

  public static getAssistanceStatus(
    hasActiveCase: boolean,
    schemeName: string,
    status: string,
    completedTasks: number,
    totalTasks: number,
    lang?: string
  ): string {
    const l = toVoiceLanguage(lang);
    if (!hasActiveCase) {
      if (l === "kn-IN") {
        return "ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕಾಗಿ ಪ್ರಸ್ತುತ ಯಾವುದೇ ಸಕ್ರಿಯ ಯೋಜನೆ ಸಹಾಯ ಪ್ರಕರಣ ಪ್ರಗತಿಯಲ್ಲಿಲ್ಲ. ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರು ಹೊಸ ಸಹಾಯ ಪ್ರಕರಣವನ್ನು ಪ್ರಾರಂಭಿಸಬೇಕೇ?";
      }
      if (l === "hi-IN") {
        return "वर्तमान में आपके परिवार के लिए कोई सक्रिय सहायता प्रक्रिया प्रगति पर नहीं है। क्या आप चाहते हैं कि आपकी आशा कार्यकर्ता आपके लिए नई सहायता प्रक्रिया शुरू करें?";
      }
      return "You currently have no active scheme assistance cases in progress. Would you like your ASHA worker to start one for your family?";
    }

    if (status === "RESOLVED" || status === "CLOSED") {
      if (l === "kn-IN") {
        return `${schemeName} ಗಾಗಿ ನಿಮ್ಮ ಸಹಾಯ ಪ್ರಕ್ರಿಯೆಯು ಯಶಸ್ವಿಯಾಗಿ ಪೂರ್ಣಗೊಂಡಿದೆ (${totalTasks} ರಲ್ಲಿ ${totalTasks} ಕ್ಷೇತ್ರ ಕಾರ್ಯಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ). ಎಲ್ಲಾ ಪ್ರಯೋಜನಗಳು ಸಕ್ರಿಯವಾಗಿವೆ.`;
      }
      if (l === "hi-IN") {
        return `${schemeName} के लिए आपकी सहायता प्रक्रिया सफलतापूर्वक पूरी हो गई है (${totalTasks} में से ${totalTasks} मैदानी कार्य पूरे हुए)। सभी लाभ सक्रिय हैं।`;
      }
      return `Your assistance for ${schemeName} has been successfully completed and resolved (${totalTasks} of ${totalTasks} field tasks complete). All benefits are active.`;
    }

    if (l === "kn-IN") {
      return `${schemeName} ಗಾಗಿ ನಿಮ್ಮ ಸಹಾಯ ಪ್ರಕ್ರಿಯೆಯು ಪ್ರಗತಿಯಲ್ಲಿದೆ. ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರು ${totalTasks} ರಲ್ಲಿ ${completedTasks} ಕ್ಷೇತ್ರ ಕಾರ್ಯಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದಾರೆ.`;
    }
    if (l === "hi-IN") {
      return `${schemeName} के लिए आपकी सहायता प्रक्रिया प्रगति पर है। आपकी आशा कार्यकर्ता ने ${totalTasks} में से ${completedTasks} कार्य पूरे कर लिए हैं।`;
    }
    return `Your assistance for ${schemeName} is currently in progress. Your ASHA worker has completed ${completedTasks} of ${totalTasks} field tasks.`;
  }

  public static getFollowUpStatus(
    hasPending: boolean,
    title?: string,
    dueDate?: string,
    isOverdue?: boolean,
    lang?: string
  ): string {
    const l = toVoiceLanguage(lang);
    if (!hasPending) {
      if (l === "kn-IN") {
        return "ನಿಮಗೆ ಯಾವುದೇ ಬಾಕಿ ಮನೆಭೇಟಿಗಳಿಲ್ಲ. ಹಿಂದಿನ ಎಲ್ಲಾ ಭೇಟಿಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ.";
      }
      if (l === "hi-IN") {
        return "आपकी कोई भी आगामी आशा भेंट लंबित नहीं है। पिछले सभी दौरे पूरे हो चुके हैं।";
      }
      return "You have no pending follow-up visits. All previous visits have been completed.";
    }

    if (isOverdue) {
      if (l === "kn-IN") {
        return `"${title}" ಗಾಗಿ ನಿಮ್ಮ ಮನೆಭೇಟಿಯನ್ನು ${dueDate} ರಂದು ನಿಗದಿಪಡಿಸಲಾಗಿತ್ತು ಮತ್ತು ಅದು ಪ್ರಸ್ತುತ ಬಾಕಿ ಉಳಿದಿದೆ. ನಿಮ್ಮ ಭೇಟಿಗೆ ಮೊದಲ ಆದ್ಯತೆ ನೀಡಲು ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರಿಗೆ ತಿಳಿಸಲಾಗಿದೆ.`;
      }
      if (l === "hi-IN") {
        return `"${title}" के लिए आपका फॉलो-अप दौरा ${dueDate} के लिए निर्धारित था और वर्तमान में लंबित है। आपकी आशा कार्यकर्ता को प्राथमिकता से मिलने के लिए सूचित किया गया है।`;
      }
      return `Your follow-up visit for "${title}" was scheduled for ${dueDate} and is currently overdue. Your ASHA worker has been notified to prioritize your visit.`;
    }

    if (l === "kn-IN") {
      return `"${title}" ಗಾಗಿ ನಿಮ್ಮ ಮುಂದಿನ ಮನೆಬಾಗಿಲಿನ ಭೇಟಿಯನ್ನು ${dueDate} ರಂದು ನಿಗದಿಪಡಿಸಲಾಗಿದೆ.`;
    }
    if (l === "hi-IN") {
      return `"${title}" के लिए आपकी अगली घर-द्वार भेंट ${dueDate} के लिए निर्धारित है।`;
    }
    return `Your next doorstep follow-up visit for "${title}" is scheduled for ${dueDate}.`;
  }

  public static getConnectedAsha(
    isLinked: boolean,
    ashaName?: string,
    serviceArea?: string,
    lang?: string
  ): string {
    const l = toVoiceLanguage(lang);
    if (!isLinked) {
      if (l === "kn-IN") {
        return "ನಿಮ್ಮ ಕುಟುಂಬವು ಪ್ರಸ್ತುತ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯೊಂದಿಗೆ ಲಿಂಕ್ ಆಗಿಲ್ಲ. ಸ್ವಾಸ್ಥ್ಯಸೇತು ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಸ್ಥಳೀಯ ಆಶಾ ಅವರ ಸರ್ವಿಸ್ ಕೋಡ್ ಬಳಸಿ ನೀವು ಲಿಂಕ್ ಮಾಡಬಹುದು.";
      }
      if (l === "hi-IN") {
        return "आपका परिवार वर्तमान में किसी समर्पित आशा कार्यकर्ता से नहीं जुड़ा है। आप स्वास्थ्यसेतु पोर्टल पर अपनी स्थानीय आशा कार्यकर्ता के सर्विस कोड का उपयोग करके जुड़ सकते हैं।";
      }
      return "Your household is not currently linked to a dedicated ASHA worker. You can link with your local ASHA using her Service Code on the SwasthyaSetu portal.";
    }

    if (l === "kn-IN") {
      return `ನಿಮ್ಮ ನಿಯೋಜಿತ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರು ${ashaName}, ಇವರು ${serviceArea} ವ್ಯಾಪ್ತಿಯನ್ನು ನೋಡಿಕೊಳ್ಳುತ್ತಾರೆ.`;
    }
    if (l === "hi-IN") {
      return `आपकी नियत आशा कार्यकर्ता ${ashaName} हैं जो ${serviceArea} क्षेत्र की देखरेख करती हैं।`;
    }
    return `Your assigned ASHA worker is ${ashaName} covering ${serviceArea}.`;
  }

  public static getRequestAssistanceResult(
    isExisting: boolean,
    schemeName: string,
    completedTasks: number,
    totalTasks: number,
    lang?: string
  ): string {
    const l = toVoiceLanguage(lang);
    if (isExisting) {
      if (l === "kn-IN") {
        return `${schemeName} ಗಾಗಿ ಸಹಾಯ ಪ್ರಕ್ರಿಯೆಯು ಈಗಾಗಲೇ ಚಾಲ್ತಿಯಲ್ಲಿದೆ (${totalTasks} ರಲ್ಲಿ ${completedTasks} ಕಾರ್ಯಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ). ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರನ್ನು ಈಗಾಗಲೇ ನಿಯೋಜಿಸಲಾಗಿದೆ.`;
      }
      if (l === "hi-IN") {
        return `${schemeName} के लिए सहायता प्रक्रिया पहले से प्रगति पर है (${totalTasks} में से ${completedTasks} कार्य पूर्ण हुए)। आपकी आशा कार्यकर्ता पहले से ही नियुक्त हैं।`;
      }
      return `An assistance workflow for ${schemeName} already exists and is currently in progress (${completedTasks} of ${totalTasks} tasks complete). Your ASHA worker has already been assigned.`;
    }

    if (l === "kn-IN") {
      return `${schemeName} ಗಾಗಿ ನಿಮ್ಮ ಸಹಾಯ ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ನಿಯೋಜಿತ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರಿಗೆ ತಿಳಿಸಲಾಗಿದ್ದು, ಅವರು ನಿಮ್ಮೊಂದಿಗೆ ಮನೆಭೇಟಿಯನ್ನು ಸಂಯೋಜಿಸುತ್ತಾರೆ.`;
    }
    if (l === "hi-IN") {
      return `${schemeName} के लिए आपका सहायता अनुरोध दर्ज कर लिया गया है। आपकी आशा कार्यकर्ता को सूचित कर दिया गया है और वे आपसे संपर्क करके घर-द्वार दौरे का समन्वय करेंगी।`;
    }
    return `Your assistance request for ${schemeName} has been submitted. Your assigned ASHA worker has been notified and will coordinate a field visit with you.`;
  }

  public static getEndCall(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಆರೋಗ್ಯ ಸಹಾಯವಾಣಿಗೆ ಕರೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ಆರೋಗ್ಯವಾಗಿರಿ, ಶುಭ ದಿನ. ನಮಸ್ಕಾರ!";
    }
    if (l === "hi-IN") {
      return "स्वास्थ्यसेतु हेल्पलाइन पर कॉल करने के लिए धन्यवाद। स्वस्थ रहें, आपका दिन शुभ हो। नमस्कार!";
    }
    return "Thank you for calling SwasthyaSetu Healthcare Helpline. Stay healthy, and have a good day. Goodbye!";
  }

  public static getSttRetryPrompt(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಮಾತು ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.";
    }
    if (l === "hi-IN") {
      return "क्षमा करें, मैं आपकी बात स्पष्ट रूप से नहीं सुन सका। कृपया पुनः कहें।";
    }
    return "I couldn't hear that clearly. Please say it again.";
  }

  public static getMaxTurnsPrompt(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ಈ ಸಹಾಯವಾಣಿ ಕರೆಯ ಗರಿಷ್ಠ ಸಮಯ ಮುಗಿದಿದೆ. ಹೆಚ್ಚಿನ ಮಾಹಿತಿಗಾಗಿ ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸ್ಥಳೀಯ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರನ್ನು ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಸ್ವಾಸ್ಥ್ಯಸೇತು ಪೋರ್ಟಲ್‌ಗೆ ಭೇಟಿ ನೀಡಿ. ಧನ್ಯವಾದಗಳು!";
    }
    if (l === "hi-IN") {
      return "इस हेल्पलाइन कॉल की अधिकतम समय सीमा समाप्त हो गई है। अधिक सहायता के लिए कृपया अपनी स्थानीय आशा कार्यकर्ता से संपर्क करें या स्वास्थ्यसेतु पोर्टल पर जाएं। धन्यवाद!";
    }
    return "You have reached the maximum duration for this helpline call. If you need further assistance, please reach out to your local ASHA worker or visit the SwasthyaSetu portal. Goodbye!";
  }

  public static getDefaultFallbackPrompt(lang?: string): string {
    const l = toVoiceLanguage(lang);
    if (l === "kn-IN") {
      return "ಕ್ಷಮಿಸಿ, ಅದು ನನಗೆ ಸರಿಯಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ. ನಾನು ನಿಮಗೆ ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ವಿವರಗಳು, ಕುಟುಂಬದ ಅರ್ಹತೆ ಮತ್ತು ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರ ಭೇಟಿಗಳ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ನೀವು 'ಆಯುಷ್ಮಾನ್ ಅರ್ಹತೆ ತಿಳಿಸಿ' ಅಥವಾ 'ಅರ್ಜಿ ಸ್ಥಿತಿ ತಿಳಿಸಿ' ಎಂದು ಕೇಳಬಹುದು.";
    }
    if (l === "hi-IN") {
      return "क्षमा करें, मैं आपकी बात पूरी तरह समझ नहीं सका। मैं आपको सरकारी स्वास्थ्य योजनाओं, पारिवारिक पात्रता, आवेदन की स्थिति और आशा कार्यकर्ता के दौरों की जानकारी दे सकता हूँ। आप कह सकते हैं 'आयुष्मान पात्रता जांचें' या 'आवेदन की स्थिति बताएं'।";
    }
    return "I'm sorry, I didn't quite understand that. I can assist you with government health scheme details, family eligibility, assistance requests, and ASHA worker follow-ups. You can say 'Check Ayushman eligibility' or 'Check application status'.";
  }
}
