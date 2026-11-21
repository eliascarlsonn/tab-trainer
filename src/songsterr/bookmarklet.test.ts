import { describe, expect, it } from "vitest";
import { bookmarkletHref } from "./bookmarklet";

describe("bookmarkletHref", () => {
  const href = bookmarkletHref("http://localhost:5174/");
  const code = decodeURIComponent(href.slice("javascript:".length));

  it("is a javascript: URL that parses as code", () => {
    expect(href.startsWith("javascript:")).toBe(true);
    expect(() => new Function(code)).not.toThrow();
  });

  it("sends songs to the app address it was made for", () => {
    expect(code).toContain('"http://localhost:5174/"');
  });

  it("evaluates to undefined, so clicking it doesn't replace the Songsterr page", () => {
    expect(code.startsWith("void ")).toBe(true);
  });
});
