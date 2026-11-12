export interface ExampleProgram {
  id: string;
  title: string;
  blurb: string;
  source: string;
}

export const EXAMPLES: ExampleProgram[] = [
  {
    id: 'add',
    title: '两数相加',
    blurb: '把 12 和 30 放进两个寄存器，相加后从 OUT 送出 42。',
    source: `; 两数相加
; LOADI 把数直接放进寄存器，ADD 计算 ACC + B
        LOADI A, 12    ; ACC = 12
        LOADI B, 30    ; B = 30
        ADD            ; ACC = 12 + 30
        OUT            ; 把 42 送到输出
        HALT
`,
  },
  {
    id: 'countdown',
    title: '倒计时',
    blurb: '从 5 减到 1。每次先输出当前值，减到 0 时 Z 亮起，循环结束。',
    source: `; 从 5 倒数到 1，每次输出当前值
; 减到 0 时零标志 Z 亮起，JNZ 就不再跳回 loop
        LOADI A, 5
loop:   OUT
        LOADI B, 1
        SUB
        JNZ loop
        HALT
`,
  },
  {
    id: 'sum',
    title: '累加 1 到 10',
    blurb: '寄存器不够放三个数，所以和与计数器住在内存里。结果是 55。',
    source: `; 计算 1 + 2 + … + 10，结果应为 55
; sum 和 i 放在内存里，寄存器只留作运算用
        LOADI A, 0
        STORE sum
        LOADI A, 1
        STORE i
loop:   LOAD A, i
        LOADI B, 11      ; i 涨到 11 就结束
        CMP              ; 比较，不改变 ACC
        JZ done
        LOAD A, sum
        LOAD B, i
        ADD
        STORE sum
        LOAD A, i
        LOADI B, 1
        ADD
        STORE i
        JMP loop
done:   LOAD A, sum
        OUT
        HALT
sum:    .byte 0
i:      .byte 0
`,
  },
  {
    id: 'multiply',
    title: '加法做乘法',
    blurb: '没有乘法指令。把 6 连加 7 次，得到 6 × 7 = 42。',
    source: `; 用重复加法计算 6 × 7
; count 从 7 减到 0，每减一次就把 6 加进积
        LOADI A, 0
        STORE prod
        LOADI A, 6
        STORE left
        LOADI A, 7
        STORE count
loop:   LOAD A, count
        JZ done          ; count 为 0 时结束
        LOAD A, prod
        LOAD B, left
        ADD
        STORE prod
        LOAD A, count
        LOADI B, 1
        SUB
        STORE count
        JMP loop
done:   LOAD A, prod
        OUT
        HALT
prod:   .byte 0
left:   .byte 0
count:  .byte 0
`,
  },
];
