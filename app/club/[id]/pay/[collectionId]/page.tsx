import type { Metadata } from 'next'
import { fetchPayPageData } from '../../../../_data/publicPay'
import { metadataForSlug } from '../../../../[[...slug]]/seo'
import PublicPayPage from '../../../../../src/screens/club/PublicPayPage'

export const dynamic = 'force-dynamic'

type Params = { id: string; collectionId: string }

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return (await metadataForSlug(['club', params.id, 'pay', params.collectionId])) ?? {}
}

export default async function PayPage({ params }: { params: Params }) {
  const initialData = await fetchPayPageData(params.id, params.collectionId)
  return (
    <PublicPayPage
      clubId={params.id}
      collectionId={params.collectionId}
      initialData={initialData}
    />
  )
}
