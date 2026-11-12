import { EditorPanel } from './components/EditorPanel';
import { ExplainPanel } from './components/ExplainPanel';
import { MachineView } from './components/MachineView';
import { Toolbar } from './components/Toolbar';
import { animationMs, useSimulator } from './useSimulator';

export function App() {
  const sim = useSimulator();

  return (
    <div className="app">
      <a className="skip" href="#machine">
        跳到处理器
      </a>
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div>
            <p className="eyebrow">8 位教学计算机</p>
            <h1>看见计算机如何工作</h1>
          </div>
        </div>
        <p className="lede">
          一条指令要先从内存里取出，再被认出来，然后才去做。默认看到的是一块可以转动的立体主板，数据沿着总线飞过去。
        </p>
      </header>

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

      <main className="layout">
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
        <MachineView
          view={sim.view}
          step={sim.step}
          animMs={animationMs(sim.speed)}
          annotations={sim.annotations}
        />
        <ExplainPanel
          view={sim.view}
          step={sim.step}
          trace={sim.trace}
          exampleTitle={sim.activeExample?.title ?? null}
        />
      </main>

      <footer className="foot">
        <p>
          数都是无符号 8 位。加减只留下低 8 位，多出来的进位或不够减的借位记在标志 C 上。负标志 N 是结果的最高位：如果把这个字节当成有符号数，它就表示负数。
        </p>
      </footer>
    </div>
  );
}
