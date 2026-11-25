import { useState } from "react";
import { formatPercent } from "@/lib/format";
import { sameRange } from "@/player/engine/PlayerEngine";
import { sectionBarRange } from "@/player/engine/scoreQueries";
import { SPEED_RANGE } from "@/practice/practiceSettings";
import { Button, IconButton } from "@/ui/Button";
import { LedSwitch } from "@/ui/LedSwitch";
import { MenuHeading, MenuItem, Popover } from "@/ui/Popover";
import { Stepper } from "@/ui/Stepper";
import { useEngine, useEngineState, useSetting } from "../engineContext";
import styles from "./dock.module.css";

type BarSpan = { start: number; end: number };

function barsLabel(bars: BarSpan): string {
  return bars.start === bars.end ? `Bar ${bars.start + 1}` : `Bars ${bars.start + 1}–${bars.end + 1}`;
}

function loopDescription(bars: BarSpan | null): string {
  return bars ? barsLabel(bars) : "Whole song";
}

export function LoopControls() {
  const engine = useEngine();
  const loopEnabled = useSetting("loopEnabled");
  const loopBars = useEngineState((s) => s.loopBars);

  return (
    <div className={styles.group}>
      <div className={styles.stack}>
        <LedSwitch label="Loop" tone="teal" on={loopEnabled} onChange={(on) => engine.setLoopEnabled(on)} />
        <span className={styles.caption} title="Drag across the tab to choose a loop">
          {loopDescription(loopBars)}
        </span>
      </div>
      <SavedLoopsMenu />
      <SectionMenu />
      <TrainerMenu />
    </div>
  );
}

/** A name for the current loop: its section's, when it covers exactly one section. */
function useSuggestedLoopName(): string {
  const sections = useEngineState((s) => s.sections);
  const barCount = useEngineState((s) => s.barCount);
  const loopBars = useEngineState((s) => s.loopBars);
  if (!loopBars) return "";
  const exact = sections.findIndex((_, i) => {
    const range = sectionBarRange(sections, i, barCount);
    return range?.startBar === loopBars.start && range.endBar === loopBars.end;
  });
  return exact >= 0 ? sections[exact]!.title : barsLabel(loopBars);
}

function SavedLoopsMenu() {
  return (
    <Popover
      placement="above"
      className={styles.savedLoopsPanel}
      trigger={({ toggle }) => <IconButton icon="bookmark" label="Saved loops" onClick={toggle} />}
    >
      {(close) => <SavedLoopsPanel close={close} />}
    </Popover>
  );
}

function SavedLoopsPanel({ close }: { close: () => void }) {
  const engine = useEngine();
  const savedLoops = useSetting("savedLoops");
  const loopRange = useSetting("loopRange");
  const loopEnabled = useSetting("loopEnabled");
  const suggested = useSuggestedLoopName();
  const [name, setName] = useState("");
  const loopBars = useEngineState((s) => s.loopBars);
  const canSave = loopRange !== null && loopBars !== null;

  const save = () => {
    if (!canSave) return;
    engine.saveLoop(name.trim() || suggested);
    setName("");
  };

  return (
    <>
      <MenuHeading>Saved loops</MenuHeading>
      {savedLoops.length === 0 && (
        <p className={styles.savedLoopsEmpty}>Save loops you practice often, then come back to them with one click.</p>
      )}
      {savedLoops.map((loop) => (
        <MenuItem
          key={loop.id}
          selected={loopEnabled && sameRange(loop.range, loopRange)}
          hint={loop.name === barsLabel(loop.bars) ? undefined : barsLabel(loop.bars)}
          onSelect={() => {
            engine.playSavedLoop(loop.id);
            close();
          }}
          action={
            <IconButton
              icon="trash"
              label={`Delete ${loop.name}`}
              className={styles.sectionLoop}
              onClick={() => engine.deleteSavedLoop(loop.id)}
            />
          }
        >
          {loop.name}
        </MenuItem>
      ))}
      <form
        className={styles.saveLoop}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          className={styles.saveLoopName}
          value={name}
          maxLength={60}
          disabled={!canSave}
          placeholder={canSave ? suggested : "Select a loop on the tab first"}
          aria-label="Name for the current loop"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && close()}
        />
        <Button type="submit" variant="secondary" disabled={!canSave}>
          Save loop
        </Button>
      </form>
    </>
  );
}

