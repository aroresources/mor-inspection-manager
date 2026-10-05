import { ImageResponse } from 'next/og'

// App icon (favicon + manifest icon), generated at build time so no binary
// asset is needed. Next links it automatically.
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563eb',
          color: '#ffffff',
          fontSize: 190,
          fontWeight: 700,
          letterSpacing: -6,
          borderRadius: 96,
        }}
      >
        MOR
      </div>
    ),
    { ...size }
  )
}
