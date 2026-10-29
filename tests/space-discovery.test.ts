import { describe, expect, it } from "vitest";
import { services } from "../src/data/catalog";
import { comparisonSpaces, matchingSpaces } from "../src/lib/space-discovery";

describe("space discovery", () => {
  it("excludes ancillary services and retains unapproved spaces for enquiries", () => {
    const found = matchingSpaces(services, {});
    expect(found.some((s) => s.id === "svc-enigma-hot-desk")).toBe(true);
    expect(found.some((s) => s.id === "svc-enigma-printing")).toBe(false);
    expect(found.some((s) => s.id === "svc-enigma-locker")).toBe(false);
  });
  it("combines purpose, venue and listed capacity", () => {
    expect(
      matchingSpaces(services, { purpose: "recording", venue: "studio-d", people: 4 }).map(
        (s) => s.id,
      ),
    ).toEqual(["svc-studio-recording-booth", "svc-studio-podcast"]);
    expect(matchingSpaces(services, { purpose: "workspace", people: 20 })).toEqual([]);
  });
  it("deduplicates comparison and rejects unknown/non-space IDs with a three-space limit", () => {
    const chosen = comparisonSpaces(
      services,
      "bad,svc-enigma-printing,svc-enigma-meeting,svc-enigma-meeting,svc-enigma-desk,svc-studio-rental,svc-studio-podcast",
    );
    expect(chosen.map((s) => s.id)).toEqual([
      "svc-enigma-meeting",
      "svc-enigma-desk",
      "svc-studio-rental",
    ]);
  });
});
