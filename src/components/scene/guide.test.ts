import { describe, expect, it } from 'vitest';
import { crumbs, dieFocus, parentLevel } from './guide';

describe('architecture navigation', () => {
  it('builds a breadcrumb from the whole machine down to a transistor', () => {
    expect(crumbs('cmos').map((crumb) => crumb.label)).toEqual(['整机', 'CPU', 'ALU', '全加器', '晶体管']);
    expect(crumbs('machine')).toEqual([{ id: 'machine', label: '整机' }]);
  });

  it('walks back one level at a time', () => {
    expect(parentLevel('cmos')).toBe('bit');
    expect(parentLevel('bit')).toBe('alu');
    expect(parentLevel('alu')).toBe('cpu');
    expect(parentLevel('cpu')).toBe('machine');
    expect(parentLevel('machine')).toBeNull();
  });

  it('looks at the alu while an arithmetic step is active', () => {
    expect(dieFocus({ alu: { op: 'ADD', left: 1, right: 2, result: 3 }, phase: 'execute', changedRegs: ['acc'], activeRegs: [], activeBus: null } as never)).toBe('alu');
    expect(dieFocus({ alu: null, phase: 'decode', changedRegs: [], activeRegs: [], activeBus: null } as never)).toBe('control');
    expect(dieFocus(null)).toBeNull();
  });
});
