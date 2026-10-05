import { ImageResponse } from 'next/og'

// iOS home-screen icon. Full-bleed background (no rounded corners) since iOS
// applies its own rounding/mask. Next links it as apple-touch-icon automatically.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          fontSize: 66,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        MOR
      </div>
    ),
    { ...size }
  )
}
