import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type SourceEnv = CloudflareEnv & { PDFS?: R2Bucket };

function sourceKey(reportId: string) {
  return `reports/${reportId}/source.pdf`;
}

async function bucket() {
  const { env } = await getCloudflareContext({ async: true });
  return (env as SourceEnv).PDFS;
}

export async function saveSourcePdf(reportId: string, data: ArrayBuffer, displayName: string) {
  const pdfs = await bucket();
  if (!pdfs) return false;
  await pdfs.put(sourceKey(reportId), data, {
    httpMetadata: { contentType: 'application/pdf' },
    customMetadata: { displayName },
  });
  return true;
}

export async function sourcePdf(reportId: string) {
  return (await bucket())?.get(sourceKey(reportId));
}

export async function deleteSourcePdf(reportId: string) {
  await (await bucket())?.delete(sourceKey(reportId));
}
