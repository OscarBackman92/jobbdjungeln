import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Apple touch icon — green mark matching the PWA icons. */
export default function AppleIcon() {
  const leaf = Math.round(180 * 0.42);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1f6f52',
          borderRadius: Math.round(180 * 0.22),
        }}
      >
        <div
          style={{
            width: leaf,
            height: leaf,
            borderRadius: '50% 0',
            background: '#eafaf2',
            transform: 'rotate(-45deg)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
