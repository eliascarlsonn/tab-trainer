import { useEffect, useMemo, useRef, useState } from "react";
import { backupFileName } from "@/library/backup";
import { SONG_ORDERS, sortSongs, type SongOrder } from "@/library/librarySort";
import { SCORE_FILE_EXTENSIONS } from "@/library/scoreFile";
import { useLibrary } from "@/library/useLibrary";
import { REPO_URL } from "@/app/links";
import { cx } from "@/lib/cx";
import { Button, IconLink } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { MenuItem, Popover } from "@/ui/Popover";
import { CaptureGuide } from "./CaptureGuide";
import { useLibraryView } from "./libraryView";
import { SongList } from "./SongList";
import { useFileDrop } from "./useFileDrop";
import { useImport } from "./useImport";
import { useUndoRemove } from "./useUndoRemove";
import styles from "./LibraryScreen.module.css";

const ACCEPTED_FILES = [".har", "application/json", ...SCORE_FILE_EXTENSIONS].join(",");

export function LibraryScreen() {
  const songs = useLibrary((s) => s.songs);
  const setFavorite = useLibrary((s) => s.setFavorite);
  const backup = useLibrary((s) => s.backup);
  const { status, run, notify, dismiss } = useImport();
  const dragging = useFileDrop(run);
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [view, updateView] = useLibraryView();
  const removal = useUndoRemove();

  const all = useMemo(() => Object.values(songs), [songs]);
  const favoriteCount = all.filter((s) => s.favorite).length;
  // With no favorites left, the filter would hide everything; it switches itself off.
  const favoritesOnly = view.favoritesOnly && favoriteCount > 0;
  useEffect(() => {
    if (view.favoritesOnly && favoriteCount === 0) updateView({ favoritesOnly: false });
  }, [view.favoritesOnly, favoriteCount, updateView]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = all.filter(
      (s) => (!favoritesOnly || s.favorite) && (!q || `${s.title} ${s.artist}`.toLowerCase().includes(q)),
    );
    return sortSongs(shown, view.order);
  }, [all, query, favoritesOnly, view.order]);
  const isEmpty = all.length === 0;

  const downloadBackup = async () => {
    const blob = new Blob([await backup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const count = all.length === 1 ? "your song" : `all ${all.length} songs`;
    notify(`Saved a backup of ${count}. To restore it, import the file or drop it here.`);
  };

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
          {!isEmpty && (
            <Button
              variant="ghost"
              icon="download"
              title="Download your songs and practice settings as one file"
              onClick={() => void downloadBackup()}
            >
              Back up
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
              <h1 className={styles.sectionTitle}>{favoritesOnly ? "Favorites" : "Your songs"}</h1>
              <div className={styles.tools}>
                <Button
                  variant="ghost"
                  icon={favoritesOnly ? "starFilled" : "star"}
                  aria-pressed={favoritesOnly}
                  disabled={favoriteCount === 0}
                  title={favoriteCount === 0 ? "Star a song to add it to your favorites" : undefined}
                  className={cx(favoritesOnly && styles.toolOn)}
                  onClick={() => updateView({ favoritesOnly: !favoritesOnly })}
                >
                  Favorites
                </Button>
                <SortMenu order={view.order} onChange={(order) => updateView({ order })} />
              </div>
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
              <SongList
                songs={visible}
                order={view.order}
                onFavorite={(song, favorite) => void setFavorite(song.id, favorite)}
                onRemove={(song) => void removal.remove(song)}
              />
            ) : (
              <p className={styles.noResults}>No songs match "{query}".</p>
            )}
          </>
        )}
      </main>

      {removal.removed && (
        <div className={styles.toast} role="status">
          <span className={styles.toastText}>Removed {removal.removed.title}</span>
          <button type="button" className={styles.toastAction} onClick={() => void removal.undo()}>
            Undo
          </button>
        </div>
      )}

      {dragging && (
        <div className={styles.dropOverlay}>
          <Icon name="upload" size={28} />
          Drop to import
        </div>
      )}
    </div>
  );
}

function SortMenu({ order, onChange }: { order: SongOrder; onChange: (order: SongOrder) => void }) {
  const current = SONG_ORDERS.find((o) => o.id === order)!;
  return (
    <Popover
      align="end"
      trigger={({ toggle }) => (
        <Button variant="ghost" icon="sort" aria-label={`Sort by: ${current.label}`} onClick={toggle}>
          {current.label}
        </Button>
      )}
    >
      {(close) =>
        SONG_ORDERS.map((o) => (
          <MenuItem
            key={o.id}
            selected={o.id === order}
            onSelect={() => {
              onChange(o.id);
              close();
            }}
          >
            {o.label}
          </MenuItem>
        ))
      }
    </Popover>
  );
}
