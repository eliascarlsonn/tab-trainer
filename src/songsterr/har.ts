/** Minimal reader for the HTTP Archive (HAR 1.2) format produced by browser DevTools. */

interface HarContent {
  mimeType?: string;
  text?: string;
  encoding?: string;
}

interface HarEntry {
  request: { url: string };
  response: { status: number; content?: HarContent };
}

export interface HarResponse {
  url: string;
  mimeType: string;
  body: string;
}

export class HarFormatError extends Error {}

const utf8 = new TextDecoder();

function decodeBase64(text: string): string {
  const binary = atob(text);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return utf8.decode(bytes);
}

function decodeBody(content: HarContent): string {
  if (!content.text) return "";
  return content.encoding === "base64" ? decodeBase64(content.text) : content.text;
}

function isHarEntryList(value: unknown): value is HarEntry[] {
  return Array.isArray(value);
}

/** Successful responses that carry a body, in capture order. */
export function readHarResponses(har: unknown): HarResponse[] {
  const entries = (har as { log?: { entries?: unknown } } | null)?.log?.entries;
  if (!isHarEntryList(entries)) {
    throw new HarFormatError("This file is not a HAR capture.");
  }

  return entries.flatMap((entry) => {
    const content = entry.response?.content;
    if (entry.response?.status !== 200 || !content) return [];
    const body = decodeBody(content);
    return body ? [{ url: entry.request.url, mimeType: content.mimeType ?? "", body }] : [];
  });
}

export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
