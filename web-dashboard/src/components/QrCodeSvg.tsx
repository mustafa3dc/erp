import React, { useMemo } from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
}

// Reed-Solomon GF(256) with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEcc(data: number[], eccLen: number): number[] {
  const gen = rsGeneratorPoly(eccLen);
  const res = new Uint8Array(data.length + eccLen);
  res.set(data, 0);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return Array.from(res.slice(data.length));
}

// QR EC Level L byte-mode capacities & parameters for Versions 1..8
const VERSION_SPECS: Array<{
  version: number;
  totalCodewords: number;
  eccPerBlock: number;
  blocks: number;
  maxByteLen: number;
  alignments: number[];
}> = [
  { version: 1, totalCodewords: 26, eccPerBlock: 7, blocks: 1, maxByteLen: 17, alignments: [] },
  { version: 2, totalCodewords: 44, eccPerBlock: 10, blocks: 1, maxByteLen: 32, alignments: [6, 18] },
  { version: 3, totalCodewords: 70, eccPerBlock: 15, blocks: 1, maxByteLen: 53, alignments: [6, 22] },
  { version: 4, totalCodewords: 100, eccPerBlock: 20, blocks: 1, maxByteLen: 78, alignments: [6, 26] },
  { version: 5, totalCodewords: 134, eccPerBlock: 26, blocks: 1, maxByteLen: 106, alignments: [6, 30] },
  { version: 6, totalCodewords: 172, eccPerBlock: 18, blocks: 2, maxByteLen: 134, alignments: [6, 34] },
  { version: 7, totalCodewords: 196, eccPerBlock: 20, blocks: 2, maxByteLen: 154, alignments: [6, 22, 38] },
  { version: 8, totalCodewords: 242, eccPerBlock: 24, blocks: 2, maxByteLen: 192, alignments: [6, 24, 42] }
];

function buildQrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text || 'https://zilox.app'));
  const spec =
    VERSION_SPECS.find(v => bytes.length <= v.maxByteLen) ??
    VERSION_SPECS[VERSION_SPECS.length - 1];
  const payload = bytes.slice(0, spec.maxByteLen);

  const totalDataCodewords = spec.totalCodewords - spec.eccPerBlock * spec.blocks;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit character count (versions 1..9)
  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);

  // Terminator + byte alignment + alternating pad bytes (0xEC, 0x11)
  const totalDataBits = totalDataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < totalDataBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    dataBytes.push(val);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < totalDataCodewords) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Split into blocks and compute RS ECC
  const baseBlockLen = Math.floor(totalDataCodewords / spec.blocks);
  const longBlocks = totalDataCodewords % spec.blocks;
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < spec.blocks; b++) {
    const len = baseBlockLen + (b >= spec.blocks - longBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    eccBlocks.push(rsComputeEcc(block, spec.eccPerBlock));
  }

  const finalCodewords: number[] = [];
  const maxDataLen = baseBlockLen + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) finalCodewords.push(block[i]);
    }
  }
  for (let i = 0; i < spec.eccPerBlock; i++) {
    for (const ecc of eccBlocks) {
      finalCodewords.push(ecc[i]);
    }
  }

  const size = spec.version * 4 + 17;
  const matrix: Array<Array<boolean | null>> = Array.from({ length: size }, () =>
    Array<boolean | null>(size).fill(null)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setModule = (r: number, c: number, dark: boolean, isFunction = true) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    matrix[r][c] = dark;
    if (isFunction) reserved[r][c] = true;
  };

  const drawFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const isDark =
          dr >= 0 &&
          dr <= 6 &&
          dc >= 0 &&
          dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setModule(r, c, isDark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignments;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      const r = centers[i];
      const c = centers[j];
      if (reserved[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(r + dr, c + dc, isDark);
        }
      }
    }
  }

  // Dark module & reserve format info strips
  setModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }

  // Version info strips for version >= 7
  if (spec.version >= 7) {
    let rem = spec.version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    }
    const verBits = (spec.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((verBits >> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setModule(a, b, bit);
      setModule(b, a, bit);
    }
  }

  // Place data bits in zig-zag order + apply Mask 0 ((r + c) % 2 === 0)
  const bitStream: number[] = [];
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) bitStream.push((cw >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let colOff = 0; colOff < 2; colOff++) {
        const c = right - colOff;
        if (reserved[r][c]) continue;
        const rawBit = bitIdx < bitStream.length ? bitStream[bitIdx++] === 1 : false;
        const maskBit = (r + c) % 2 === 0;
        matrix[r][c] = rawBit !== maskBit;
      }
    }
    upward = !upward;
  }

  // Format information for EC Level L (01) + Mask 0 (000) -> 5-bit data = 01000 -> BCH + mask 0x5412
  const formatData = (0b01 << 3) | 0; // EC L + Mask 0
  let fmt = formatData;
  for (let i = 0; i < 10; i++) {
    fmt = (fmt << 1) ^ ((fmt >> 9) * 0x537);
  }
  const formatBits = ((formatData << 10) | fmt) ^ 0x5412;

  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    // Copy 1
    if (i < 6) matrix[i][8] = bit;
    else if (i < 8) matrix[i + 1][8] = bit;
    else matrix[size - 15 + i][8] = bit;

    // Copy 2
    if (i < 8) matrix[8][size - 1 - i] = bit;
    else if (i < 9) matrix[8][15 - i] = bit;
    else matrix[8][14 - i] = bit;
  }

  return matrix.map(row => row.map(cell => Boolean(cell)));
}

export default function QrCodeSvg({ value, size = 148, className = '' }: QrCodeSvgProps) {
  const matrix = useMemo(() => buildQrMatrix(value), [value]);
  const n = matrix.length;
  const quiet = 2;
  const total = n + quiet * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className={className}
      aria-label={value}
      role="img"
    >
      <rect x={0} y={0} width={total} height={total} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect
              key={`${r}-${c}`}
              x={c + quiet}
              y={r + quiet}
              width={1}
              height={1}
              fill="#000000"
            />
          ) : null
        )
      )}
    </svg>
  );
}
