export function handleError(e, toast, t) {
  toast(e?.message || t('err_generic'))
}
