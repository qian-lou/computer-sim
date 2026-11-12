import type { CpuView, Phase, StepInfo } from '../cpu/cpu';
import { hexByte } from '../cpu/format';

const PHASE_LABEL: Record<Phase, string> = {
  idle: '准备',
  fetch: '取指',
  decode: '译码',
  execute: '执行',
  halted: '停机',
};

interface ExplainPanelProps {
  view: CpuView;
  step: StepInfo | null;
  trace: StepInfo[];
  exampleTitle: string | null;
}

export function ExplainPanel({ view, step, trace, exampleTitle }: ExplainPanelProps) {
  const phase = step?.phase ?? 'idle';
  const last = view.output[view.output.length - 1];
  const welcome = exampleTitle
    ? `内存里是「${exampleTitle}」。程序计数器正指着第一条指令。按「微步」，看地址怎样送到内存、字节怎样变成指令，再被执行。`
    : '按「汇编并装入」，再按「微步」。每一拍，右边都会用白话说明刚刚发生了什么。';

  return (
    <section className="panel explain" id="explain" aria-live="polite">
      <div className="panel-head">
        <h2>这一步在做什么</h2>
        <span className={`phase-tag phase-${phase}`}>{PHASE_LABEL[phase]}</span>
      </div>
      <p className={`phase-word phase-${phase}`}>{step?.title ?? '准备开始'}</p>
      <p className="explain-body">{step?.explanation ?? welcome}</p>
      {view.halted && <p className="halt-banner">程序已停止。复位可以从入口再来一遍，也可以换一个示例。</p>}

      {trace.length > 0 && (
        <div className="trace-wrap">
          <h3>这条指令已经走过</h3>
          <ol className="trace">
            {trace.map((item, index) => (
              <li
                key={`${item.phase}-${item.title}-${index}`}
                className={`phase-${item.phase} ${index === trace.length - 1 ? 'current' : ''}`}
              >
                {item.title}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="output-block">
        <h3>输出</h3>
        <div className="output-big">
          <span>最近一次</span>
          <strong>{last === undefined ? '—' : last}</strong>
          {last !== undefined && <small>0x{hexByte(last)}</small>}
        </div>
        {view.output.length > 0 ? (
          <ol className="output-log">
            {view.output.map((value, index) => (
              <li key={`${index}-${value}`}>{value}</li>
            ))}
          </ol>
        ) : (
          <p className="quiet">还没有输出。程序执行到 OUT 时，累加器的值会出现在这里。</p>
        )}
      </div>
    </section>
  );
}
