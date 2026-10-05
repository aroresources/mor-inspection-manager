import type { MetadataRoute } from 'next'

// Web app manifest — makes the app installable (iOS "Add to Home Screen" and
// Android install), launching standalone (no browser chrome). Next serves this
// at /manifest.webmanifest and links it automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MOR Inspection Manager',
    short_name: 'MOR Manager',
    description: 'Track HUD Management & Occupancy Review inspections across your properties.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3f4f6',
    theme_color: '#2563eb',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
