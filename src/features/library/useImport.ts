import { useCallback, useState } from "react";
import { useLibrary } from "@/library/useLibrary";

export type ImportStatus =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

function describe(titles: string[]): string {
  if (titles.length === 1) return `Added ${titles[0]}.`;
  return `Added ${titles.length} songs.`;
}

/** Imports HAR files into the library and reports the result in plain language. */
export function useImport() {
  const importFiles = useLibrary((s) => s.importFiles);
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle" });

  const run = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      setStatus({ kind: "working" });
      const outcome = await importFiles(files);
      const firstError = outcome.errors[0];

      if (outcome.songs.length > 0) {
        const suffix = firstError ? ` ${outcome.errors.length} file(s) had no tabs.` : "";
        setStatus({ kind: "done", message: describe(outcome.songs.map((s) => s.title)) + suffix });
      } else if (firstError) {
        setStatus({ kind: "error", message: firstError.message });
      }
    },
    [importFiles],
  );

  const dismiss = useCallback(() => setStatus({ kind: "idle" }), []);
  return { status, run, dismiss };
}
