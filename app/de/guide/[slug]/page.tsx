import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GuideArticleView from '../../../../components/GuideArticleView';
import { getGuideArticle, guideArticles } from '../../../../lib/guide';

export function generateStaticParams() { return guideArticles.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getGuideArticle(slug);
  if (!article) return {};
  const title = `${article.de.title} | Review a House`;
  const description = article.de.dek;
  return {
    title,
    description,
    alternates: { canonical: `/de/guide/${slug}`, languages: { en: `/guide/${slug}`, de: `/de/guide/${slug}` } },
    openGraph: { type: 'website', url: `/de/guide/${slug}`, siteName: 'ReviewAHouse', locale: 'de_DE', title, description },
    twitter: { card: 'summary', title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const article = getGuideArticle((await params).slug);
  if (!article) notFound();
  return <GuideArticleView article={article} locale="de" />;
}
