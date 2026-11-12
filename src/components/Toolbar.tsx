import { SPEEDS } from '../useSimulator';

interface ToolbarProps {
  running: boolean;
  halted: boolean;
  canStep: boolean;
  speed: number;
  onAssemble: () => void;
  onMicro: () => void;
  onInstruction: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeed: (speed: number) => void;
}

export function Toolbar({
  running,
  halted,
  canStep,
  speed,
  onAssemble,
  onMicro,
  onInstruction,
  onRun,
  onPause,
  onReset,
  onSpeed,
}: ToolbarProps) {
  const current = SPEEDS[speed - 1] ?? SPEEDS[2];
  return (
    <div className="toolbar" role="group" aria-label="运行控制">
      <button type="button" className="primary" onClick={onAssemble}>
        汇编并装入
      </button>
      <button type="button" onClick={onMicro} disabled={!canStep}>
        微步
      </button>
      <button type="button" onClick={onInstruction} disabled={!canStep}>
        单条指令
      </button>
      {running ? (
        <button type="button" className="primary" onClick={onPause}>
          暂停
        </button>
      ) : (
        <button type="button" className="primary" onClick={onRun} disabled={halted}>
          运行
        </button>
      )}
      <button type="button" onClick={onReset}>
        复位
      </button>
      <label className="speed">
        <span>
          速度 <em>{current.label}</em>
        </span>
        <input
          type="range"
          min={1}
          max={SPEEDS.length}
          step={1}
          value={speed}
          aria-valuetext={current.label}
          onChange={(event) => onSpeed(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
