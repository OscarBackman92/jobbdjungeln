import { ImageResponse } from 'next/og';

type IconId = '192' | '512';

export function generateImageMetadata() {
  return [
    { contentType: 'image/png', size: { width: 192, height: 192 }, id: '192' },
    { contentType: 'image/png', size: { width: 512, height: 512 }, id: '512' },
  ];
}

export default async function Icon({ id }: { id: Promise<string> | string }) {
  const resolved = (typeof id === 'object' && id && 'then' in id ? await id : id) as IconId;
  const px = resolved === '512' ? 512 : 192;
  const leaf = Math.round(px * 0.42);

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
          borderRadius: Math.round(px * 0.22),
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
    { width: px, height: px },
  );
}
