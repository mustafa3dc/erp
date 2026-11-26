import React, { useMemo } from 'react';

interface BarcodeSvgProps {
  value?: string;
  width?: number | string;
  height?: number | string;
  color?: string;
  showText?: boolean;
}

/**
 * Generates deterministic high-contrast 1D barcode geometry from `value`
 * (compatible with LOY-/RDM- codes and numeric SKU/receipt identifiers).
 */
export default function BarcodeSvg({
  value = '1323213321',
  width = 75,
  height = 22,
  color = '#000000',
  showText = false
}: BarcodeSvgProps) {
  const { bars, viewWidth } = useMemo(() => {
    const safeVal = (value || '0').trim() || '0';
    const rects: Array<{ x: number; w: number }> = [];
    let cursor = 2;

    // Start guard pattern
    rects.push({ x: cursor, w: 2.2 });
    cursor += 3.6;
    rects.push({ x: cursor, w: 1.2 });
    cursor += 2.6;

    // Encode each character into deterministic bar/space widths
    for (let i = 0; i < safeVal.length; i++) {
      const code = safeVal.charCodeAt(i);
      const b1 = 1 + ((code >> 0) & 3) * 0.65;
      const s1 = 1 + ((code >> 2) & 1) * 0.85;
      const b2 = 1 + ((code >> 3) & 3) * 0.6;
      const s2 = 1 + ((code >> 5) & 1) * 0.85;

      rects.push({ x: cursor, w: b1 });
      cursor += b1 + s1;
      rects.push({ x: cursor, w: b2 });
      cursor += b2 + s2;
    }

    // Stop guard pattern
    rects.push({ x: cursor, w: 1.2 });
    cursor += 2.4;
    rects.push({ x: cursor, w: 2.4 });
    cursor += 4.4;

    return { bars: rects, viewWidth: Math.max(80, cursor) };
  }, [value]);

  const barHeight = showText ? 22 : 28;

  return (
    <div
      className="barcode-container"
      style={{ width, height, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        viewBox={`0 0 ${viewWidth} 28`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-label={value}
      >
        {bars.map((bar, idx) => (
          <rect key={idx} x={bar.x} y={0} width={bar.w} height={barHeight} fill={color} />
        ))}
        {showText && (
          <text
            x={viewWidth / 2}
            y="27"
            fontSize="4.8"
            fill={color}
            textAnchor="middle"
            letterSpacing="0.8"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {value}
          </text>
        )}
      </svg>
    </div>
  );
}
