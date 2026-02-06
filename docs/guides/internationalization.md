# Internationalization

This guide covers patterns for building multi-language EreoJS applications, including locale detection, translation loading, and locale switching.

## Locale Detection

Detect the user's preferred locale from the URL path prefix or the `Accept-Language` header.

### URL Prefix Strategy

Use a route group with a dynamic segment for the locale:

```
routes/
├── [locale]/
│   ├── _layout.tsx
│   ├── index.tsx
│   └── about.tsx
```

```ts
// routes/[locale]/_layout.tsx
import { createLoader, redirect } from '@ereo/data'

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja']
const DEFAULT_LOCALE = 'en'

export const loader = createLoader(async ({ params, request }) => {
  const locale = params.locale

  // Redirect unsupported locales to the default
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return redirect(`/${DEFAULT_LOCALE}`)
  }

  const translations = await loadTranslations(locale)
  return { locale, translations }
})

export default function LocaleLayout({ children, loaderData }) {
  const { locale, translations } = loaderData

  return (
    <html lang={locale} dir={locale === 'ar' || locale === 'he' ? 'rtl' : 'ltr'}>
      <head>
        <title>{translations.siteTitle}</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Accept-Language Detection

Redirect users to their preferred locale on the root route:

```ts
// routes/index.tsx
import { createLoader, redirect } from '@ereo/data'

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja']
const DEFAULT_LOCALE = 'en'

export const loader = createLoader(async ({ request }) => {
  const acceptLanguage = request.headers.get('Accept-Language') || ''

  // Parse the Accept-Language header
  const preferred = acceptLanguage
    .split(',')
    .map((part) => part.trim().split(';')[0])
    .map((lang) => lang.split('-')[0]) // 'en-US' -> 'en'
    .find((lang) => SUPPORTED_LOCALES.includes(lang))

  const locale = preferred || DEFAULT_LOCALE
  return redirect(`/${locale}`)
})
```

## Loading Translations

Store translations as JSON files and load them in your route loaders:

```
locales/
├── en.json
├── es.json
└── fr.json
```

```json
// locales/en.json
{
  "siteTitle": "My App",
  "nav.home": "Home",
  "nav.about": "About",
  "greeting": "Hello, {name}!"
}
```

```ts
// lib/i18n.ts
const translationCache = new Map<string, Record<string, string>>()

export async function loadTranslations(locale: string) {
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!
  }

  const file = Bun.file(`./locales/${locale}.json`)
  const translations = await file.json()
  translationCache.set(locale, translations)
  return translations
}

export function t(
  translations: Record<string, string>,
  key: string,
  params?: Record<string, string>
) {
  let value = translations[key] || key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, v)
    }
  }
  return value
}
```

### Using Translations in Components

```tsx
// routes/[locale]/index.tsx
import { t } from '../../lib/i18n'

export default function Home({ loaderData }) {
  const { translations, locale } = loaderData

  return (
    <div>
      <h1>{t(translations, 'greeting', { name: 'World' })}</h1>
      <nav>
        <a href={`/${locale}`}>{t(translations, 'nav.home')}</a>
        <a href={`/${locale}/about`}>{t(translations, 'nav.about')}</a>
      </nav>
    </div>
  )
}
```

## Switching Locales

Add a locale switcher that preserves the current path:

```tsx
function LocaleSwitcher({ currentLocale, currentPath }) {
  const locales = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Espanol' },
    { code: 'fr', label: 'Francais' },
  ]

  // Replace the locale prefix in the current path
  const pathWithoutLocale = currentPath.replace(`/${currentLocale}`, '') || '/'

  return (
    <nav aria-label="Language">
      {locales.map(({ code, label }) => (
        <a
          key={code}
          href={`/${code}${pathWithoutLocale}`}
          aria-current={code === currentLocale ? 'true' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
```

## Right-to-Left Support

Set the `dir` attribute based on the locale:

```tsx
const RTL_LOCALES = ['ar', 'he', 'fa', 'ur']

export default function LocaleLayout({ children, loaderData }) {
  const { locale } = loaderData
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  )
}
```

Pair this with CSS logical properties for layouts that work in both directions:

```css
.sidebar {
  /* Use logical properties instead of left/right */
  margin-inline-start: 1rem;
  padding-inline-end: 1rem;
  border-inline-end: 1px solid #e5e7eb;
}
```

## Date and Number Formatting

Use the `Intl` APIs for locale-aware formatting:

```tsx
function FormattedDate({ date, locale }) {
  const formatted = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))

  return <time dateTime={date}>{formatted}</time>
}

function FormattedPrice({ amount, currency, locale }) {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)

  return <span>{formatted}</span>
}
```

## Related

- [Routing](/concepts/routing) -- Dynamic route segments and layouts
- [Data Loading](/concepts/data-loading) -- Loaders for server-side data fetching
- [SEO](/guides/seo) -- Setting the `lang` attribute and locale-specific meta tags
