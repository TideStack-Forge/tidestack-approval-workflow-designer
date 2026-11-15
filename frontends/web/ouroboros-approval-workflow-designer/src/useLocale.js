import { useSyncExternalStore } from 'react'
import { i18n } from 'ouroboros-sdk'

export function useLocale() {
  return useSyncExternalStore(
    (notify) => i18n.onLocaleChange(notify),
    () => i18n.getLocale(),
    () => i18n.getLocale()
  )
}
