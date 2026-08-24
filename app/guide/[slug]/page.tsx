import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GuideArticleView from '../../../components/GuideArticleView';
import { getGuideArticle, guideArticles } from '../../../lib/guide';

export function generateStaticParams() { return guideArticles.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getGuideArticle(slug);
  if (!article) return {};
  return { title: `${article.en.title} | Review a House`, description: article.en.dek, alternates: { canonical: `/guide/${slug}`, languages: { en: `/guide/${slug}`, de: `/de/guide/${slug}` } } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const article = getGuideArticle((await params).slug);
  if (!article) notFound();
  return <GuideArticleView article={article} locale="en" />;
}
