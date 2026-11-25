import { useCallback, useState } from "react";
import type { ImportOutcome } from "@/library/importSongs";
import { useLibrary } from "@/library/useLibrary";

export type ImportStatus =
  { kind: "idle" } | { kind: "working" } | { kind: "done"; message: string } | { kind: "error"; message: string };

const songCount = (n: number) => (n === 1 ? "1 song" : `${n} songs`);

function describe(outcome: ImportOutcome): string {
  const parts: string[] = [];
  const added = outcome.songs.length - outcome.restored;
  if (added === 1 && outcome.restored === 0) parts.push(`Added ${outcome.songs[0]!.title}.`);
  else if (added > 0) parts.push(`Added ${songCount(added)}.`);
  if (outcome.restored > 0) parts.push(`Restored ${songCount(outcome.restored)} from the backup.`);
  if (outcome.alreadyHad > 0) {
    const noun = outcome.alreadyHad === 1 ? "song was" : "songs were";
    parts.push(
      outcome.restored > 0
        ? `${outcome.alreadyHad} ${noun} already in your library and left as they are.`
        : `Every song in the backup is already in your library.`,
    );
  }
  if (outcome.errors.length > 0 && parts.length > 0) parts.push(`${outcome.errors.length} file(s) had no tabs.`);
  return parts.join(" ");
}

/** Imports Songsterr captures, score files and backups, and reports the result in plain language. */
export function useImport() {
  const importFiles = useLibrary((s) => s.importFiles);
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle" });

  const run = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      setStatus({ kind: "working" });
      const outcome = await importFiles(files);
      const message = describe(outcome);
      if (message) setStatus({ kind: "done", message });
      else if (outcome.errors[0]) setStatus({ kind: "error", message: outcome.errors[0].message });
      else setStatus({ kind: "idle" });
    },
    [importFiles],
  );

  const notify = useCallback((message: string) => setStatus({ kind: "done", message }), []);
  const dismiss = useCallback(() => setStatus({ kind: "idle" }), []);
  return { status, run, notify, dismiss };
}
