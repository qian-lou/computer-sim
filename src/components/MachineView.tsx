import { lazy, Suspense, useState } from 'react';
import type { AluView, CpuView, Phase, RegId, StepInfo } from '../cpu/cpu';
import { hexByte } from '../cpu/format';

const HouseScene = lazy(() => import('./scene/HouseScene').then((module) => ({ default: module.HouseScene })));

const REGISTERS: { id: RegId; name: string; role: string; hint: string }[] = [
  { id: 'pc', name: 'PC', role: '程序计数器', hint: '下一条要读的字节在内存的哪个地址' },
  { id: 'ir', name: 'IR', role: '指令寄存器', hint: '刚刚取到的操作码' },
  { id: 'acc', name: 'ACC', role: '累加器', hint: '运算的主寄存器，结果通常留在这里' },
  { id: 'b', name: 'B', role: '寄存器 B', hint: '第二个操作数' },
  { id: 'mar', name: 'MAR', role: '地址寄存器', hint: '当前要访问的内存地址' },
  { id: 'mdr', name: 'MDR', role: '数据寄存器', hint: '刚读到或即将写入内存的字节' },
  { id: 'out', name: 'OUT', role: '输出寄存器', hint: 'OUT 指令送出来的结果' },
];

const PHASES: { id: Phase; label: string }[] = [
  { id: 'fetch', label: '取指' },
  { id: 'decode', label: '译码' },
  { id: 'execute', label: '执行' },
];

interface MachineViewProps {
  view: CpuView;
  step: StepInfo | null;
  animMs: number;
  annotations: Record<number, string>;
}

export function MachineView(props: MachineViewProps) {
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [follow, setFollow] = useState(true);
  const phase = props.step?.phase ?? 'idle';

  return (
    <section className="panel machine" id="machine" data-phase={phase} aria-label="处理器和内存">
      <div className="panel-head">
        <h2>处理器</h2>
        <div className="view-switch">
          <div className="view-toggle" role="group" aria-label="视图">
            <button type="button" className={mode === '3d' ? 'on' : ''} aria-pressed={mode === '3d'} onClick={() => setMode('3d')}>
              立体
            </button>
            <button type="button" className={mode === '2d' ? 'on' : ''} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
              平面
            </button>
          </div>
          {mode === '3d' && (
            <label className="follow">
              <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
              镜头跟随
            </label>
          )}
          <p className="beat">{props.view.cycles === 0 ? '还没有开始' : `第 ${props.view.cycles} 拍`}</p>
        </div>
      </div>

      <ol className="phases">
        {PHASES.map((item, index) => (
          <li key={item.id} className={phase === item.id ? 'on' : ''} aria-current={phase === item.id ? 'step' : undefined}>
            <span>{index + 1}</span>
            {item.label}
          </li>
        ))}
      </ol>

      {mode === '3d' ? (
        <Suspense fallback={<div className="scene-frame scene-loading">正在准备计算机小屋…</div>}>
          <HouseScene
            view={props.view}
            step={props.step}
            animMs={props.animMs}
            follow={follow}
            onWebglFail={() => setMode('2d')}
          />
        </Suspense>
      ) : (
        <FlatMachine {...props} />
      )}
    </section>
  );
}

