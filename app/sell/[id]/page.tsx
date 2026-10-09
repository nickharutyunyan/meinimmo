import { EditorPage, editorMetadata } from '@/components/market/pages';

export const metadata = editorMetadata;

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) { return <EditorPage locale="en" id={(await params).id} />; }
