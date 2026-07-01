import { Injectable } from "@nestjs/common";

export type AssistantIntent =
  | { type: "WHO_HASNT_SERVED"; weeks: number }
  | { type: "WHO_CAN_REPLACE"; name: string }
  | { type: "WHO_NEEDS_TRAINING" }
  | { type: "PREDICT_SHORTAGES" }
  | { type: "UNKNOWN" };

/**
 * docs/02-architecture.md §6: the assistant maps a question to one of a
 * fixed library of safe, parameterized query templates — never freeform SQL
 * generation. The architecture doc envisions an LLM doing that mapping; this
 * sandbox has no LLM API key configured (no Anthropic/OpenAI account to
 * wire in), so intent classification here is keyword/regex matching
 * instead. The safety property that matters — a bounded set of pre-written,
 * parameterized queries, never model-generated SQL — is real either way;
 * swapping this classifier for an LLM-backed one later is additive (see
 * serveflow/README.md).
 */
@Injectable()
export class IntentClassifierService {
  classify(question: string): AssistantIntent {
    const q = question.toLowerCase().trim();

    const replaceMatch = q.match(/replace\s+([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*)?)/i);
    if (replaceMatch) {
      return { type: "WHO_CAN_REPLACE", name: replaceMatch[1].trim() };
    }

    if (/hasn'?t served|haven'?t served|not served|who.*served recently|inactive volunteers/i.test(q)) {
      const weeksMatch = q.match(/(\d+)\s*week/);
      return { type: "WHO_HASNT_SERVED", weeks: weeksMatch ? Number(weeksMatch[1]) : 6 };
    }

    if (/need(s)? training|training.*need|missing training|untrained/i.test(q)) {
      return { type: "WHO_NEEDS_TRAINING" };
    }

    if (/shortage|predict|coverage.*upcoming|understaffed|will.*short/i.test(q)) {
      return { type: "PREDICT_SHORTAGES" };
    }

    return { type: "UNKNOWN" };
  }
}
