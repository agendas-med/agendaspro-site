import { ref } from 'vue'

const KEY = 'ap_attr_v1'
const label = ref('')

/** Captura utm_* da URL (uma vez por sessão) e mantém em sessionStorage. Só no cliente. */
export function captureAttribution() {
  try {
    const q = new URLSearchParams(window.location.search)
    const fromUrl = ['utm_source', 'utm_medium', 'utm_campaign']
      .map((k) => (q.get(k) || '').slice(0, 40).replace(/[^\w.-]/g, ''))
      .filter(Boolean)
    if (fromUrl.length) window.sessionStorage.setItem(KEY, fromUrl.join('/'))
    label.value = window.sessionStorage.getItem(KEY) || ''
  } catch {
    label.value = ''
  }
}

/** Ref reativa: "google/cpc/campanha" ou vazio. */
export const useAttribution = () => label
