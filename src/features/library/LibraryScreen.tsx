import { useMemo, useRef, useState } from "react";
import { SCORE_FILE_EXTENSIONS } from "@/library/scoreFile";
import { sortByRecent, useLibrary } from "@/library/useLibrary";
import { REPO_URL } from "@/app/links";
import { Button, IconLink } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { CaptureGuide } from "./CaptureGuide";
import { SongList } from "./SongList";
import { useFileDrop } from "./useFileDrop";
import { useImport } from "./useImport";
import styles from "./LibraryScreen.module.css";

const ACCEPTED_FILES = [".har", "application/json", ...SCORE_FILE_EXTENSIONS].join(",");

export function LibraryScreen() {
  const songs = useLibrary((s) => s.songs);
  const remove = useLibrary((s) => s.remove);
  const { status, run, dismiss } = useImport();
  const dragging = useFileDrop(run);
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const sorted = useMemo(() => sortByRecent(songs), [songs]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q)) : sorted;
  }, [sorted, query]);
  const isEmpty = sorted.length === 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logo} src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={30} height={30} />
          Tab Trainer
        </div>
        <div className={styles.actions}>
          {!isEmpty && (
            <Button variant="ghost" onClick={() => setShowGuide((v) => !v)}>
              {showGuide ? "Hide guide" : "Saving from Songsterr"}
            </Button>
          )}
          <Button variant="primary" icon="upload" onClick={() => fileInput.current?.click()}>
            Import
          </Button>
          <IconLink icon="github" label="Source code on GitHub" href={REPO_URL} />
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_FILES}
            multiple
            hidden
            onChange={(e) => {
              void run([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {status.kind !== "idle" && (
        <div className={styles.status} data-kind={status.kind} role="status">
          <span>{status.kind === "working" ? "Importing…" : status.message}</span>
          {status.kind !== "working" && (
            <button type="button" className={styles.statusClose} onClick={dismiss} aria-label="Dismiss">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      )}

      <main className={styles.main}>
        {isEmpty ? (
          <section className={styles.empty}>
            <h1 className={styles.headline}>Add your first song</h1>
            <p className={styles.lede}>
              Drop a song saved from Songsterr, a Guitar Pro file or a MusicXML file anywhere on this page. Everything
              stays on this computer.
            </p>
            <button type="button" className={styles.dropzone} onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={22} />
              Drop files here or click to choose them
            </button>
            <h2 className={styles.guideTitle}>Saving a song from Songsterr</h2>
            <CaptureGuide />
          </section>
        ) : (
          <>
            {showGuide && (
              <section className={styles.guidePanel}>
                <CaptureGuide />
              </section>
            )}
            <div className={styles.toolbar}>
              <h1 className={styles.sectionTitle}>Your songs</h1>
              <label className={styles.search}>
                <Icon name="search" size={16} />
                <input
                  type="search"
                  placeholder="Search songs or artists"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            {visible.length > 0 ? (
              <SongList songs={visible} onRemove={(song) => void remove(song.id)} />
            ) : (
              <p className={styles.noResults}>No songs match "{query}".</p>
            )}
          </>
        )}
      </main>

      {dragging && (
        <div className={styles.dropOverlay}>
          <Icon name="upload" size={28} />
          Drop to import
        </div>
      )}
    </div>
  );
}
