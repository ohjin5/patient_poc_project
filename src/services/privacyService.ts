import { PrivacyDetectionResult } from "../types";

export class PrivacyService {
  // Regex patterns for sensitive Korean hospital PII
  private static RRN_PATTERN = /\b\d{6}[-\s]?[1-4]\d{6}\b/g;
  private static PHONE_PATTERN = /\b(01[016789]|02|0[3-6][1-5])[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g;
  private static PATIENT_NO_PATTERN = /\b(?:등록번호|환자번호|차트번호|등록No|ID)[:\s]*([A-Z0-9]{6,12})\b/gi;
  private static EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  private static NAME_WITH_TITLE_PATTERN = /\b([가-힣]{2,4})\s*(?:환자|님|선생|보호자|어르신)\b/g;
  private static PATIENT_NAME_PREFIX_PATTERN = /\b(?:환자명|환자분|보호자명)[:\s]*([가-힣]{2,4})\b/g;

  /**
   * Scans text, detects any hospital PII, and sanitizes/masks the sensitive content
   */
  public static sanitize(text: string): PrivacyDetectionResult {
    if (!text || typeof text !== "string") {
      return {
        hasPrivacyInfo: false,
        detectedTypes: [],
        sanitizedText: text || "",
        matchedTokens: [],
      };
    }

    const detectedTypes = new Set<"NAME" | "PHONE" | "RRN" | "PATIENT_ID" | "EMAIL">();
    const matchedTokens: string[] = [];
    let sanitized = text;

    // 1. Resident Registration Numbers (RRN / 주민번호)
    if (this.RRN_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(this.RRN_PATTERN, (match) => {
        detectedTypes.add("RRN");
        matchedTokens.push(match);
        return "[주민번호 비식별화]";
      });
    }

    // 2. Phone Numbers (전화번호)
    if (this.PHONE_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(this.PHONE_PATTERN, (match) => {
        detectedTypes.add("PHONE");
        matchedTokens.push(match);
        return "[연락처 마스킹]";
      });
    }

    // 3. Email addresses
    if (this.EMAIL_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(this.EMAIL_PATTERN, (match) => {
        detectedTypes.add("EMAIL");
        matchedTokens.push(match);
        return "[이메일 마스킹]";
      });
    }

    // 4. Patient Registration Numbers (등록번호/차트번호)
    if (this.PATIENT_NO_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(this.PATIENT_NO_PATTERN, (match, p1) => {
        detectedTypes.add("PATIENT_ID");
        matchedTokens.push(p1 || match);
        return "등록번호 [마스킹]";
      });
    }

    // 5. Patient Names with Context Prefix
    if (this.PATIENT_NAME_PREFIX_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(this.PATIENT_NAME_PREFIX_PATTERN, (match, name) => {
        detectedTypes.add("NAME");
        matchedTokens.push(name);
        return "환자 [이름 마스킹]";
      });
    }

    // 6. Name with Title (e.g. "김철수 환자", "이영희 님")
    if (this.NAME_WITH_TITLE_PATTERN.test(sanitized)) {
      sanitized = sanitized.replace(this.NAME_WITH_TITLE_PATTERN, (match, name) => {
        // filter out common non-name words
        const excludeList = ["우리", "모든", "담당", "해당", "옆자리", "맞은편", "다른", "같은", "어떤"];
        if (excludeList.includes(name)) return match;
        
        detectedTypes.add("NAME");
        matchedTokens.push(name);
        const maskedName = name.length === 2 ? `${name[0]}*` : `${name[0]}*${name.slice(2)}`;
        return `${maskedName} 님`;
      });
    }

    return {
      hasPrivacyInfo: detectedTypes.size > 0,
      detectedTypes: Array.from(detectedTypes),
      sanitizedText: sanitized,
      matchedTokens,
    };
  }

  /**
   * Batch sanitization for an array of VOC items
   */
  public static sanitizeVocList<T extends { content: string; patientIdMasked?: string }>(items: T[]): {
    sanitizedItems: T[];
    totalPrivacyDetected: number;
  } {
    let totalPrivacyDetected = 0;

    const sanitizedItems = items.map((item) => {
      const result = this.sanitize(item.content);
      if (result.hasPrivacyInfo) {
        totalPrivacyDetected++;
      }
      return {
        ...item,
        originalContent: item.content,
        content: result.sanitizedText,
        hadPrivacyData: result.hasPrivacyInfo,
        patientIdMasked: item.patientIdMasked || (result.hasPrivacyInfo ? "P-MASKED" : undefined),
      };
    });

    return {
      sanitizedItems,
      totalPrivacyDetected,
    };
  }
}
