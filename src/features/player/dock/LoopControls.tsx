import { formatPercent } from "@/lib/format";
import { sectionBarRange } from "@/player/engine/scoreQueries";
import { SPEED_RANGE } from "@/practice/practiceSettings";
import { Button, IconButton } from "@/ui/Button";
import { LedSwitch } from "@/ui/LedSwitch";
import { MenuHeading, MenuItem, Popover } from "@/ui/Popover";
import { Stepper } from "@/ui/Stepper";
import { useEngine, useEngineState, useSetting } from "../engineContext";
import styles from "./dock.module.css";

function loopDescription(bars: { start: number; end: number } | null): string {
  if (!bars) return "Whole song";
  return bars.start === bars.end ? `Bar ${bars.start + 1}` : `Bars ${bars.start + 1}–${bars.end + 1}`;
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
      <SectionMenu />
      <TrainerMenu />
    </div>
  );
}

function SectionMenu() {
  const engine = useEngine();
  const sections = useEngineState((s) => s.sections);
  const barCount = useEngineState((s) => s.barCount);
  const currentBar = useEngineState((s) => s.currentBar);
  const loopBars = useEngineState((s) => s.loopBars);
  const loopEnabled = useSetting("loopEnabled");
  const hasLoop = loopBars !== null;

  return (
    <Popover
      placement="above"
      trigger={({ toggle }) => (
        <Button variant="ghost" icon="sections" onClick={toggle}>
          Sections
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
            <MenuItem onSelect={pick(() => engine.loopCurrentBar())}>Loop the current bar</MenuItem>
            <MenuItem disabled={!hasLoop} onSelect={pick(() => engine.clearLoop())}>
              Clear loop
            </MenuItem>
            {sections.length > 0 && <MenuHeading>Go to a section</MenuHeading>}
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
