/** Keep an integer inside an unsigned byte. */
export function u8(n: number): number {
  return ((n % 256) + 256) % 256;
}

export function hexByte(n: number): string {
  return u8(n).toString(16).toUpperCase().padStart(2, '0');
}

/** Decimal plus hex, the form used in the explanation panel. */
export function numText(n: number): string {
  const value = u8(n);
  return `${value}（0x${hexByte(value)}）`;
}
