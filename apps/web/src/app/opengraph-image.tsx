import { ImageResponse } from 'next/og';

export const alt = 'Jobbdjungeln — koll på hela ditt jobbsök';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px',
          background: 'linear-gradient(145deg, #f7f6f1 0%, #eafaf2 55%, #d8efe4 100%)',
          color: '#1c1c18',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#1f6f52',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50% 0',
                background: '#eafaf2',
                transform: 'rotate(-45deg)',
              }}
            />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Jobbdjungeln
          </div>
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 52,
            fontWeight: 650,
            lineHeight: 1.15,
            maxWidth: 900,
            letterSpacing: '-0.02em',
          }}
        >
          Koll på hela ditt jobbsök
        </div>
        <div style={{ marginTop: 18, fontSize: 28, color: '#5c5b54', maxWidth: 820 }}>
          Sparade jobb, ansökningar och månadsrapporten — på ett ställe.
        </div>
      </div>
    ),
    { ...size },
  );
}
