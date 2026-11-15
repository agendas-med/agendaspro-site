import { useHead } from '@unhead/vue'
import { env } from '../config/env.js'

export const SITE_NAME = 'AgendasPro'
export const OG_IMAGE_PATH = '/og-image.png'

/**
 * Title/description/canonical/OG/Twitter (+ JSON-LD opcional) por página.
 * @param {{title:string, description:string, path?:string, noindex?:boolean, jsonLd?:object|object[], image?:string}} o
 */
export function useSeo({ title, description, path, noindex = false, jsonLd, image }) {
  const url = path ? `${env.siteUrl}${path === '/' ? '/' : path}` : undefined
  const img = `${env.siteUrl}${image || OG_IMAGE_PATH}`
  const ld = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []
  useHead({
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'pt_BR' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: img },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      ...(url ? [{ property: 'og:url', content: url }] : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: img },
    ],
    link: url ? [{ rel: 'canonical', href: url }] : [],
    script: ld.map((o, i) => ({
      key: `ld-${i}`,
      type: 'application/ld+json',
      // dados estáticos controlados por nós; "<" escapado por segurança
      innerHTML: JSON.stringify(o).replace(/</g, '\\u003c'),
    })),
  })
}

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: env.siteUrl,
  logo: `${env.siteUrl}/logo-mark.svg`,
})

export const faqLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((i) => ({
    '@type': 'Question',
    name: i.q,
    acceptedAnswer: { '@type': 'Answer', text: i.a },
  })),
})

export const softwareLd = (premiumPriceCents) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'pt-BR',
  url: env.siteUrl,
  description:
    'Software de agendamento online para negócios de serviços, com página pública, lembretes no WhatsApp e cobrança de sinal por Pix.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'BRL' },
    {
      '@type': 'Offer',
      name: 'Premium',
      price: (premiumPriceCents / 100).toFixed(2),
      priceCurrency: 'BRL',
    },
  ],
})
