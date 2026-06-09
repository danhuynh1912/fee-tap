import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { SPORT_CONFIGS } from '../constants'

export function WelcomeModal({ clubId, myClubs, onClose }) {
  const { t } = useTranslation()
  const club = myClubs.find((c) => c.id === clubId)
  const sport = SPORT_CONFIGS[club?.sport_type] || SPORT_CONFIGS.badminton

  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  if (!club) return null

  return (
    <Modal onClose={onClose}>
      <div className="text-center py-4">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-slate-900 text-3xl">
          {sport.emoji}
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">{t('join_welcome')}</h2>
        <p className="text-slate-500 text-sm mb-1">{t('join_pre_sub')}</p>
        <p className="font-bold text-slate-900 mb-6">{club.name}</p>
        <Button variant="volt" onClick={onClose}>{t('close')}</Button>
      </div>
    </Modal>
  )
}
