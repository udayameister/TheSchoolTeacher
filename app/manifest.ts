import type { MetadataRoute } from 'next';

/** Lets phones add the site to the home screen with the TheSchoolTeacher icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TheSchoolTeacher – Teacher jobs in Indian schools',
    short_name: 'TheSchoolTeacher',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFCF5',
    theme_color: '#76283A',
    icons: [
      { src: '/brand/logo-mark-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/logo-mark-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/logo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