function FlatMachine({ view, step, animMs, annotations }: MachineViewProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const phase = step?.phase ?? 'idle';

  return (
    <div className="flat-machine" data-phase={phase}>

      <div className="units">
        <article className={`unit control phase-${phase}`}>
          <header>控制单元</header>
          <p className="unit-role">决定这一拍读谁、写谁、算不算。</p>
          <p className="mnemonic">{step?.mnemonic || (phase === 'fetch' ? '正在取指' : '等待开始')}</p>
          <p className="unit-copy">
            {step?.summary || '它按固定的节拍发命令：先取指令，再认出指令，最后才执行。'}
          </p>
        </article>
        <article className={`unit alu ${step?.alu ? 'hot' : ''}`}>
          <header>算术逻辑单元</header>
          <AluBox alu={step?.alu ?? null} />
        </article>
        <article className="unit flags">
          <header>标志</header>
          <div className="lamps">
            <Lamp name="Z" text="为零" on={view.flags.z} hot={step?.changedFlags.includes('z') ?? false} />
            <Lamp name="N" text="最高位" on={view.flags.n} hot={step?.changedFlags.includes('n') ?? false} />
            <Lamp name="C" text="进位/借位" on={view.flags.c} hot={step?.changedFlags.includes('c') ?? false} />
          </div>
        </article>
      </div>

      <div className="reg-file" aria-label="寄存器">
        {REGISTERS.map((register) => {
          const changed = step?.changedRegs.includes(register.id) ?? false;
          const active = step?.activeRegs.includes(register.id) ?? false;
          return (
            <div
              key={register.id}
              className={`reg ${changed ? 'changed' : ''} ${!changed && active ? 'active' : ''}`}
              title={register.hint}
            >
              <span className="reg-name">{register.name}</span>
              <strong>{hexByte(view[register.id])}</strong>
              <span className="reg-dec">{view[register.id]}</span>
              <span className="reg-role">{register.role}</span>
            </div>
          );
        })}
      </div>

      <BitRow value={view.acc} />

      <div className="signals" aria-label="控制信号">
        <span className={step?.readMem != null ? 'on' : ''}>读内存</span>
        <span className={step?.writeMem != null ? 'on' : ''}>写内存</span>
        <span className={step?.alu ? 'on' : ''}>运算</span>
        <span className={step?.title === '跳转' ? 'on' : ''}>跳转</span>
      </div>

      <Bus name="地址总线" kind="address" step={step} cycles={view.cycles} animMs={animMs} />
      <Bus name="数据总线" kind="data" step={step} cycles={view.cycles} animMs={animMs} />

      <RamGrid
        view={view}
        step={step}
        annotations={annotations}
        selected={selected}
        onSelect={setSelected}
      />
    </div>
  );
}

function AluBox({ alu }: { alu: AluView | null }) {
  if (!alu) return <p className="quiet">这一拍没有运算</p>;
  if (alu.op === 'NOT') {
    return (
      <p className="eq">
        <span>NOT</span> <b>{alu.left}</b> <span>=</span> <strong>{alu.result}</strong>
      </p>
    );
  }
  const symbol =
    alu.op === 'ADD' ? '+' : alu.op === 'AND' ? '与' : alu.op === 'OR' ? '或' : alu.op === 'XOR' ? '异或' : '−';
  const raw = alu.op === 'ADD' ? alu.left + alu.right : alu.op === 'SUB' || alu.op === 'CMP' ? alu.left - alu.right : null;
  return (
    <div>
      <p className="eq">
        <b>{alu.left}</b> <span>{symbol}</span> <b>{alu.right}</b> <span>=</span> <strong>{alu.result}</strong>
      </p>
      <p className="quiet">
        {alu.op === 'CMP' ? '只改标志，不写回 ACC' : '8 位结果写回 ACC'}
        {raw !== null && raw !== alu.result ? `。完整结果是 ${raw}` : ''}
      </p>
    </div>
  );
}

function Lamp({ name, text, on, hot }: { name: string; text: string; on: boolean; hot: boolean }) {
  return (
    <div className={`lamp ${on ? 'on' : ''} ${hot ? 'hot' : ''}`}>
      <span className="lamp-dot" aria-hidden="true" />
      <span className="lamp-name">{name}</span>
      <span className="lamp-text">{text}</span>
      <span className="lamp-state">{on ? '亮' : '灭'}</span>
    </div>
  );
}

