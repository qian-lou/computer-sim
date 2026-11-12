import { useState } from 'react';
import { EditorPanel, InstructionList } from './components/EditorPanel';
import { FlatMachine } from './components/MachineView';
import { Toolbar } from './components/Toolbar';
import { ArchitectureScene } from './components/scene/ArchitectureScene';
import { animationMs, useSimulator } from './useSimulator';

type Sheet = 'none' | 'editor' | 'isa' | 'flat';

export function App() {
  const sim = useSimulator();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [follow, setFollow] = useState(true);
  const toggle = (next: Sheet) => setSheet((current) => (current === next ? 'none' : next));

  return (
    <div className={`stage ${sheet === 'none' ? '' : 'sheet-open'}`}>
      <ArchitectureScene
        view={sim.view}
        step={sim.step}
        animMs={animationMs(sim.speed)}
        follow={follow}
        onWebglFail={() => setSheet('flat')}
        onOpenEditor={() => setSheet('editor')}
      />

      {sheet === 'editor' && (
        <section className="dock dock-left" aria-label="汇编程序">
          <DockHead title="程序" onClose={() => setSheet('none')} />
          <EditorPanel
            source={sim.source}
            errors={sim.errors}
            listing={sim.listing}
            status={sim.status}
            dirty={sim.dirty}
            activeExample={sim.activeExample}
            onSource={sim.setSource}
            onExample={sim.loadExample}
          />
        </section>
      )}

      {sheet === 'isa' && (
        <section className="dock dock-right" aria-label="指令一览">
          <DockHead title="指令" onClose={() => setSheet('none')} />
          <div className="isa">
            <InstructionList />
          </div>
        </section>
      )}

      {sheet === 'flat' && (
        <section className="dock dock-right dock-flat" aria-label="平面示意图">
          <DockHead title="平面示意图" onClose={() => setSheet('none')} />
          <FlatMachine
            view={sim.view}
            step={sim.step}
            animMs={animationMs(sim.speed)}
            annotations={sim.annotations}
          />
        </section>
      )}

      <div className="hud-bottom">
        <button type="button" className={sheet === 'editor' ? 'primary' : ''} onClick={() => toggle('editor')}>
          <HudIcon d="M4 5h10M4 8.5h10M4 12h6" />
          程序
        </button>
        <button type="button" className={sheet === 'isa' ? 'primary' : ''} onClick={() => toggle('isa')}>
          <HudIcon d="M3.5 4.5h9v8h-9zM6 7.5h4M6 10h2.5" />
          指令
        </button>
        <Toolbar
          running={sim.running}
          halted={sim.view.halted}
          canStep={sim.canStep}
          speed={sim.speed}
          onAssemble={() => sim.assembleSource(sim.source)}
          onMicro={sim.stepMicro}
          onInstruction={sim.stepInstruction}
          onRun={sim.run}
          onPause={sim.pause}
          onReset={sim.reset}
          onSpeed={sim.setSpeed}
        />
        <label className="follow">
          <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
          跟随
        </label>
        <button type="button" className={sheet === 'flat' ? 'primary' : ''} onClick={() => toggle('flat')}>
          <HudIcon d="M3 4.5h10v8H3zM3 8h10M8 4.5v8" />
          平面
        </button>
      </div>
    </div>
  );
}

function HudIcon({ d }: { d: string }) {
  return (
    <svg className="hud-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function DockHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="dock-head">
      <h2>{title}</h2>
      <button type="button" onClick={onClose}>
        收起
      </button>
    </div>
  );
}
