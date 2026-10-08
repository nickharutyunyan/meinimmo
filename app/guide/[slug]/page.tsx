import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GuideArticleView from '../../../components/GuideArticleView';
import { getGuideArticle, guideArticles } from '../../../lib/guide';

export function generateStaticParams() { return guideArticles.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getGuideArticle(slug);
  if (!article) return {};
  const title = `${article.en.title} | Review a House`;
  const description = article.en.dek;
  return {
    title,
    description,
    alternates: { canonical: `/guide/${slug}`, languages: { en: `/guide/${slug}`, de: `/de/guide/${slug}` } },
    openGraph: { type: 'website', url: `/guide/${slug}`, siteName: 'ReviewAHouse', locale: 'en_GB', title, description },
    twitter: { card: 'summary', title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const article = getGuideArticle((await params).slug);
  if (!article) notFound();
  return <GuideArticleView article={article} locale="en" />;
}
