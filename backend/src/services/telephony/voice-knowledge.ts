/**
 * SwasthyaSetu Centralized Voice Knowledge Base
 * Authoritative, grounded domain knowledge for the Voice Assistant
 * Strictly aligned with actual application features and verified scheme registries.
 *
 * Provides natural spoken explanations in English, Kannada, and Hindi (en-IN, kn-IN, hi-IN).
 * Zero hallucinations: no medicine ordering, hospital bed booking, or ambulance dispatch.
 */

export interface LocalizedKnowledgeItem {
  id: string;
  category:
    | "ABOUT_SWASTHYASETU"
    | "CITIZEN_PORTAL"
    | "ASHA_PORTAL"
    | "ADMIN_PORTAL"
    | "SCHEME"
    | "HOW_TO_WEBSITE"
    | "VOICE_CAPABILITIES";
  topic: string;
  keywords: string[];
  en: string;
  kn: string;
  hi: string;
}

export const VOICE_KNOWLEDGE_BASE: LocalizedKnowledgeItem[] = [
  // =========================================================================
  // 1. ABOUT SWASTHYASETU
  // =========================================================================
  {
    id: "about_platform",
    category: "ABOUT_SWASTHYASETU",
    topic: "overview",
    keywords: [
      "what is swasthyasetu", "about swasthyasetu", "swasthyasetu kya hai", "swasthyasetu andre enu",
      "swasthya setu", "what does swasthyasetu do", "platform", "purpose"
    ],
    en: "SwasthyaSetu is a digital public health bridge connecting rural families with government healthcare schemes and their local ASHA worker. It helps you check your health benefits, enroll family members, and receive doorstep support from your community healthcare worker.",
    kn: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಗ್ರಾಮೀಣ ಕುಟುಂಬಗಳನ್ನು ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆಗಳು ಮತ್ತು ಸ್ಥಳೀಯ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರೊಂದಿಗೆ ಬೆಸೆಯುವ ಡಿಜಿಟಲ್ ವೇದಿಕೆಯಾಗಿದೆ. ಇದು ನಿಮ್ಮ ಕುಟುಂಬದ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ಅರ್ಹತೆ ತಿಳಿಯಲು ಮತ್ತು ಮನೆಬಾಗಿಲಿಗೆ ನೆರವು ಪಡೆಯಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.",
    hi: "स्वास्थ्यसेतु ग्रामीण परिवारों को सरकारी स्वास्थ्य योजनाओं और उनकी स्थानीय आशा कार्यकर्ता से जोड़ने वाला डिजिटल मंच है। यह आपको स्वास्थ्य योजनाओं की पात्रता जांचने और घर-द्वार पर सहायता प्राप्त करने में मदद करता है।"
  },
  {
    id: "about_target_audience",
    category: "ABOUT_SWASTHYASETU",
    topic: "target_users",
    keywords: [
      "who is it for", "who can use", "kiske liye hai", "yarigagi", "beneficiaries", "citizens"
    ],
    en: "SwasthyaSetu is designed for citizens and rural families seeking healthcare support, community ASHA workers managing household visits, and health administrators overseeing scheme delivery.",
    kn: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ನೆರವು ಬಯಸುವ ನಾಗರಿಕರು, ಮನೆಭೇಟಿ ಮಾಡುವ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರು ಮತ್ತು ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ಮೇಲ್ವಿಚಾರಣೆ ನಡೆಸುವ ಆಡಳಿತಾಧಿಕಾರಿಗಳಿಗಾಗಿ ರೂಪಿಸಲಾಗಿದೆ.",
    hi: "स्वास्थ्यसेतु स्वास्थ्य योजनाओं की सहायता चाहने वाले नागरिकों, घर-घर दौरा करने वाली आशा कार्यकर्ताओं और योजना प्रबंधन करने वाले अधिकारियों के लिए बनाया गया है।"
  },
  {
    id: "about_is_free",
    category: "ABOUT_SWASTHYASETU",
    topic: "cost",
    keywords: [
      "is it free", "cost", "charges", "fees", "paise lagte hain", "shulka", "free idiya", "muft",
      "ಉಚಿತ", "ಉಚಿತವೇ", "ಮುಫ಼್ತ್", "मुफ्त", "ಶುಲ್ಕ", "ನಿಃಶುಲ್ಕ", "निःशुल्क"
    ],
    en: "Yes, SwasthyaSetu is completely free of cost for all citizens and ASHA workers. All eligibility checks and helpline calls are public services with no fees.",
    kn: "ಹೌದು, ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸೇವೆಗಳು ನಾಗರಿಕರಿಗೆ ಮತ್ತು ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರಿಗೆ ಸಂಪೂರ್ಣವಾಗಿ ಉಚಿತವಾಗಿದೆ. ಎಲ್ಲಾ ಅರ್ಹತೆ ಪರಿಶೀಲನೆ ಮತ್ತು ಸಹಾಯವಾಣಿ ಕರೆಗಳು ಉಚಿತವಾಗಿದ್ದು, ಯಾವುದೇ ಶುಲ್ಕ ಇರುವುದಿಲ್ಲ.",
    hi: "हाँ, स्वास्थ्यसेतु सभी नागरिकों और आशा कार्यकर्ताओं के लिए पूरी तरह से निःशुल्क है। इसके लिए कोई शुल्क नहीं लगता।"
  },
  {
    id: "about_rural_support",
    category: "ABOUT_SWASTHYASETU",
    topic: "rural_help",
    keywords: [
      "rural families", "how does it help", "gramin", "halli", "doorstep", "benefits"
    ],
    en: "SwasthyaSetu helps rural families by removing paperwork confusion, identifying government health benefits for seniors and mothers, and connecting you directly to your village ASHA worker for doorstep enrollment.",
    kn: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಗ್ರಾಮೀಣ ಕುಟುಂಬಗಳಿಗೆ ದಾಖಲೆಗಳ ಗೊಂದಲವಿಲ್ಲದೆ ಹಿರಿಯರು ಮತ್ತು ಗರ್ಭಿಣಿಯರಿಗೆ ಸಿಗುವ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಗುರುತಿಸಿ, ಮನೆಬಾಗಿಲಿಗೆ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರ ನೆರವು ಒದಗಿಸುತ್ತದೆ.",
    hi: "स्वास्थ्यसेतु ग्रामीण परिवारों को बिना किसी कागजी उलझन के बुजुर्गों और महिलाओं के लिए सरकारी योजनाओं की पहचान कराता है और आशा कार्यकर्ता के जरिए घर-द्वार पर मदद दिलाता है।"
  },
  {
    id: "about_asha_connection",
    category: "ABOUT_SWASTHYASETU",
    topic: "asha_link",
    keywords: [
      "how does asha connection work", "asha connection", "asha kaise judti hai", "asha hege samparkisuvudu"
    ],
    en: "You can link your household to your local ASHA worker using her unique 6-digit ASHA Service Code or by scanning her QR code. Once linked, she can visit your home to verify documents and assist with scheme cards.",
    kn: "ನಿಮ್ಮ ಸ್ಥಳೀಯ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರ 6 ಅಂಕಿಯ ಸೇವಾ ಕೋಡ್ ಅಥವಾ ಕ್ಯೂಆರ್ ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡುವ ಮೂಲಕ ನಿಮ್ಮ ಕುಟುಂಬವನ್ನು ಜೋಡಿಸಬಹುದು. ನಂತರ ಅವರು ನಿಮ್ಮ ಮನೆಗೆ ಭೇಟಿ ನೀಡಿ ನೆರವು ನೀಡುತ್ತಾರೆ.",
    hi: "आप अपनी स्थानीय आशा कार्यकर्ता के 6 अंकों के सर्विस कोड या क्यूआर कोड से अपने परिवार को जोड़ सकते हैं। इसके बाद वे आपके घर आकर दस्तावेज़ सत्यापन और कार्ड बनवाने में मदद करेंगी।"
  },
  {
    id: "about_voice_assistant",
    category: "ABOUT_SWASTHYASETU",
    topic: "voice_bot",
    keywords: [
      "what does voice assistant do", "voicebot", "phone helpline", "what can you do", "voice helpline"
    ],
    en: "I am the SwasthyaSetu Voice Assistant. I can answer your questions about government health schemes, check your family eligibility, track ASHA visit schedules, and guide you on using the website in English, Kannada, or Hindi.",
    kn: "ನಾನು ಸ್ವಾಸ್ಥ್ಯಸೇತು ಧ್ವನಿ ಸಹಾಯಕ. ನಾನು ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ಮಾಹಿತಿ, ಕುಟುಂಬದ ಅರ್ಹತೆ ಪರಿಶೀಲನೆ, ಆಶಾ ಭೇಟಿಗಳ ಸ್ಥಿತಿ ಮತ್ತು ವೆಬ್‌ಸೈಟ್ ಬಳಕೆ ಬಗ್ಗೆ ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾಹಿತಿ ನೀಡಬಲ್ಲೆ.",
    hi: "मैं स्वास्थ्यसेतु का वॉइस असिस्टेंट हूँ। मैं आपको सरकारी स्वास्थ्य योजनाओं की जानकारी, पारिवारिक पात्रता जांच, आशा दीदी के दौरे की स्थिति और वेबसाइट उपयोग की जानकारी हिंदी, कन्नड़ या अंग्रेजी में दे सकता हूँ।"
  },

  // =========================================================================
  // 2. CITIZEN PORTAL WORKFLOWS
  // =========================================================================
  {
    id: "citizen_dashboard_overview",
    category: "CITIZEN_PORTAL",
    topic: "dashboard",
    keywords: [
      "what is on dashboard", "citizen dashboard", "my health benefits", "dashboard me kya hai", "dashboard nalli enide"
    ],
    en: "Your Citizen Dashboard displays your household summary, eligible health benefits under schemes like PM-JAY and JSY, your connected ASHA worker details, and your recommended Next Step for completing scheme enrollment.",
    kn: "ನಿಮ್ಮ ಸಿಟಿಜನ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ನಿಮ್ಮ ಕುಟುಂಬದ ವಿವರಗಳು, ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಮತ್ತು ಜೆ.ಎಸ್.ವೈ ನಂತಹ ಯೋಜನೆಗಳ ಅರ್ಹತೆ, ಸಂಪರ್ಕಿತ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯ ವಿವರಗಳು ಮತ್ತು ಮುಂದಿನ ಹಂತಗಳನ್ನು ತೋರಿಸುತ್ತದೆ.",
    hi: "आपका सिटिजन डैशबोर्ड आपके परिवार का विवरण, आयुष्मान भारत और जेएसवाई जैसी योजनाओं में पात्रता, जुड़ी हुई आशा कार्यकर्ता की जानकारी और आपका अगला कदम दिखाता है।"
  },
  {
    id: "citizen_household_info",
    category: "CITIZEN_PORTAL",
    topic: "household_details",
    keywords: [
      "how to add household", "household information", "ration category", "bpl", "aay", "apl", "rashan card"
    ],
    en: "In the Household section, you record your state, district, village, and ration card category such as BPL for Below Poverty Line, AAY for Antyodaya Anna Yojana, or APL. These details determine which government health schemes apply to your family.",
    kn: "ಕುಟುಂಬದ ವಿಭಾಗದಲ್ಲಿ ನಿಮ್ಮ ರಾಜ್ಯ, ಜಿಲ್ಲೆ, ಗ್ರಾಮ ಮತ್ತು ಪಡಿತರ ಚೀಟಿ ವರ್ಗಗಳಾದ ಬಿಪಿಎಲ್, ಅಂತ್ಯೋದಯ (AAY) ಅಥವಾ ಎಪಿಎಲ್ ವಿವರಗಳನ್ನು ದಾಖಲಿಸಲಾಗುತ್ತದೆ. ಇದು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಅರ್ಹತೆಯನ್ನು ನಿರ್ಧರಿಸುತ್ತದೆ.",
    hi: "परिवार अनुभाग में आप अपना राज्य, जिला, गांव और राशन कार्ड श्रेणी जैसे बीपीएल, अंत्योदय (एएवाई) या एपीएल दर्ज करते हैं। इसी आधार पर सरकारी स्वास्थ्य योजनाओं की पात्रता तय होती है।"
  },
  {
    id: "citizen_add_family_member",
    category: "CITIZEN_PORTAL",
    topic: "add_member",
    keywords: [
      "how do i add family member", "add member", "add father", "add mother", "add child", "sadasya kaise jode", "kutumbada sadasyaru"
    ],
    en: "To add a family member on the website, go to My Family, click Add Member, and enter their name, age, gender, relationship, and health conditions such as pregnancy or disability. You can edit or remove members anytime.",
    kn: "ಕುಟುಂಬದ ಸದಸ್ಯರನ್ನು ಸೇರಿಸಲು ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ 'ಮೈ ಫ್ಯಾಮಿಲಿ'ಗೆ ಹೋಗಿ, 'ಆಡ್ ಮೆಂಬರ್' ಕ್ಲಿಕ್ ಮಾಡಿ ಹೆಸರು, ವಯಸ್ಸು, ಲಿಂಗ, ಸಂಬಂಧ ಮತ್ತು ಗರ್ಭಧಾರಣೆ ಅಥವಾ ಅಂಗವಿಕಲತೆಯಂತಹ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ.",
    hi: "परिवार के सदस्य को जोड़ने के लिए वेबसाइट पर 'माई फैमिली' में जाएं, 'ऐड मेंबर' पर क्लिक करें और उनका नाम, उम्र, लिंग, संबंध व स्वास्थ्य स्थिति (जैसे गर्भावस्था या दिव्यांगता) दर्ज करें।"
  },
  {
    id: "citizen_elderly_handling",
    category: "CITIZEN_PORTAL",
    topic: "senior_citizens",
    keywords: [
      "elderly members", "senior citizen", "70 plus", "70 years", "bujurg", "hiriyaru", "vay vandana"
    ],
    en: "Family members aged 70 years and above are automatically matched for universal Ayushman Bharat PM-JAY Senior Citizen coverage of ₹5 lakh, regardless of family income or ration category.",
    kn: "70 ವರ್ಷ ಮತ್ತು ಮೇಲ್ಪಟ್ಟ ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ ಕುಟುಂಬದ ಆದಾಯದ ಮಿತಿಯಿಲ್ಲದೆ ಸಾರ್ವತ್ರಿಕ ಆಯುಷ್ಮಾನ್ ಭಾರತ್ PM-JAY ಅಡಿಯಲ್ಲಿ 5 ಲಕ್ಷ ರೂಪಾಯಿಗಳ ಉಚಿತ ಚಿಕಿತ್ಸಾ ರಕ್ಷಣೆ ದೊರೆಯುತ್ತದೆ.",
    hi: "70 वर्ष या उससे अधिक उम्र के वरिष्ठ नागरिकों को पारिवारिक आय की सीमा के बिना आयुष्मान भारत PM-JAY के तहत 5 लाख रुपये का सार्वभौमिक स्वास्थ्य सुरक्षा कवर मिलता है।"
  },
  {
    id: "citizen_maternal_handling",
    category: "CITIZEN_PORTAL",
    topic: "maternal_care",
    keywords: [
      "pregnant", "nursing mothers", "maternity", "garbhwati", "garbhini", "jsy", "pmmvy", "tayandiru"
    ],
    en: "Pregnant and nursing mothers recorded in your family profile are evaluated for Janani Suraksha Yojana and PMMVY for safe institutional delivery cash assistance, free checkups, and nutritional support.",
    kn: "ಕುಟುಂಬದಲ್ಲಿರುವ ಗರ್ಭಿಣಿಯರು ಮತ್ತು ಬಾಣಂತಿಯರಿಗೆ ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆ ಮತ್ತು ಪಿ.ಎಂ.ಎಂ.ವಿ.ವೈ ಮೂಲಕ ಆಸ್ಪತ್ರೆ ಹೆರಿಗೆ ಧನಸಹಾಯ, ತಪಾಸಣೆ ಮತ್ತು ಪೌಷ್ಟಿಕಾಂಶ ಬೆಂಬಲ ಸಿಗುತ್ತದೆ.",
    hi: "परिवार में गर्भवती और धात्री माताओं को जननी सुरक्षा योजना और पीएमएमवीवाई के तहत सुरक्षित संस्थागत प्रसव सहायता, मुफ्त जांच और पोषण भत्ता दिया जाता है।"
  },
  {
    id: "citizen_connect_asha",
    category: "CITIZEN_PORTAL",
    topic: "connect_asha",
    keywords: [
      "how do i connect to asha", "asha service code", "connect asha", "asha se kaise jude", "asha worker samparka"
    ],
    en: "To connect with an ASHA worker, open the Get ASHA Help section on your citizen portal and enter her 6-digit ASHA Service Code or scan her QR code. Once confirmed, your household is linked for doorstep support.",
    kn: "ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯೊಂದಿಗೆ ಸಂಪರ್ಕ ಸಾಧಿಸಲು ಸಿಟಿಜನ್ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ 'ಗೆಟ್ ಆಶಾ ಹೆಲ್ಪ್' ತೆರೆದು, ಅವರ 6 ಅಂಕಿಯ ಸೇವಾ ಕೋಡ್ ನಮೂದಿಸಿ ಅಥವಾ ಕ್ಯೂಆರ್ ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.",
    hi: "आशा कार्यकर्ता से जुड़ने के लिए पोर्टल में 'गेट आशा हेल्प' पर जाएं और उनका 6 अंकों का सर्विस कोड दर्ज करें या क्यूआर कोड स्कैन करें। पुष्टि होते ही आपका परिवार जुड़ जाएगा।"
  },
  {
    id: "citizen_request_assistance",
    category: "CITIZEN_PORTAL",
    topic: "request_help",
    keywords: [
      "request asha help", "assistance request", "madad ki arji", "sahaya vinanti", "track request"
    ],
    en: "You can request ASHA assistance for scheme enrollment, document verification, or hospital facility access. You can track your request status directly on your dashboard as your ASHA reviews and schedules a home visit.",
    kn: "ನೀವು ಯೋಜನೆ ನೋಂದಣಿ, ದಾಖಲೆ ಪರಿಶೀಲನೆ ಅಥವಾ ಆಸ್ಪತ್ರೆ ಸೇವೆಗಳಿಗಾಗಿ ಆಶಾ ನೆರವು ವಿನಂತಿಸಬಹುದು. ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ವಿನಂತಿಯ ಪ್ರಗತಿಯನ್ನು ಪರಿಶೀಲಿಸಬಹುದು.",
    hi: "आप योजना पंजीकरण, दस्तावेज़ सत्यापन या अस्पताल सहायता के लिए आशा मदद का अनुरोध कर सकते हैं। इसकी स्थिति आप सीधे डैशबोर्ड पर ट्रैक कर सकते हैं।"
  },
  {
    id: "citizen_scheme_statuses",
    category: "CITIZEN_PORTAL",
    topic: "scheme_status_meanings",
    keywords: [
      "why may be eligible", "details needed", "why not eligible", "verified government criteria", "patrata ka matlab"
    ],
    en: "Eligible means your profile matches all government rules. A few details needed means additional documents like an MCP card or institutional delivery record must be verified. SwasthyaSetu never manufactures eligibility without official criteria.",
    kn: "'ಅರ್ಹತೆ ಇದೆ' ಎಂದರೆ ನಿಮ್ಮ ದಾಖಲೆಗಳು ನಿಯಮಗಳಿಗೆ ಹೊಂದಾಣಿಕೆಯಾಗಿವೆ. 'ಹೆಚ್ಚಿನ ವಿವರ ಬೇಕು' ಎಂದರೆ ಎಂಸಿಪಿ ಕಾರ್ಡ್‌ನಂತಹ ದಾಖಲೆ ಪರಿಶೀಲಿಸಬೇಕಾಗಿದೆ ಎಂದರ್ಥ. ಅಧಿಕೃತ ಮಾನದಂಡಗಳಿಲ್ಲದೆ ಕಲ್ಪಿತ ಫಲಿತಾಂಶ ನೀಡುವುದಿಲ್ಲ.",
    hi: "'पात्र' का अर्थ है कि आपका विवरण नियमों से मेल खाता है। 'कुछ विवरण आवश्यक हैं' का मतलब है कि एमसीपी कार्ड या संस्थागत प्रसव जैसे दस्तावेज़ों का सत्यापन बाकी है।"
  },
  {
    id: "citizen_next_steps",
    category: "CITIZEN_PORTAL",
    topic: "next_steps",
    keywords: [
      "what is my next step", "why is next step important", "agla kadam", "mundina hanta", "pending action"
    ],
    en: "My Next Step shows your immediate high-priority healthcare action, such as completing e-KYC on the official Ayushman App, gathering your ration card, or contacting your ASHA worker for an antenatal checkup.",
    kn: "ಮುಂದಿನ ಹಂತವು ನಿಮ್ಮ ಪ್ರಮುಖ ಆರೋಗ್ಯ ಕಾರ್ಯವನ್ನು ತೋರಿಸುತ್ತದೆ, ಉದಾಹರಣೆಗೆ ಆಯುಷ್ಮಾನ್ ಆ್ಯಪ್‌ನಲ್ಲಿ ಇ-ಕೆವೈಸಿ ಪೂರ್ಣಗೊಳಿಸುವುದು ಅಥವಾ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯ ಭೇಟಿಗೆ ಸಿದ್ಧತೆ ಮಾಡಿಕೊಳ್ಳುವುದು.",
    hi: "अगला कदम आपकी सबसे जरूरी स्वास्थ्य कार्रवाई दिखाता है, जैसे आयुष्मान ऐप पर ई-केवाईसी पूरी करना, राशन कार्ड तैयार रखना, या आशा दीदी से संपर्क करना।"
  },

  // =========================================================================
  // 3. ASHA PORTAL WORKFLOWS
  // =========================================================================
  {
    id: "asha_dashboard_overview",
    category: "ASHA_PORTAL",
    topic: "asha_dashboard",
    keywords: [
      "asha dashboard", "needs attention", "follow-ups due", "active requests", "field priorities", "asha karyakshetra"
    ],
    en: "The ASHA Portal shows community health priorities: Needs Attention alerts, Doorstep Follow-ups Due today, Active Citizen Requests, and assigned households across the worker's coverage area.",
    kn: "ಆಶಾ ಪೋರ್ಟಲ್ ತುರ್ತು ಗಮನ ಅಗತ್ಯವಿರುವ ಪ್ರಕರಣಗಳು, ಇಂದು ಬಾಕಿ ಇರುವ ಮನೆಭೇಟಿಗಳು, ಸಕ್ರಿಯ ನಾಗರಿಕ ವಿನಂತಿಗಳು ಮತ್ತು ನಿಗದಿತ ಕುಟುಂಬಗಳ ಪಟ್ಟಿಯನ್ನು ತೋರಿಸುತ್ತದೆ.",
    hi: "आशा पोर्टल कार्यक्षेत्र की प्राथमिकताओं को दिखाता है: ध्यान देने योग्य अलर्ट, आज देय गृह भेंट, सक्रिय नागरिक अनुरोध और आवंटित परिवारों की सूची।"
  },
  {
    id: "asha_caseload_management",
    category: "ASHA_PORTAL",
    topic: "caseload",
    keywords: [
      "how does asha see households", "caseload", "assigned households", "kutumba vargikarana", "parivar soochi"
    ],
    en: "ASHAs can view all assigned households, search by Head of Household name, inspect family member health details, and check scheme eligibility gaps during field visits.",
    kn: "ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರು ತಮ್ಮ ವ್ಯಾಪ್ತಿಯ ಎಲ್ಲಾ ಕುಟುಂಬಗಳನ್ನು ವೀಕ್ಷಿಸಬಹುದು, ಕುಟುಂಬದ ಮುಖ್ಯಸ್ಥರ ಹೆಸರಿನಿಂದ ಹುಡುಕಬಹುದು ಮತ್ತು ಯೋಜನೆಗಳ ಅರ್ಹತಾ ಕೊರತೆಗಳನ್ನು ಪರಿಶೀಲಿಸಬಹುದು.",
    hi: "आशा कार्यकर्ता अपने सभी आवंटित परिवारों को देख सकती हैं, मुखिया के नाम से खोज सकती हैं और गृह भेंट के दौरान योजनाओं की पात्रता जांच सकती हैं।"
  },
  {
    id: "asha_case_journey",
    category: "ASHA_PORTAL",
    topic: "case_journey",
    keywords: [
      "what is a case", "case journey", "milestones", "field tasks", "blocked", "prakarana hanta"
    ],
    en: "A case tracks a citizen's scheme enrollment journey across milestones: Eligibility Identified, Identity Confirmed, e-KYC Verification, Application Submission, Card Generation, and Hospital Care Access.",
    kn: "ಪ್ರಕರಣವು ಫಲಾನುಭವಿಯ ಯೋಜನೆ ನೋಂದಣಿಯ ಹಂತಗಳನ್ನು ದಾಖಲಿಸುತ್ತದೆ: ಅರ್ಹತೆ ಗುರುತಿಸುವಿಕೆ, ಗುರುತು ದೃಢೀಕರಣ, ಇ-ಕೆವೈಸಿ, ಅರ್ಜಿ ಸಲ್ಲಿಕೆ ಮತ್ತು ಆಯುಷ್ಮಾನ್ ಕಾರ್ಡ್ ವಿತರಣೆ.",
    hi: "एक केस नागरिक के योजना नामांकन की यात्रा को ट्रैक करता है: पात्रता पहचान, पहचान सत्यापन, ई-केवाईसी, आवेदन जमा करना और कार्ड जारी होना।"
  },
  {
    id: "asha_follow_ups",
    category: "ASHA_PORTAL",
    topic: "follow_ups",
    keywords: [
      "what is a follow-up", "due today", "overdue", "complete visit", "reschedule", "mane bheti", "dora"
    ],
    en: "Follow-ups are scheduled doorstep visits for antenatal care, newborn monitoring, senior citizen e-KYC, or card delivery. ASHAs can complete visits with field notes or reschedule if the family was unavailable.",
    kn: "ಫಾಲೋ-ಅಪ್ ಎಂದರೆ ಗರ್ಭಿಣಿಯರ ಆರೈಕೆ, ನವಜಾತ ಶಿಶುಗಳ ತಪಾಸಣೆ ಅಥವಾ ಹಿರಿಯರ ಕಾರ್ಡ್ ವಿತರಣೆಗೆ ನಿಗದಿಪಡಿಸಿದ ಮನೆಭೇಟಿಗಳಾಗಿವೆ. ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರು ಭೇಟಿಯ ವಿವರಗಳನ್ನು ದಾಖಲಿಸಬಹುದು.",
    hi: "फॉलो-अप का अर्थ है गर्भवती महिलाओं, नवजात शिशुओं या बुजुर्गों के ई-केवाईसी और कार्ड वितरण के लिए निर्धारित घर-घर दौरे। आशा दीदी विजिट पूरा कर नोट दर्ज कर सकती हैं।"
  },

  // =========================================================================
  // 4. ADMIN PORTAL (High-level safe explanation)
  // =========================================================================
  {
    id: "admin_portal_overview",
    category: "ADMIN_PORTAL",
    topic: "admin_overview",
    keywords: [
      "what does admin do", "admin portal", "scheme registry", "telemetry", "system monitoring", "prashasaka"
    ],
    en: "The Admin Portal provides health system oversight, tracking verified government scheme rules, official evidence provenance, ASHA workforce coverage, and real-time telephony service health. It does not disclose private citizen health data.",
    kn: "ಅಡ್ಮಿನ್ ಪೋರ್ಟಲ್ ಸರ್ಕಾರದ ಆರೋಗ್ಯ ಯೋಜನೆಗಳ ನಿಯಮಗಳು, ಪರಿಶೀಲಿತ ಮೂಲಗಳು, ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರ ಕಾರ್ಯಕ್ಷೇತ್ರ ಮತ್ತು ಸಹಾಯವಾಣಿಯ ತಾಂತ್ರಿಕ ಸ್ಥಿತಿಯನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡುತ್ತದೆ.",
    hi: "एडमिन पोर्टल स्वास्थ्य प्रणाली की निगरानी करता है, जिसमें सत्यापित योजना नियम, आधिकारिक साक्ष्य, आशा कार्यबल और हेल्पलाइन की तकनीकी स्थिति की समीक्षा की जाती है।"
  },

  // =========================================================================
  // 5. SUPPORTED HEALTHCARE SCHEMES
  // =========================================================================
  {
    id: "scheme_ab_pmjay",
    category: "SCHEME",
    topic: "ab-pmjay",
    keywords: [
      "pmjay", "ab-pmjay", "ayushman", "ayushman bharat", "70 plus", "senior citizen card", "vay vandana", "5 lakh"
    ],
    en: "SwasthyaSetu covers Ayushman Bharat PM-JAY providing up to ₹5 lakh yearly cashless hospital coverage for secondary and tertiary inpatient care. It features a universal 70+ Senior Citizen pathway for all citizens aged 70 and above, regardless of income, with the Ayushman Vay Vandana Card.",
    kn: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಆಯುಷ್ಮಾನ್ ಭಾರತ್ PM-JAY ಯೋಜನೆಯು ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸೆಗಾಗಿ ವರ್ಷಕ್ಕೆ 5 ಲಕ್ಷ ರೂಪಾಯಿಗಳವರೆಗೆ ನಗದುರಹಿತ ರಕ್ಷಣೆ ನೀಡುತ್ತದೆ. 70 ವರ್ಷ ಮತ್ತು ಮೇಲ್ಪಟ್ಟ ಎಲ್ಲಾ ಹಿರಿಯ ನಾಗರಿಕರಿಗೆ ಆದಾಯ ಮಿತಿಯಿಲ್ಲದೆ ಆಯುಷ್ಮಾನ್ ವಯ ವಂದನಾ ಕಾರ್ಡ್ ಲಭ್ಯವಿದೆ.",
    hi: "स्वास्थ्यसेतु आयुष्मान भारत PM-JAY योजना अस्पताल में भर्ती के लिए प्रति वर्ष 5 लाख रुपये तक का कैशलेस इलाज प्रदान करती है। इसमें 70 वर्ष या उससे अधिक उम्र के सभी बुजुर्गों के लिए बिना आय सीमा के आयुष्मान वय वंदना कार्ड की सुविधा है।"
  },
  {
    id: "scheme_jsy",
    category: "SCHEME",
    topic: "jsy",
    keywords: [
      "jsy", "janani suraksha", "maternity scheme", "delivery cash", "prasav sahayata", "janani suraksha yojana", "institutional delivery"
    ],
    en: "Janani Suraksha Yojana (JSY) is a safe motherhood scheme under the National Health Mission. It provides direct cash assistance for institutional delivery among pregnant women delivering in accredited government or private health facilities, along with free antenatal care and ASHA support.",
    kn: "ಜನನಿ ಸುರಕ್ಷಾ ಯೋಜನೆಯು (JSY) ಸುರಕ್ಷಿತ ಹೆರಿಗೆಗಾಗಿ ಧನಸಹಾಯ ನೀಡುವ ಯೋಜನೆಯಾಗಿದೆ. ಸರ್ಕಾರಿ ಅಥವಾ ನೋಂದಾಯಿತ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ ಹೆರಿಗೆ ಮಾಡಿಸುವ ಗರ್ಭಿಣಿಯರಿಗೆ ನೇರ ನಗದು ನೆರವು ಮತ್ತು ಆಶಾ ಬೆಂಬಲ ಸಿಗುತ್ತದೆ.",
    hi: "जननी सुरक्षा योजना (JSY) सुरक्षित मातृत्व के लिए राष्ट्रीय स्वास्थ्य मिशन की योजना है। इसके तहत सरकारी या मान्यता प्राप्त अस्पताल में प्रसव कराने पर गर्भवती महिलाओं को सीधा नकद लाभ और आशा सहायता मिलती है।"
  },
  {
    id: "scheme_pmmvy",
    category: "SCHEME",
    topic: "pmmvy",
    keywords: [
      "pmmvy", "matru vandana", "pradhan mantri matru vandana yojana", "5000", "maternity cash"
    ],
    en: "Pradhan Mantri Matru Vandana Yojana (PMMVY) provides maternity financial benefits of ₹5,000 in installments to pregnant women and lactating mothers for the first living child through Direct Benefit Transfer, compensating for wage loss and supporting nutrition.",
    kn: "ಪ್ರಧಾನ ಮಂತ್ರಿ ಮಾತೃ ವಂದನಾ ಯೋಜನೆ (PMMVY) ಮೊದಲ ಮಗುವಿನ ಗರ್ಭಧಾರಣೆಯ ಸಂದರ್ಭದಲ್ಲಿ ಗರ್ಭಿಣಿಯರಿಗೆ ಮತ್ತು ಬಾಣಂತಿಯರಿಗೆ ಪೌಷ್ಟಿಕಾಂಶ ಮತ್ತು ಧನಸಹಾಯವಾಗಿ 5,000 ರೂಪಾಯಿಗಳನ್ನು ನೇರ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ನೀಡುತ್ತದೆ.",
    hi: "प्रधानमंत्री मातृ वंदना योजना (PMMVY) पहले जीवित बच्चे के लिए गर्भवती और धात्री माताओं को पोषण और मजदूरी की भरपाई हेतु 5,000 रुपये की वित्तीय सहायता डीबीटी के जरिए किस्तों में देती है।"
  },
  {
    id: "scheme_state_assurance",
    category: "SCHEME",
    topic: "state-health-assurance",
    keywords: [
      "state health assurance", "arogya karnataka", "state schemes", "rajya yojana", "ark"
    ],
    en: "State Health Assurance programs, such as Ayushman Bharat - Arogya Karnataka, provide cashless diagnostic, critical illness, and surgical care across state network hospitals for eligible ration card holders.",
    kn: "ಆರೋಗ್ಯ ಕರ್ನಾಟಕದಂತಹ ರಾಜ್ಯ ಆರೋಗ್ಯ ಭರವಸೆ ಯೋಜನೆಗಳು ರಾಜ್ಯದ ನೆಟ್‌ವರ್ಕ್ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ ಪಡಿತರ ಚೀಟಿ ಹೊಂದಿರುವ ಕುಟುಂಬಗಳಿಗೆ ನಗದುರಹಿತ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ ಮತ್ತು ತಪಾಸಣೆ ಸೌಲಭ್ಯಗಳನ್ನು ಒದಗಿಸುತ್ತವೆ.",
    hi: "राज्य स्वास्थ्य योजनाएं (जैसे आरोग्य कर्नाटक) राज्य के नेटवर्क अस्पतालों में पात्र राशन कार्ड धारकों को मुफ्त जांच, गंभीर बीमारी और शल्य चिकित्सा कवरेज प्रदान करती हैं।"
  },

  // =========================================================================
  // 6. WEBSITE "HOW DO I..." INSTRUCTIONS
  // =========================================================================
  {
    id: "how_to_add_family_member",
    category: "HOW_TO_WEBSITE",
    topic: "how_add_member",
    keywords: [
      "how do i add my father", "how to add member", "pitaji ko kaise jode", "tandeyannu hege serisuvudu", "add family",
      "ತಂದೆ", "ಸೇರಿಸುವುದು", "ತಂದೆಯನ್ನು ಸೇರಿಸುವುದು ಹೇಗೆ", "ಸದಸ್ಯರನ್ನು ಸೇರಿಸುವುದು ಹೇಗೆ", "ಕುಟುಂಬದ ಸದಸ್ಯರನ್ನು ಸೇರಿಸುವುದು", "पिताजी को जोड़ना"
    ],
    en: "To add a family member: Sign in to the Citizen Portal, click My Family in the navigation menu, click the Add Member button, enter their relationship, age, gender, and health details, then click Save Member.",
    kn: "ಕುಟುಂಬದ ಸದಸ್ಯರನ್ನು ಸೇರಿಸಲು: ಸಿಟಿಜನ್ ಪೋರ್ಟಲ್‌ಗೆ ಲಾಗಿನ್ ಆಗಿ, 'ಮೈ ಫ್ಯಾಮಿಲಿ' ಮೆನು ಕ್ಲಿಕ್ ಮಾಡಿ, 'ಆಡ್ ಮೆಂಬರ್' ಬಟನ್ ಒತ್ತಿ, ಅವರ ಸಂಬಂಧ, ವಯಸ್ಸು, ಲಿಂಗ ಮತ್ತು ಆರೋಗ್ಯ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ ಸೇವ್ ಮಾಡಿ.",
    hi: "परिवार के सदस्य को जोड़ने के लिए: सिटिजन पोर्टल पर जाएं, 'माई फैमिली' पर क्लिक करें, 'ऐड मेंबर' बटन दबाएं, उनका संबंध, उम्र, लिंग और स्वास्थ्य विवरण भरकर 'सेव मेंबर' पर क्लिक करें।"
  },
  {
    id: "how_to_connect_asha",
    category: "HOW_TO_WEBSITE",
    topic: "how_connect_asha",
    keywords: [
      "how to connect asha", "how do i connect", "connect to asha", "connect asha", "connect to my asha", "connect with asha",
      "asha service code", "asha se kaise jude", "asha worker samparka", "ಆಶಾ ಸಂಪರ್ಕ", "ಆಶಾ ಸಂಪರ್ಕಿಸುವುದು ಹೇಗೆ", "ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ಸಂಪರ್ಕ",
      "आशा दीदी", "आशा से कैसे जुड़ें", "आशा से जुड़ें", "आशा कार्यकर्ता से कैसे जुड़ें", "आशा संपर्क"
    ],
    en: "To connect with your ASHA: Open the Citizen Portal, go to Get ASHA Help, enter your ASHA worker's 6-digit ASHA Service Code or scan her QR code, and click Connect Household.",
    kn: "ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರೊಂದಿಗೆ ಸಂಪರ್ಕಿಸಲು: ಸಿಟಿಜನ್ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ 'ಗೆಟ್ ಆಶಾ ಹೆಲ್ಪ್'ಗೆ ಹೋಗಿ, ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯವರ 6 ಅಂಕಿಯ ಸರ್ವಿಸ್ ಕೋಡ್ ನಮೂದಿಸಿ ಅಥವಾ ಕ್ಯೂಆರ್ ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ 'ಕನೆಕ್ಟ್ ಹೌಸ್‌ಹೋಲ್ಡ್' ಕ್ಲಿಕ್ ಮಾಡಿ.",
    hi: "आशा कार्यकर्ता से जुड़ने के लिए: पोर्टल पर 'गेट आशा हेल्प' में जाएं, अपनी आशा कार्यकर्ता का 6 अंकों का सर्विस कोड डालें या क्यूआर कोड स्कैन करें और 'कनेक्ट हाउसहोल्ड' पर क्लिक करें।"
  },
  {
    id: "how_to_check_eligibility",
    category: "HOW_TO_WEBSITE",
    topic: "how_check_eligibility",
    keywords: [
      "how to check eligibility", "check my benefits", "patrata kaise dekhe", "arhate hege noduvudu"
    ],
    en: "To check scheme eligibility: Sign in to your Citizen Portal, update your household ration category and family members. Your dashboard will instantly evaluate and display matched schemes and benefits.",
    kn: "ಯೋಜನೆಗಳ ಅರ್ಹತೆ ತಿಳಿಯಲು: ಸಿಟಿಜನ್ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಪಡಿತರ ಚೀಟಿ ಮತ್ತು ಕುಟುಂಬದ ಸದಸ್ಯರ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ. ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತಕ್ಷಣವೇ ನೀವು ಅರ್ಹವಿರುವ ಯೋಜನೆಗಳನ್ನು ಪ್ರದರ್ಶಿಸುತ್ತದೆ.",
    hi: "पात्रता जांचने के लिए: सिटिजन पोर्टल पर अपना राशन कार्ड और पारिवारिक विवरण दर्ज करें। आपका डैशबोर्ड तुरंत पात्र योजनाओं और लाभों को प्रदर्शित कर देगा।"
  },
  {
    id: "how_to_view_next_step",
    category: "HOW_TO_WEBSITE",
    topic: "how_view_next_step",
    keywords: [
      "where can i see my next step", "how to see next step", "agla kadam kaha hai", "mundina hanta ellide"
    ],
    en: "You can see your Next Step right on the overview screen of your Citizen Portal. It highlights the single most important action needed, such as Aadhaar e-KYC or scheduling an ASHA visit.",
    kn: "ನಿಮ್ಮ ಮುಂದಿನ ಹಂತವನ್ನು ಸಿಟಿಜನ್ ಪೋರ್ಟಲ್‌ನ ಮುಖ್ಯ ಪರದೆಯಲ್ಲೇ ನೋಡಬಹುದು. ಇದು ಆಧಾರ್ ಇ-ಕೆವೈಸಿ ಅಥವಾ ಆಶಾ ಭೇಟಿಯಂತಹ ಅತ್ಯಂತ ಮುಖ್ಯವಾದ ಕಾರ್ಯವನ್ನು ಸೂಚಿಸುತ್ತದೆ.",
    hi: "आप अपना अगला कदम सिटिजन पोर्टल की मुख्य स्क्रीन पर देख सकते हैं। यह आपको आधार ई-केवाईसी या आशा भेंट जैसी जरूरी कार्रवाई के बारे में बताता है।"
  },

  // =========================================================================
  // 7. VOICE ASSISTANT BOUNDARIES & CAPABILITIES
  // =========================================================================
  {
    id: "voice_boundaries",
    category: "VOICE_CAPABILITIES",
    topic: "limits",
    keywords: [
      "can you book hospital", "can you order medicine", "can you call ambulance", "dawa mangwa do", "ambulance", "hospital booking",
      "hospital bed", "bed", "book bed", "bed booking", "दवा", "औषधि", "ಆಸ್ಪತ್ರೆ ಬೆಡ್"
    ],
    en: "SwasthyaSetu provides government scheme guidance and ASHA connection. We do not provide medicine ordering, hospital bed booking, or ambulance dispatch. For medical emergencies, please immediately dial 108 or 102.",
    kn: "ಸ್ವಾಸ್ಥ್ಯಸೇತು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ ಮಾಹಿತಿ ಮತ್ತು ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರ ಸಂಪರ್ಕವನ್ನು ಒದಗಿಸುತ್ತದೆ. ನಾವು ಔಷಧಿ ವಿತರಣೆ, ಆಸ್ಪತ್ರೆ ಬೆಡ್ ಕಾಯ್ದಿರಿಸುವಿಕೆ ಅಥವಾ ಆಂಬ್ಯುಲೆನ್ಸ್ ಸೇವೆ ನೀಡುವುದಿಲ್ಲ. ವೈದ್ಯಕೀಯ ತುರ್ತು ಸಂದರ್ಭದಲ್ಲಿ ದಯವಿಟ್ಟು ತಕ್ಷಣ 108 ಅಥವಾ 102 ಸಂಖ್ಯೆಗೆ ಕರೆ ಮಾಡಿ.",
    hi: "स्वास्थ्यसेतु सरकारी योजनाओं की जानकारी और आशा सहायता प्रदान करता है। हम दवा डिलीवरी, अस्पताल बेड बुकिंग या एम्बुलेंस सेवा नहीं देते हैं। किसी भी आपातकालीन स्थिति में कृपया तुरंत 108 या 102 पर कॉल करें।"
  },
  {
    id: "voice_general_help",
    category: "VOICE_CAPABILITIES",
    topic: "how_to_interact",
    keywords: [
      "help", "what can i ask", "kya puch sakte hain", "enu kelabahudu", "madad"
    ],
    en: "You can ask me questions such as: 'What is Ayushman Bharat?', 'What schemes can my 71 year old grandfather get?', 'How do I add a family member on the website?', or 'When is my ASHA worker visit scheduled?'.",
    kn: "ನೀವು ನನ್ನನ್ನು ಹೀಗೆ ಕೇಳಬಹುದು: 'ಆಯುಷ್ಮಾನ್ ಭಾರತ್ ಎಂದರೇನು?', 'ನನ್ನ 71 ವರ್ಷದ ತಾತನಿಗೆ ಯಾವ ಯೋಜನೆಗಳು ಸಿಗುತ್ತವೆ?', 'ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಕುಟುಂಬ ಸದಸ್ಯರನ್ನು ಸೇರಿಸುವುದು ಹೇಗೆ?', ಅಥವಾ 'ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರ ಭೇಟಿ ಯಾವಾಗ?'.",
    hi: "आप मुझसे पूछ सकते हैं: 'आयुष्मान भारत क्या है?', 'मेरे 71 साल के दादाजी को क्या लाभ मिल सकता है?', 'वेबसाइट पर परिवार के सदस्य को कैसे जोड़ें?', या 'आशा दीदी का दौरा कब है?'।"
  }
];
