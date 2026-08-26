import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type SourceEnv = CloudflareEnv & { PDFS: R2Bucket };

function sourceKey(reportId: string) {
  return `reports/${reportId}/source.pdf`;
}

async function bucket() {
  const { env } = await getCloudflareContext({ async: true });
  const pdfs = (env as SourceEnv).PDFS;
  if (!pdfs) throw new Error('The Cloudflare R2 binding "PDFS" is not configured.');
  return pdfs;
}

export async function saveSourcePdf(reportId: string, data: ArrayBuffer, displayName: string) {
  await (await bucket()).put(sourceKey(reportId), data, {
    httpMetadata: { contentType: 'application/pdf' },
    customMetadata: { displayName },
  });
}

export async function sourcePdf(reportId: string) {
  return (await bucket()).get(sourceKey(reportId));
}

export async function deleteSourcePdf(reportId: string) {
  await (await bucket()).delete(sourceKey(reportId));
}
