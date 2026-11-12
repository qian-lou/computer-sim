import type { KeyboardEvent } from 'react';
import type { ListingEntry, SourceError } from '../cpu/assembler';
import type { ExampleProgram } from '../cpu/examples';
import { EXAMPLES } from '../cpu/examples';
import { hexByte } from '../cpu/format';
import { ISA, ISA_GROUPS } from '../cpu/isa';

interface EditorPanelProps {
  source: string;
  errors: SourceError[];
  listing: ListingEntry[];
  status: string;
  dirty: boolean;
  activeExample: ExampleProgram | null;
  onSource: (source: string) => void;
  onExample: (example: ExampleProgram) => void;
}

function formatListing(entry: ListingEntry): string {
  const bytes = entry.bytes.map((value) => hexByte(value)).join(' ');
  return `${hexByte(entry.address)}  ${bytes.padEnd(8, ' ')} ${entry.source.trim()}`;
}

export function EditorPanel({
  source,
  errors,
  listing,
  status,
  dirty,
  activeExample,
  onSource,
  onExample,
}: EditorPanelProps) {
  const onTab = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const element = event.currentTarget;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const next = `${source.slice(0, start)}  ${source.slice(end)}`;
    onSource(next);
    requestAnimationFrame(() => {
      element.selectionStart = element.selectionEnd = start + 2;
    });
  };

  return (
    <section className="panel editor" aria-label="汇编程序">
      <div className="panel-head">
        <h2>汇编程序</h2>
        <span className="panel-kicker">写给人看的指令</span>
      </div>
      <div className="examples" role="group" aria-label="示例程序">
        {EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            className={activeExample?.id === example.id ? 'example on' : 'example'}
            aria-pressed={activeExample?.id === example.id}
            onClick={() => onExample(example)}
          >
            {example.title}
          </button>
        ))}
      </div>
      {activeExample && <p className="blurb">{activeExample.blurb}</p>}
      <textarea
        value={source}
        onChange={(event) => onSource(event.target.value)}
        onKeyDown={onTab}
        spellCheck={false}
        aria-label="汇编源码"
      />
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((error) => (
            <li key={`${error.line}-${error.message}`}>
              第 {error.line} 行：{error.message}
            </li>
          ))}
        </ul>
      )}
      <p className={dirty ? 'status warn' : 'status'}>{status}</p>
      {dirty && <p className="status warn">源码已经改过，和内存里的程序不一致。请再按一次「汇编并装入」。</p>}
      {listing.length > 0 && (
        <div className="listing-wrap">
          <h3>装入内存的机器码</h3>
          <pre className="listing">{listing.map((entry) => formatListing(entry)).join('\n')}</pre>
        </div>
      )}
      <details className="isa">
        <summary>指令一览（{ISA.length} 条）</summary>
        {ISA_GROUPS.map((group) => (
          <div key={group} className="isa-group">
            <h3>{group}</h3>
            <ul className="isa-list">
              {ISA.filter((entry) => entry.group === group).map((entry) => (
                <li key={entry.opcode}>
                  <code>
                    {hexByte(entry.opcode)} {entry.syntax}
                  </code>
                  <span>{entry.summary}</span>
                  <small>{entry.flags}</small>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="isa-note">
          数可以写成十进制、0x 十六进制或 0b 二进制，范围 0–255。标号以字母或下划线开头。分号或 // 后面是注释。
          .org 地址 改写下一条字节的位置，.byte 写入数据。程序从第一条指令开始执行。
        </p>
      </details>
    </section>
  );
}
