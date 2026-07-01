import { describe, expect, it } from "vitest";
import { IntentClassifierService } from "../../src/modules/assistant/intent-classifier.service";

describe("IntentClassifierService", () => {
  const classifier = new IntentClassifierService();

  it("classifies 'who hasn't served recently' with a default 6-week window", () => {
    const intent = classifier.classify("Who hasn't served recently?");
    expect(intent).toEqual({ type: "WHO_HASNT_SERVED", weeks: 6 });
  });

  it("extracts a custom week count when specified", () => {
    const intent = classifier.classify("Show me volunteers who haven't served in 3 weeks");
    expect(intent).toEqual({ type: "WHO_HASNT_SERVED", weeks: 3 });
  });

  it("extracts a name from 'who can replace <name>'", () => {
    const intent = classifier.classify("Who can replace David?");
    expect(intent).toEqual({ type: "WHO_CAN_REPLACE", name: "david" });
  });

  it("classifies training questions", () => {
    expect(classifier.classify("Which volunteers need training?")).toEqual({ type: "WHO_NEEDS_TRAINING" });
  });

  it("classifies shortage-prediction questions", () => {
    expect(classifier.classify("Predict volunteer shortages")).toEqual({ type: "PREDICT_SHORTAGES" });
  });

  it("falls back to UNKNOWN for unrecognized questions", () => {
    expect(classifier.classify("What's the weather like?")).toEqual({ type: "UNKNOWN" });
  });
});