function SectionMenu() {
  const engine = useEngine();
  const sections = useEngineState((s) => s.sections);
  const barCount = useEngineState((s) => s.barCount);
  const currentBar = useEngineState((s) => s.currentBar);
  const loopBars = useEngineState((s) => s.loopBars);
  const loopEnabled = useSetting("loopEnabled");

  return (
    <Popover
      placement="above"
      trigger={({ toggle }) => (
        <Button
          variant="ghost"
          icon="sections"
          aria-label="Sections"
          title={sections.length ? "Sections" : "This song has no sections"}
          disabled={sections.length === 0}
          onClick={toggle}
        >
          <span className={styles.collapsibleLabel}>Sections</span>
        </Button>
      )}
    >
      {(close) => {
        const pick = (action: () => void) => () => {
          action();
          close();
        };
        return (
          <>
            {sections.map((section, i) => {
              const range = sectionBarRange(sections, i, barCount)!;
              const current = currentBar >= range.startBar && currentBar <= range.endBar;
              const looped = loopEnabled && loopBars?.start === range.startBar && loopBars.end === range.endBar;
              return (
                <MenuItem
                  key={section.barIndex}
                  selected={current}
                  hint={`Bar ${section.barIndex + 1}`}
                  onSelect={pick(() => engine.goToSection(i))}
                  action={
                    <IconButton
                      icon="loop"
                      label={`Loop ${section.title}`}
                      active={looped}
                      className={styles.sectionLoop}
                      onClick={pick(() => engine.loopSection(i))}
                    />
                  }
                >
                  {section.title}
                </MenuItem>
              );
            })}
          </>
        );
      }}
    </Popover>
  );
}

function TrainerMenu() {
  const engine = useEngine();
  const trainer = useSetting("trainer");
  const passes = useEngineState((s) => s.trainerPasses);

  const setEnabled = (enabled: boolean) => {
    engine.setTrainer({ enabled });
    if (enabled) engine.setLoopEnabled(true);
  };

  return (
    <div className={styles.group}>
      <div className={styles.stack}>
        <LedSwitch
          label="Trainer"
          on={trainer.enabled}
          onChange={setEnabled}
          title="Speed up a little after each pass"
        />
        <span className={styles.caption}>
          {trainer.enabled
            ? `Pass ${passes + 1} of ${trainer.passesPerStep}`
            : `Up to ${formatPercent(trainer.target)}`}
        </span>
      </div>
      <Popover
        placement="above"
        className={styles.trainerPanel}
        trigger={({ toggle }) => <IconButton icon="sliders" label="Trainer settings" onClick={toggle} />}
      >
        {() => <TrainerSettingsPanel />}
      </Popover>
    </div>
  );
}

function TrainerSettingsPanel() {
  const engine = useEngine();
  const trainer = useSetting("trainer");

  return (
    <>
      <p className={styles.trainerIntro}>
        Raises the speed after every few passes through the loop, until it reaches the target.
      </p>
      <Stepper
        label="Speed up by"
        value={trainer.step}
        min={0.01}
        max={0.25}
        step={0.01}
        format={formatPercent}
        onChange={(step) => engine.setTrainer({ step })}
      />
      <Stepper
        label="Stop at"
        value={trainer.target}
        min={SPEED_RANGE.min}
        max={SPEED_RANGE.max}
        step={SPEED_RANGE.step}
        format={formatPercent}
        onChange={(target) => engine.setTrainer({ target })}
      />
      <Stepper
        label="Passes per step"
        value={trainer.passesPerStep}
        min={1}
        max={10}
        step={1}
        format={String}
        onChange={(passesPerStep) => engine.setTrainer({ passesPerStep })}
      />
    </>
  );
}