function BitRow({ value }: { value: number }) {
  return (
    <div className="bit-row">
      <span className="bit-label">ACC 的 8 个位</span>
      <div className="bits" aria-label={`累加器二进制 ${value.toString(2).padStart(8, '0')}`}>
        {Array.from({ length: 8 }, (_, index) => {
          const bit = 7 - index;
          const on = ((value >> bit) & 1) === 1;
          return (
            <span key={bit} className={on ? 'bit on' : 'bit'}>
              {on ? '1' : '0'}
            </span>
          );
        })}
      </div>
      <span className="bit-caption">左边是最高位。负标志 N 看的就是这一位。</span>
    </div>
  );
}

function Bus({
  name,
  kind,
  step,
  cycles,
  animMs,
}: {
  name: string;
  kind: 'address' | 'data';
  step: StepInfo | null;
  cycles: number;
  animMs: number;
}) {
  const on = step?.activeBus === kind;
  return (
    <div className={`bus bus-${kind} ${on ? 'on' : ''}`}>
      <div className="bus-meta">
        <span className="bus-name">{name}</span>
        <span className="bus-route">{on && step ? `${step.busFrom} → ${step.busTo}` : '空闲'}</span>
      </div>
      <div className="bus-track">
        <div className="bus-line" />
        {on && step && step.busValue !== null && (
          <span
            key={cycles}
            className={`packet ${step.busForward ? 'forward' : 'reverse'}`}
            style={{ animationDuration: `${animMs}ms` }}
          >
            {hexByte(step.busValue)}
          </span>
        )}
      </div>
    </div>
  );
}

function RamGrid({
  view,
  step,
  annotations,
  selected,
  onSelect,
}: {
  view: CpuView;
  step: StepInfo | null;
  annotations: Record<number, string>;
  selected: number | null;
  onSelect: (address: number) => void;
}) {
  const headers = Array.from({ length: 16 }, (_, index) => index.toString(16).toUpperCase());
  return (
    <div className="ram-block">
      <div className="ram-head">
        <h3>内存 · 256 字节</h3>
        <p>16 行 × 16 列。格子里是十六进制。</p>
      </div>
      <ul className="legend">
        <li><i className="swatch pc" /> PC，下一条要读的地址</li>
        <li><i className="swatch mar" /> MAR 正指着的格子</li>
        <li><i className="swatch read" /> 这一拍读过</li>
        <li><i className="swatch write" /> 这一拍写过</li>
      </ul>
      <div className="ram-scroll">
        <div className="ram" role="grid" aria-label="内存">
          <div className="ram-corner" />
          {headers.map((label) => (
            <div key={label} className="ram-colhead">
              {label}
            </div>
          ))}
          {Array.from({ length: 16 }, (_, row) => (
            <div className="ram-row" key={row}>
              <div className="ram-rowhead">{(row * 16).toString(16).toUpperCase().padStart(2, '0')}</div>
              {Array.from({ length: 16 }, (_, column) => {
                const address = row * 16 + column;
                const value = view.ram[address];
                const classes = ['cell'];
                if (value !== 0) classes.push('nonzero');
                if (address === view.pc) classes.push('is-pc');
                if (view.cycles > 0 && address === view.mar) classes.push('is-mar');
                if (step?.readMem === address) classes.push('is-read');
                if (step?.writeMem === address) classes.push('is-write');
                if (selected === address) classes.push('is-selected');
                return (
                  <button
                    key={address}
                    type="button"
                    role="gridcell"
                    className={classes.join(' ')}
                    onClick={() => onSelect(address)}
                    title={annotations[address] ?? `地址 ${hexByte(address)}`}
                  >
                    {hexByte(value)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {selected !== null && (
        <p className="cell-detail">
          地址 {hexByte(selected)}（十进制 {selected}），值 {view.ram[selected]}（0x{hexByte(view.ram[selected])}）
          {annotations[selected]
            ? `。来自「${annotations[selected].trim()}」。`
            : view.ram[selected] === 0
              ? '。程序没有使用这个格子。'
              : '。这是运行中写入的数据。'}
        </p>
      )}
    </div>
  );
}
