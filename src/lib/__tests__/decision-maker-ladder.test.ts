import { describe, expect, it } from "vitest";
import {
  decisionMakerRank,
  matchDecisionMakerRung,
  selectBestDecisionMaker,
  UNRANKED_DECISION_MAKER,
} from "@/lib/contact-discovery/decision-maker-ladder";

function person(fullName: string, title: string) {
  return { fullName, title };
}

describe("decision-maker ladder", () => {
  it("ranks the priority list in the specified order", () => {
    const order = [
      ["Co-Founder", 1],
      ["Founder", 1],
      ["CEO", 2],
      ["Managing Partner", 3],
      ["General Partner", 4],
      ["Partner", 5],
      ["CTO", 6],
      ["Head of Engineering", 7],
      ["VP Engineering", 8],
      ["Director", 9],
      ["President", 10],
    ] as const;

    for (const [title, rank] of order) {
      expect(decisionMakerRank(title), title).toBe(rank);
    }
  });

  it("ranks VC partner roles above CTO and Director", () => {
    // Regression: Managing Partner used to score a flat 50, below General Manager (72)
    // and Director (76) — at a fund the real decision maker sorted under a manager.
    expect(decisionMakerRank("Managing Partner")).toBeLessThan(decisionMakerRank("CTO"));
    expect(decisionMakerRank("General Partner")).toBeLessThan(decisionMakerRank("Director"));
    expect(decisionMakerRank("Partner")).toBeLessThan(decisionMakerRank("General Manager"));
  });

  it("ranks Founder above CEO", () => {
    expect(decisionMakerRank("Founder")).toBeLessThan(decisionMakerRank("CEO"));
  });

  it("does not rank non-decision-makers", () => {
    for (const title of ["Software Engineer", "Registered Nurse", "Team Member", "Office Manager"]) {
      expect(decisionMakerRank(title), title).toBe(UNRANKED_DECISION_MAKER);
    }
    expect(matchDecisionMakerRung("")).toBeNull();
    expect(matchDecisionMakerRung(null)).toBeNull();
  });
});

describe("selectBestDecisionMaker", () => {
  it("picks the founder over everyone else and says so", () => {
    const selection = selectBestDecisionMaker(
      [person("Dana Lee", "CTO"), person("Ann Roy", "Co-Founder"), person("Bo Fox", "Director")],
      { companyName: "Acme" }
    );

    expect(selection?.contact.fullName).toBe("Ann Roy");
    expect(selection?.rank).toBe(1);
    expect(selection?.reason).toContain("top of the decision-maker priority list");
    expect(selection?.reason).toContain("Acme");
  });

  it("falls to the next best role and records what was missing", () => {
    const selection = selectBestDecisionMaker(
      [person("Dana Lee", "CTO"), person("Bo Fox", "Director")],
      { companyName: "Acme" }
    );

    expect(selection?.contact.fullName).toBe("Dana Lee");
    expect(selection?.label).toBe("CTO");
    expect(selection?.reason).toContain("no Founder / Co-Founder, CEO");
  });

  it("picks the Managing Partner at a fund", () => {
    const selection = selectBestDecisionMaker(
      [person("Ida Vance", "Partner"), person("Ray Kim", "Managing Partner"), person("Sue Ott", "CTO")],
      { companyName: "Sequoia Capital" }
    );

    expect(selection?.contact.fullName).toBe("Ray Kim");
    expect(selection?.label).toBe("Managing Partner");
  });

  it("returns null when nobody is a decision maker", () => {
    expect(selectBestDecisionMaker([person("Jo Ray", "Software Engineer")])).toBeNull();
    expect(selectBestDecisionMaker([])).toBeNull();
  });
});
