import { useTranslation } from 'react-i18next'
import { useClub } from '../../contexts/ClubContext'
import { useSettingsForm } from '../../hooks/useSettingsForm'
import { Settings2, Coins, Wallet, Check, Plus, Loader2, Users, TrendingUp, MapPin, Package, UserCheck, RefreshCw, Calendar } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, inputCls } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { CourtSlotModal } from '../../components/club/CourtSlotModal'
import { CourtSlotCard } from '../../components/club/CourtSlotCard'
import { PayOSSettings } from '../../components/club/PayOSSettings'
import { MembersPanel } from './MembersPanel'
import { cx, fmtVND, fmtInputNum, parseInputNum } from '../../lib/utils'
import { cycleLabelShort, monthName, computeMembershipVoteCycle } from '../../engine/forecast'

export function SettingsPage({ toast }) {
  const { t, i18n } = useTranslation()
  const {
    club,
    settings,
    slots: initialSlots,
    sport,
    members,
    plan,
    pollTally,
    hostName,
    hostAvatar,
    currentUserId,
    canEdit,
    fundTxns,
    payosConfig,
    setSettings,
    reload,
    openUpsell,
  } = useClub()

  const {
    form,
    setForm,
    busy,
    save,
    topUpOpen,
    setTopUpOpen,
    topUpAmount,
    setTopUpAmount,
    topUpNote,
    setTopUpNote,
    topUpBusy,
    submitTopUp,
    restockOpen,
    setRestockOpen,
    restockBoxes,
    setRestockBoxes,
    restockPrice,
    setRestockPrice,
    restockBusy,
    submitRestock,
    slots,
    editingSlot,
    setEditingSlot,
    saveSlot,
    deleteSlot,
    fundSetupMode,
    setFundSetupMode,
    isFirstSetup,
    actualSpent,
    livePreview,
  } = useSettingsForm({
    club,
    settings,
    initialSlots,
    fundTxns,
    members,
    pollTally,
    hostName,
    sport,
    canEdit,
    toast,
    reload,
    setSettings,
    openUpsell,
  })

  const cardTitleCls = 'flex items-center gap-2.5 text-base font-bold text-slate-900'

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* ── Court slots ── */}
          <Card>
            <div className={cardTitleCls}>
              <MapPin className="h-5 w-5 text-slate-400" />
              <span>{t('slots_title')}</span>
            </div>
            <p className="mt-1 mb-5 text-sm text-slate-500">{t('slots_hint')}</p>
            {slots.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">{t('slot_empty')}</p>
            ) : (
              <div className="space-y-3 mb-5">
                {slots.map((slot) => (
                  <CourtSlotCard
                    key={slot.id || slot.sort_order}
                    slot={slot}
                    canEdit={canEdit}
                    lang={i18n.language}
                    onEdit={() => setEditingSlot(slot)}
                    onDelete={() => deleteSlot(slot)}
                  />
                ))}
              </div>
            )}
            {canEdit && (
              <Button variant="subtle" size="sm" onClick={() => setEditingSlot({})}>
                <Plus className="h-4 w-4" /> {t('slot_add')}
              </Button>
            )}
          </Card>

          {/* ── Global settings ── */}
          <Card>
            <div className={cardTitleCls}>
              <Settings2 className="h-5 w-5 text-slate-400" />
              <span>{t('set_global_settings')}</span>
            </div>

            <div className={cx('mt-5 space-y-6', !canEdit && 'pointer-events-none opacity-70')}>
              {/* Shuttle */}
              {sport.hasEquipment && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('shuttle_mode_title')}</p>
                  <Field label={t('shuttle_mode_title')} icon={Package}>
                    <Segmented
                      value={form.shuttle_mode}
                      onChange={(v) => setForm((f) => ({ ...f, shuttle_mode: v }))}
                      disabled={!canEdit}
                      options={[
                        { value: 'estimate', label: t('shuttle_mode_estimate') },
                        { value: 'inventory', label: t('shuttle_mode_inventory') },
                      ]}
                    />
                  </Field>
                  <p className="text-xs text-slate-400 italic -mt-2">
                    {form.shuttle_mode === 'estimate' ? t('shuttle_mode_estimate_hint') : t('shuttle_mode_inventory_hint')}
                  </p>

                  {form.shuttle_mode === 'estimate' ? (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('set_box_price')} icon={Coins} hint={t('set_box_hint')}>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              className={cx(inputCls, 'pr-10 font-mono')}
                              value={fmtInputNum(form.price_per_box)}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => ({ ...f, price_per_box: parseInputNum(e.target.value) }))}
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                              ₫
                            </span>
                          </div>
                        </Field>
                        <Field label={t('set_shuttle')} icon={Package} hint={t('set_shuttle_hint')}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className={cx(inputCls, 'font-mono')}
                            value={form.estimated_shuttlecocks ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, estimated_shuttlecocks: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label={t('shuttle_cycle')}
                          icon={RefreshCw}
                          hint={cycleLabelShort(parseInt(form.shuttle_cycle_months, 10) || 1, i18n.language)}
                        >
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="12"
                              className={cx(inputCls, 'pr-16 font-mono')}
                              value={form.shuttle_cycle_months}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => ({ ...f, shuttle_cycle_months: e.target.value }))}
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                              tháng
                            </span>
                          </div>
                        </Field>
                        {parseInt(form.shuttle_cycle_months, 10) > 1 && (
                          <Field label={t('shuttle_cycle_start')} icon={Calendar}>
                            <select
                              className={inputCls}
                              value={form.shuttle_cycle_start_month}
                              disabled={!canEdit}
                              onChange={(e) => setForm((f) => ({ ...f, shuttle_cycle_start_month: e.target.value }))}
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>
                                  {monthName(m, i18n.language)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade-in space-y-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('shuttle_stock')} icon={Package} hint={t('shuttle_stock_hint')}>
                          <input
                            type="number"
                            min="0"
                            className={cx(inputCls, 'font-mono')}
                            value={form.shuttle_stock ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, shuttle_stock: e.target.value }))}
                          />
                        </Field>
                        <Field label={t('set_shuttle_inventory')} icon={Package} hint={t('set_shuttle_inventory_hint')}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className={cx(inputCls, 'font-mono')}
                            value={form.estimated_shuttlecocks ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, estimated_shuttlecocks: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <Field label={t('set_box_price')} icon={Coins} hint="Giá nhập hộp cầu — dùng khi cần tính chi phí nhập thêm">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            className={cx(inputCls, 'pr-10 font-mono')}
                            value={fmtInputNum(form.price_per_box)}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, price_per_box: parseInputNum(e.target.value) }))}
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                            ₫
                          </span>
                        </div>
                      </Field>
                      {canEdit && (
                        <Button variant="subtle" size="sm" onClick={() => setRestockOpen((v) => !v)}>
                          <Plus className="h-4 w-4" /> {t('shuttle_restock')}
                        </Button>
                      )}
                      {restockOpen && canEdit && (
                        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 space-y-3 animate-fade-in">
                          <p className="text-xs font-semibold text-slate-600">{t('shuttle_restock')}</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="number"
                              min="1"
                              className={cx(inputCls, 'font-mono bg-white')}
                              placeholder={t('shuttle_restock_boxes')}
                              value={restockBoxes}
                              onChange={(e) => setRestockBoxes(e.target.value)}
                            />
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                className={cx(inputCls, 'pr-10 font-mono bg-white')}
                                placeholder={t('shuttle_restock_price')}
                                value={fmtInputNum(restockPrice)}
                                onChange={(e) => setRestockPrice(parseInputNum(e.target.value))}
                              />
                              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                                ₫
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="volt" size="sm" className="flex-1" onClick={submitRestock} disabled={restockBusy || !restockBoxes}>
                              {restockBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="h-4 w-4" /> {t('shuttle_restock_submit')}
                                </>
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setRestockOpen(false)}>
                              {t('cancel')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Fund */}
              <div>
                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <Wallet className="w-4 h-4 text-slate-400" />
                    {t('set_fund')}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setTopUpOpen((v) => !v)}
                        className="ml-auto flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-bold text-slate-900 hover:bg-lime-300 transition"
                      >
                        <Plus className="h-3 w-3" /> {t('fund_topup_btn')}
                      </button>
                    )}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      className={cx(inputCls, 'pr-10 font-mono')}
                      value={fmtInputNum(form.current_fund)}
                      disabled={!canEdit}
                      onChange={(e) => setForm((f) => ({ ...f, current_fund: parseInputNum(e.target.value) }))}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                  </div>
                </label>
                {topUpOpen && canEdit && (
                  <div className="mt-2 rounded-2xl border border-lime-200 bg-lime-50 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-semibold text-slate-600">{t('fund_topup_title')}</p>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={cx(inputCls, 'pr-10 font-mono bg-white')}
                        placeholder={t('fund_topup_amount_ph')}
                        value={fmtInputNum(topUpAmount)}
                        autoFocus
                        onChange={(e) => setTopUpAmount(parseInputNum(e.target.value))}
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                    </div>
                    <input
                      className={cx(inputCls, 'bg-white')}
                      placeholder={t('fund_topup_note_ph')}
                      value={topUpNote}
                      onChange={(e) => setTopUpNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="volt" size="sm" className="flex-1" onClick={submitTopUp} disabled={topUpBusy || !topUpAmount}>
                        {topUpBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> {t('fund_topup_submit')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTopUpOpen(false)
                          setTopUpAmount('')
                          setTopUpNote('')
                        }}
                      >
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                )}
                {isFirstSetup && slots.length > 0 && form.price_per_box > 0 && form.estimated_shuttlecocks > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-bold text-amber-800">{t('fund_setup_title')}</p>
                    {actualSpent > 0 && <p className="text-xs text-amber-700">{t('fund_setup_hint', { amount: fmtVND(actualSpent) })}</p>}
                    <div className="space-y-2">
                      {[
                        { val: 'from_now', labelKey: 'fund_setup_from_now', hintKey: 'fund_setup_from_now_hint' },
                        { val: 'from_start', labelKey: 'fund_setup_from_start', hintKey: 'fund_setup_from_start_hint' },
                      ].map(({ val, labelKey, hintKey }) => (
                        <button
                          key={val}
                          onClick={() => setFundSetupMode(val)}
                          className={cx(
                            'w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.98]',
                            fundSetupMode === val ? 'border-amber-400 bg-white' : 'border-amber-200 bg-white/60 hover:border-amber-300'
                          )}
                        >
                          <span
                            className={cx(
                              'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition',
                              fundSetupMode === val ? 'border-amber-500 bg-amber-500' : 'border-amber-300'
                            )}
                          >
                            {fundSetupMode === val && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{t(labelKey)}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{t(hintKey)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fee split */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t('fee_split_title')}</p>
                <Field label={t('fee_split_title')} icon={UserCheck} hint={t('fee_split_hint')}>
                  <Segmented
                    value={form.fee_split_mode}
                    onChange={(v) => setForm((f) => ({ ...f, fee_split_mode: v }))}
                    disabled={!canEdit}
                    options={[
                      { value: 'committed_only', label: t('fee_split_committed') },
                      { value: 'total_members', label: t('fee_split_total') },
                    ]}
                  />
                </Field>
                <p className="mt-2 text-xs text-slate-400 italic">
                  {form.fee_split_mode === 'committed_only' ? t('fee_split_committed_hint') : t('fee_split_total_hint')}
                </p>
              </div>

              {/* Cycle vote settings */}
              {(() => {
                const { minMonths } = computeMembershipVoteCycle(slots, form)
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t('set_cycle_vote_title')}</p>
                    <div className="space-y-4">
                      <Field label={t('set_fixed_cycle_months')} icon={Calendar} hint={t('set_fixed_cycle_months_hint', { min: minMonths })}>
                        <input
                          type="number"
                          min={minMonths}
                          step="1"
                          className={inputCls}
                          value={form.fixed_cycle_months}
                          disabled={!canEdit}
                          placeholder={String(minMonths)}
                          onChange={(e) => setForm((f) => ({ ...f, fixed_cycle_months: e.target.value }))}
                        />
                      </Field>
                    </div>
                  </div>
                )
              })()}

              {/* Guest fee */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t('set_guest_mode')}</p>
                <Field label={t('set_guest_mode')} icon={Users}>
                  <Segmented
                    value={form.guest_fee_mode}
                    onChange={(v) => setForm((f) => ({ ...f, guest_fee_mode: v }))}
                    disabled={!canEdit}
                    options={[
                      { value: 'split_all', label: t('set_guest_mode_split') },
                      { value: 'fixed_by_gender', label: t('set_guest_mode_fixed') },
                      { value: 'split_shuttle', label: t('set_guest_mode_shuttle') },
                    ]}
                  />
                </Field>
                <p className="mt-2 text-xs text-slate-400 italic">
                  {form.guest_fee_mode === 'fixed_by_gender' && t('set_guest_fee_mode_hint_fixed')}
                  {form.guest_fee_mode === 'split_shuttle' && t('set_guest_fee_mode_hint_shuttle')}
                  {form.guest_fee_mode === 'split_all' && t('set_guest_fee_mode_hint_split')}
                </p>
                {(form.guest_fee_mode === 'fixed_by_gender' || form.guest_fee_mode === 'split_shuttle') && (
                  <div className="grid gap-4 sm:grid-cols-2 mt-4 animate-fade-in">
                    {form.guest_fee_mode === 'fixed_by_gender' && (
                      <Field label={t('set_guest_fee_male')} icon={Coins}>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            className={cx(inputCls, 'pr-10 font-mono')}
                            value={fmtInputNum(form.guest_fee_male)}
                            disabled={!canEdit}
                            onChange={(e) => setForm((f) => ({ ...f, guest_fee_male: parseInputNum(e.target.value) }))}
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                            ₫
                          </span>
                        </div>
                      </Field>
                    )}
                    <Field label={t('set_guest_fee_female')} icon={Coins}>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          className={cx(inputCls, 'pr-10 font-mono')}
                          value={fmtInputNum(form.guest_fee_female)}
                          disabled={!canEdit}
                          onChange={(e) => setForm((f) => ({ ...f, guest_fee_female: parseInputNum(e.target.value) }))}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₫</span>
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {canEdit && (
            <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> {t('saving')}
                </>
              ) : (
                <>
                  {t('save')} <Check className="h-5 w-5 text-lime-400" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">
          <Card>
            <div className={cardTitleCls}>
              <TrendingUp className="h-5 w-5 text-slate-400" />
              <span>{t('set_cost_preview_title')}</span>
            </div>
            <p className="mt-1 mb-4 text-xs text-slate-500">{t('set_cost_preview_sub')}</p>
            {!livePreview ? (
              <p className="text-sm text-slate-400 text-center py-4">{t('slot_empty')}</p>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('timeline_court_cost')}</span>
                  <span className="font-mono font-semibold text-slate-900">{fmtVND(livePreview.totalCourtCost)}</span>
                </div>
                {sport.hasEquipment && (
                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-slate-500 shrink-0">{t('set_cost_shuttle')}</span>
                    <span className="text-right">
                      {livePreview.shuttleLabel && <span className="block text-xs font-semibold text-cyan-700">{livePreview.shuttleLabel}</span>}
                      {livePreview.shuttleCost > 0 && (
                        <span className="font-mono font-semibold text-slate-900">{fmtVND(livePreview.shuttleCost)}</span>
                      )}
                      {livePreview.shuttleLabel && livePreview.shuttleCost === 0 && <span className="font-mono font-semibold text-slate-400">—</span>}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between">
                  <span className="text-sm font-bold text-slate-800">{t('set_cost_total')}</span>
                  <span className="font-mono text-base font-black text-slate-900">{fmtVND(livePreview.totalCost)}</span>
                </div>
                {livePreview.effective > 0 && (
                  <div className="flex justify-between rounded-xl bg-lime-400/20 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {t('set_cost_per_member')} ({livePreview.effective} {t('members')})
                    </span>
                    <span className="font-mono text-sm font-black text-slate-900">{fmtVND(livePreview.perMember)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          <MembersPanel
            club={club}
            members={members}
            plan={plan}
            pollTally={pollTally}
            hostName={hostName}
            hostAvatar={hostAvatar}
            currentUserId={currentUserId}
            canEdit={canEdit}
            onChanged={reload}
            onHitLimit={openUpsell}
            toast={toast}
          />

          <PayOSSettings club={club} plan={plan} payosConfig={payosConfig} canEdit={canEdit} onChanged={reload} toast={toast} onUnlock={() => {}} />
        </div>
      </div>

      {editingSlot !== null && <CourtSlotModal slot={editingSlot?.id ? editingSlot : null} onSave={saveSlot} onClose={() => setEditingSlot(null)} />}
    </>
  )
}
