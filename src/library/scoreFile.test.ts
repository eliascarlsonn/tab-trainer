import { exporter, importer, Settings } from "@coderline/alphatab";
import { describe, expect, it } from "vitest";
import { songFromScoreFile, UnreadableScoreError } from "./scoreFile";

const TEX = String.raw`
\title "Test Song"
\artist "Test Band"
\track "Lead Guitar"
  \instrument 29
  3.3.4 5.3.4 7.3.4 8.3.4
\track "Bass"
  \instrument 33
  \tuning E1 A1 D2 G2
  3.4.2 5.4.2
\track "Drums"
  \instrument percussion
  \articulation defaults
  KickHit.4 SnareHit.4 KickHit.4 SnareHit.4
`;

function guitarProFile(name = "song.gp"): File {
  const tex = new importer.AlphaTexImporter();
  tex.initFromString(TEX, new Settings());
  const bytes = new exporter.Gp7Exporter().export(tex.readScore());
  return new File([bytes as BlobPart], name);
}

const MUSIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

describe("songFromScoreFile", () => {
  it("reads title, artist and tracks from a Guitar Pro file", async () => {
    const song = await songFromScoreFile(guitarProFile());
    expect(song).toMatchObject({ origin: "file", fileName: "song.gp", title: "Test Song", artist: "Test Band" });
    expect(song.catalog.map(({ partId, name, role }) => ({ partId, name, role }))).toEqual([
      { partId: 0, name: "Lead Guitar", role: "guitar" },
      { partId: 1, name: "Bass", role: "bass" },
      { partId: 2, name: "Drums", role: "drums" },
    ]);
    expect(song.catalog.every((t) => t.captured)).toBe(true);
  });

  it("gives the same file the same id, whatever it is called", async () => {
    const a = await songFromScoreFile(guitarProFile("a.gp"));
    const b = await songFromScoreFile(guitarProFile("b.gp"));
    expect(a.id).toMatch(/^file-[0-9a-f]{16}$/);
    expect(b.id).toBe(a.id);
  });

  it("reads MusicXML and names untitled songs after the file", async () => {
    const song = await songFromScoreFile(new File([MUSIC_XML], "Etude in C.musicxml"));
    expect(song.title).toBe("Etude in C");
    expect(song.catalog).toMatchObject([{ partId: 0, name: "Piano", instrument: "Piano", role: "other" }]);
  });

  it("rejects files that are not scores", async () => {
    await expect(songFromScoreFile(new File(["hello"], "notes.gp"))).rejects.toBeInstanceOf(UnreadableScoreError);
  });
});
