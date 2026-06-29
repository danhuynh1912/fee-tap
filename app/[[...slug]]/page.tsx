import type { Metadata } from 'next'
import AppShell from './AppShell'
import { metadataForSlug } from './seo'

// Live data (payment amounts, club names) must be fetched per request.
export const dynamic = 'force-dynamic'

type Params = { slug?: string[] }
type SearchParams = { [key: string]: string | string[] | undefined }

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}): Promise<Metadata> {
  try {
    const override = await metadataForSlug(params.slug ?? [], searchParams)
    return override ?? {}
  } catch {
    return {}
  }
}

export default function Page() {
  return <AppShell />
}
