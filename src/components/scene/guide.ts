import type { StepInfo } from '../../cpu/cpu';
import { cmosNand, rippleAdd, type Bit } from './logic';

export type LevelId = 'machine' | 'cpu' | 'alu' | 'bit' | 'cmos';

export interface Crumb {
  id: LevelId;
  label: string;
}

const ORDER: LevelId[] = ['machine', 'cpu', 'alu', 'bit', 'cmos'];

const LABELS: Record<LevelId, string> = {
  machine: '整机',
  cpu: 'CPU',
  alu: 'ALU',
  bit: '全加器',
  cmos: '晶体管',
};

export function crumbs(level: LevelId): Crumb[] {
  const end = ORDER.indexOf(level);
  return ORDER.slice(0, end + 1).map((id) => ({ id, label: LABELS[id] }));
}

export function parentLevel(level: LevelId): LevelId | null {
  const index = ORDER.indexOf(level);
  return index <= 0 ? null : ORDER[index - 1];
}

export interface Pose {
  position: [number, number, number];
  target: [number, number, number];
}

export const POSES: Record<LevelId, Pose> = {
  machine: { position: [2.7, 1.72, 3.55], target: [0.2, 0.95, 0.35] },
  cpu: { position: [0.05, 2.05, 2.35], target: [0, 0.12, 0.05] },
  alu: { position: [0, 2.85, 5.55], target: [0, 0.42, 0] },
  bit: { position: [0.15, 2.35, 3.7], target: [0, 0.4, -0.2] },
  cmos: { position: [0.15, 1.85, 4.15], target: [0, 0.25, 0] },
};

export interface MachineSnapshot {
  acc: number;
  b: number;
  pc: number;
  ir: number;
  mar: number;
  mdr: number;
  out: number;
}

export function describeLevel(level: LevelId, machine: MachineSnapshot, step: StepInfo | null, bitIndex: number): { title: string; body: string } {
  const added = rippleAdd(machine.acc, machine.b);
  const bit = added.bits[bitIndex] ?? added.bits[0];
  const nand = cmosNand(bit.a, bit.b);
  if (level === 'machine') {
    return {
      title: '整机',
      body: step
        ? `这是一台打开侧板的电脑。主板上的处理器、内存、硬盘、显卡和电源靠总线连在一起。这一拍：${step.title}。${flowSentence(step)} 点击 CPU，可以飞进芯片内部。`
        : '这是一台打开侧板的电脑。程序住在内存里，CPU 沿着内存总线把指令取出来，结果送到旁边的显示器。点击 CPU，可以一层层看到芯片、电路和晶体管。',
    };
  }
  if (level === 'cpu') {
    return {
      title: 'CPU 芯片',
      body: `硅片上能看见控制单元、算术逻辑单元、寄存器堆和总线接口。教学 CPU 没有缓存，图上的 L1 只是对照真实处理器。现在 PC=${machine.pc}，IR=${machine.ir}，ACC=${machine.acc}，B=${machine.b}。${step ? `这一拍是「${step.title}」。` : ''} 点击 ALU 看加法是怎样一位一位做完的。`,
    };
  }
  if (level === 'alu') {
    return {
      title: '8 位加法器',
      body: `ALU 里的加法器由 8 个全加器串成。低位的进位送给下一位，这就是行波进位。用现在的寄存器演算：ACC ${machine.acc} + B ${machine.b} = ${added.sum}${added.carry ? '，最高位还有进位' : ''}。亮着的线表示这一位的进位是 1。点击任意一位，看它内部的逻辑门。`,
    };
  }
  if (level === 'bit') {
    return {
      title: `第 ${bitIndex} 位全加器`,
      body: `这一位把 A=${bit.a}、B=${bit.b} 和低位进位 Cin=${bit.cin} 加在一起。两个异或门得到和 S=${bit.sum}，与门和或门得到向高位的进位 Cout=${bit.cout}。黄线是 1，灰线是 0。点击进位用的与门，看它怎样由晶体管做成。`,
    };
  }
  const pullingUp = nand.pmosA || nand.pmosB;
  return {
    title: 'CMOS 与非门',
    body: `全加器里的与门，内核是一个与非门再加一个反相器。这里把与非门拆开：上面两个 PMOS 并联，下面两个 NMOS 串联。A=${nand.a}，B=${nand.b}。${pullingUp ? '至少有一个 PMOS 导通，输出被拉到电源 Vdd，结果是 1。' : '两个 NMOS 都导通，输出被拉到地 GND，结果是 0。'} 发亮的管子就是这条通路上正在导电的晶体管。`,
  };
}

function flowSentence(step: StepInfo): string {
  if (step.writeMem !== null) return '数据正从 CPU 写回内存。';
  if (step.title === '输出' || step.changedRegs.includes('out')) return '结果正从 CPU 送到显示器。';
  if (step.readMem !== null || step.phase === 'fetch') return 'CPU 正沿着内存总线读取数据。';
  return '总线把主板上的芯片连在一起。';
}

export function dieFocus(step: StepInfo | null): 'control' | 'alu' | 'regs' | 'bus' | null {
  if (!step) return null;
  if (step.alu) return 'alu';
  if (step.phase === 'decode') return 'control';
  if (step.changedRegs.length > 0 || step.activeRegs.length > 0) return 'regs';
  if (step.activeBus) return 'bus';
  return null;
}

export function asBit(value: number): Bit {
  return value ? 1 : 0;
}
