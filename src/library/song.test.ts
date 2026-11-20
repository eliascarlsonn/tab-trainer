import { describe, expect, it } from "vitest";
import { splitTrackName } from "./song";

describe("splitTrackName", () => {
  it.each([
    ['Kirk Hammett | Fender Fernandes Stratocaster "Edna" | Lead Guitar', "Lead Guitar", "Kirk Hammett"],
    ["James Hetfield | Lead Vocals | Shure SM-57", "Lead Vocals", "James Hetfield"],
    ["James Hetfield | Delay", "Delay", "James Hetfield"],
    ["Lars Ulrich | Tama Superstar Birch Kit | Drums", "Drums", "Lars Ulrich"],
    ["Cliff Burton | Aria Pro II SB1000 | Bass", "Bass", "Cliff Burton"],
  ])("finds the part in %s", (name, part, musician) => {
    expect(splitTrackName(name)).toEqual({ part, musician });
  });

  it("keeps names without segments as they are", () => {
    expect(splitTrackName("Guitar")).toEqual({ part: "Guitar", musician: undefined });
  });
});
