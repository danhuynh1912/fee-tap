import type { Metadata } from 'next'
import { fetchVotePageData } from '../../../_data/publicVote'
import { metadataForSlug } from '../../../[[...slug]]/seo'
import PublicVotePage from '../../../../src/screens/club/PublicVotePage'

export const dynamic = 'force-dynamic'

type Params = { id: string }
type SearchParams = { [key: string]: string | string[] | undefined }

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}): Promise<Metadata> {
  return (await metadataForSlug(['club', params.id, 'vote'], searchParams)) ?? {}
}

export default async function VotePage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const initialData = await fetchVotePageData(params.id)
  const defaultTab = searchParams?.tab === 'cycle' ? 'cycle' : 'vote'
  return (
    <PublicVotePage
      clubId={params.id}
      initialData={initialData}
      defaultTab={defaultTab as 'vote' | 'cycle'}
    />
  )
}
