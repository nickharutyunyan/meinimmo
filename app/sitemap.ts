import type { MetadataRoute } from 'next';
import { guideArticles } from '@/lib/guide';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://reviewahouse.com';
  const updated = new Date('2026-08-24');
  return [
    { url: base, lastModified: updated, alternates: { languages: { en: base, de: `${base}/de` } } },
    { url: `${base}/de`, lastModified: updated, alternates: { languages: { en: base, de: `${base}/de` } } },
    { url: `${base}/guide`, lastModified: updated, alternates: { languages: { en: `${base}/guide`, de: `${base}/de/guide` } } },
    { url: `${base}/de/guide`, lastModified: updated, alternates: { languages: { en: `${base}/guide`, de: `${base}/de/guide` } } },
    { url: `${base}/terms`, lastModified: new Date('2026-08-25'), alternates: { languages: { en: `${base}/terms`, de: `${base}/de/terms` } } },
    { url: `${base}/de/terms`, lastModified: new Date('2026-08-25'), alternates: { languages: { en: `${base}/terms`, de: `${base}/de/terms` } } },
    ...guideArticles.flatMap(({ slug, published }) => ([
      { url: `${base}/guide/${slug}`, lastModified: new Date(published), alternates: { languages: { en: `${base}/guide/${slug}`, de: `${base}/de/guide/${slug}` } } },
      { url: `${base}/de/guide/${slug}`, lastModified: new Date(published), alternates: { languages: { en: `${base}/guide/${slug}`, de: `${base}/de/guide/${slug}` } } },
    ])),
  ];
}
