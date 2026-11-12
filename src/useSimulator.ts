import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assemble, type ListingEntry, type SourceError } from './cpu/assembler';
import { Cpu, type StepInfo } from './cpu/cpu';
import { EXAMPLES, type ExampleProgram } from './cpu/examples';
import { hexByte } from './cpu/format';

export const SPEEDS = [
  { label: '很慢', delay: 1100 },
  { label: '慢', delay: 800 },
  { label: '较慢', delay: 520 },
  { label: '适中', delay: 340 },
  { label: '较快', delay: 220 },
  { label: '快', delay: 130 },
  { label: '很快', delay: 70 },
] as const;

export function animationMs(speed: number): number {
  const delay = SPEEDS[speed - 1]?.delay ?? SPEEDS[3].delay;
  return Math.min(460, Math.round(delay * 0.72));
}

function describeLoad(origin: number, byteLength: number): string {
  return `已装入内存，入口地址 ${origin}（0x${hexByte(origin)}），机器码 ${byteLength} 字节。`;
}

function appendTrace(previous: StepInfo[], info: StepInfo): StepInfo[] {
  const last = previous[previous.length - 1];
  const base = info.phase === 'fetch' && last?.instructionComplete ? [] : previous;
  const next = [...base, info];
  return next.length > 16 ? next.slice(-16) : next;
}

function boot() {
  const result = assemble(EXAMPLES[0].source);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.message).join('；'));
  }
  const cpu = new Cpu();
  cpu.load(result.image, result.origin);
  return { cpu, result };
}

export function useSimulator() {
  const [bootState] = useState(boot);
  const cpu = bootState.cpu;
  const [version, setVersion] = useState(0);
  const [source, setSource] = useState(EXAMPLES[0].source);
  const [assembledSource, setAssembledSource] = useState(EXAMPLES[0].source);
  const [errors, setErrors] = useState<SourceError[]>([]);
  const [listing, setListing] = useState<ListingEntry[]>(bootState.result.listing);
  const [annotations, setAnnotations] = useState<Record<number, string>>(bootState.result.annotations);
  const [status, setStatus] = useState(describeLoad(bootState.result.origin, bootState.result.byteLength));
  const [step, setStep] = useState<StepInfo | null>(null);
  const [trace, setTrace] = useState<StepInfo[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(3);
  const runningRef = useRef(false);

  const bump = useCallback(() => setVersion((value) => value + 1), []);

  const assembleSource = useCallback(
    (nextSource: string) => {
      runningRef.current = false;
      setRunning(false);
      const result = assemble(nextSource);
      if (!result.ok) {
        setErrors(result.errors);
        setStatus('汇编没有通过，内存里仍是上一份程序。');
        return;
      }
      cpu.load(result.image, result.origin);
      setErrors([]);
      setListing(result.listing);
      setAnnotations(result.annotations);
      setAssembledSource(nextSource);
      setStep(null);
      setTrace([]);
      setStatus(describeLoad(result.origin, result.byteLength));
      bump();
    },
    [bump, cpu],
  );

  const stepMicro = useCallback(() => {
    if (runningRef.current || cpu.halted) return;
    const info = cpu.stepMicro();
    setStep(info);
    setTrace((previous) => appendTrace(previous, info));
    bump();
  }, [bump, cpu]);

  const stepInstruction = useCallback(() => {
    if (runningRef.current || cpu.halted) return;
    const steps = cpu.stepInstruction();
    const last = steps[steps.length - 1] ?? null;
    setStep(last);
    setTrace((previous) => {
      const lastPrevious = previous[previous.length - 1];
      const base = lastPrevious?.instructionComplete ? [] : previous;
      const merged = [...base, ...steps];
      return merged.slice(-16);
    });
    bump();
  }, [bump, cpu]);

  const run = useCallback(() => {
    if (cpu.halted) return;
    runningRef.current = true;
    setRunning(true);
  }, [cpu]);

  const pause = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    cpu.reset();
    setStep(null);
    setTrace([]);
    setStatus(`已回到入口地址 ${cpu.origin}（0x${hexByte(cpu.origin)}）。内存恢复成刚装入的程序。`);
    bump();
  }, [bump, cpu]);

  const loadExample = useCallback(
    (example: ExampleProgram) => {
      setSource(example.source);
      assembleSource(example.source);
    },
    [assembleSource],
  );

  useEffect(() => {
    if (!running) return;
    const delay = SPEEDS[speed - 1]?.delay ?? SPEEDS[2].delay;
    const id = window.setInterval(() => {
      if (!runningRef.current) return;
      if (cpu.halted) {
        runningRef.current = false;
        setRunning(false);
        return;
      }
      const info = cpu.stepMicro();
      setStep(info);
      setTrace((previous) => appendTrace(previous, info));
      setVersion((value) => value + 1);
      if (cpu.halted) {
        runningRef.current = false;
        setRunning(false);
      }
    }, delay);
    return () => window.clearInterval(id);
  }, [cpu, running, speed]);

  const view = useMemo(() => cpu.view(), [cpu, version]);
  const activeExample = EXAMPLES.find((example) => example.source === source) ?? null;

  return {
    source,
    setSource,
    errors,
    listing,
    annotations,
    status,
    dirty: source !== assembledSource,
    step,
    trace,
    running,
    speed,
    setSpeed,
    view,
    activeExample,
    canStep: !running && !view.halted,
    assembleSource,
    stepMicro,
    stepInstruction,
    run,
    pause,
    reset,
    loadExample,
  };
}
