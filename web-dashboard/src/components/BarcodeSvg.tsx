import React from 'react';

interface BarcodeSvgProps {
  value?: string;
  width?: number | string;
  height?: number | string;
  color?: string;
  showText?: boolean;
}

export default function BarcodeSvg({ 
  value = '1323213321', 
  width = 75, 
  height = 22,
  color = '#000000',
  showText = false
}: BarcodeSvgProps) {
  return (
    <div className="barcode-container" style={{ width, height, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 28" width="100%" height="100%" preserveAspectRatio="none">
        {/* High contrast sharp barcode pattern */}
        <rect x="2" y="0" width="3" height="23" fill={color} />
        <rect x="7" y="0" width="1.5" height="23" fill={color} />
        <rect x="11" y="0" width="4" height="23" fill={color} />
        <rect x="18" y="0" width="2" height="23" fill={color} />
        <rect x="22" y="0" width="1.5" height="23" fill={color} />
        <rect x="26" y="0" width="3.5" height="23" fill={color} />
        <rect x="32" y="0" width="2" height="23" fill={color} />
        <rect x="36" y="0" width="1" height="23" fill={color} />
        <rect x="40" y="0" width="4" height="23" fill={color} />
        <rect x="47" y="0" width="1.5" height="23" fill={color} />
        <rect x="51" y="0" width="3" height="23" fill={color} />
        <rect x="56" y="0" width="2" height="23" fill={color} />
        <rect x="61" y="0" width="1.5" height="23" fill={color} />
        <rect x="65" y="0" width="4" height="23" fill={color} />
        <rect x="72" y="0" width="1" height="23" fill={color} />
        <rect x="75" y="0" width="3" height="23" fill={color} />
        <rect x="81" y="0" width="2" height="23" fill={color} />
        <rect x="85" y="0" width="3.5" height="23" fill={color} />
        <rect x="91" y="0" width="1.5" height="23" fill={color} />
        <rect x="95" y="0" width="3" height="23" fill={color} />
        {showText && (
          <text x="50" y="27" fontSize="5" fill={color} textAnchor="middle" letterSpacing="0.8" fontWeight="bold">
            {value}
          </text>
        )}
      </svg>
    </div>
  );
}
