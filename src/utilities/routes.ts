// The public address of every dashboard tool, in Chinese, English and Polish. This is
// the one place that maps a tool id to its URL: the app's router (src/lib/route.ts),
// the static page generator (src/seo) and the sitemap all read it. Plain data, so the
// build can import it without React.
//
// Chinese is the default language, so it lives at the root: /merge-pdf is the Chinese
// page and /en/merge-pdf the English one. The Chinese slugs are the English ones, so a
// link keeps working when a reader switches language on the same page.
//
// The slugs are public links (search results, README, bookmarks): don't change them.

export const TOOL_SLUGS = {
  edit: { zh: 'edit-pdf', en: 'edit-pdf', pl: 'edytuj-pdf' },
  sign: { zh: 'sign-pdf', en: 'sign-pdf', pl: 'podpisz-pdf' },
  'fill-form': { zh: 'fill-pdf-form', en: 'fill-pdf-form', pl: 'wypelnij-formularz-pdf' },
  'page-numbers': { zh: 'add-page-numbers-to-pdf', en: 'add-page-numbers-to-pdf', pl: 'numeracja-stron-pdf' },
  watermark: { zh: 'watermark-pdf', en: 'watermark-pdf', pl: 'znak-wodny-pdf' },
  metadata: { zh: 'edit-pdf-metadata', en: 'edit-pdf-metadata', pl: 'edytuj-metadane-pdf' },
  merge: { zh: 'merge-pdf', en: 'merge-pdf', pl: 'polacz-pdf' },
  split: { zh: 'split-pdf', en: 'split-pdf', pl: 'podziel-pdf' },
  organize: { zh: 'organize-pdf-pages', en: 'organize-pdf-pages', pl: 'zmien-kolejnosc-stron-pdf' },
  rotate: { zh: 'rotate-pdf', en: 'rotate-pdf', pl: 'obroc-pdf' },
  compress: { zh: 'compress-pdf', en: 'compress-pdf', pl: 'kompresuj-pdf' },
  ocr: { zh: 'ocr-pdf', en: 'ocr-pdf', pl: 'ocr-pdf' },
  'images-to-pdf': { zh: 'image-to-pdf', en: 'image-to-pdf', pl: 'jpg-do-pdf' },
  'pdf-to-images': { zh: 'pdf-to-jpg', en: 'pdf-to-jpg', pl: 'pdf-do-jpg' },
  'pdf-to-text': { zh: 'pdf-to-text', en: 'pdf-to-text', pl: 'pdf-do-tekstu' },
  'pdf-to-word': { zh: 'pdf-to-word', en: 'pdf-to-word', pl: 'pdf-do-word' },
  'word-to-pdf': { zh: 'word-to-pdf', en: 'word-to-pdf', pl: 'word-do-pdf' },
  protect: { zh: 'protect-pdf', en: 'protect-pdf', pl: 'zabezpiecz-pdf-haslem' },
  unlock: { zh: 'unlock-pdf', en: 'unlock-pdf', pl: 'odblokuj-pdf' },
  redact: { zh: 'redact-pdf', en: 'redact-pdf', pl: 'anonimizuj-pdf' },
  compare: { zh: 'compare-pdf', en: 'compare-pdf', pl: 'porownaj-pdf' },
  'image-converter': { zh: 'image-converter', en: 'image-converter', pl: 'kompresuj-zdjecia' },
  'remove-background': { zh: 'remove-background', en: 'remove-background', pl: 'usun-tlo' },
  'heic-to-jpg': { zh: 'heic-to-jpg', en: 'heic-to-jpg', pl: 'heic-do-jpg' },
  qr: { zh: 'qr-code-generator', en: 'qr-code-generator', pl: 'generator-kodow-qr' },
} as const satisfies Record<string, Record<Lang, string>>;

export type ToolId = keyof typeof TOOL_SLUGS;
export type Lang = 'zh' | 'en' | 'pl';

export const TOOL_IDS = Object.keys(TOOL_SLUGS) as ToolId[];

/** Path of the home page in a language: "/", "/en/" or "/pl/". */
export const homePath = (lang: Lang) => (lang === 'zh' ? '/' : lang === 'pl' ? '/pl/' : '/en/');

/** Path of a tool's page: "/merge-pdf", "/en/merge-pdf" or "/pl/polacz-pdf". */
export const toolPath = (id: ToolId, lang: Lang) =>
  lang === 'zh' ? `/${TOOL_SLUGS[id].zh}` : lang === 'pl' ? `/pl/${TOOL_SLUGS[id].pl}` : `/en/${TOOL_SLUGS[id].en}`;

/**
 * Path of the page that lists the guides: "/guides", "/en/guides" or "/pl/poradniki". The
 * guides themselves live under "/guides/", "/en/guides/" and "/pl/poradnik/"
 * (src/seo/guides.ts); this is the one page that gathers them, so a reader or a crawler
 * can reach any guide from any page.
 */
export const guidesPath = (lang: Lang) => (lang === 'zh' ? '/guides' : lang === 'pl' ? '/pl/poradniki' : '/en/guides');

/** The language an address names, for pages that aren't tools too (guides, 404). */
export function langFromPath(pathname: string): Lang {
  const p = pathname.toLowerCase();
  if (p === '/en' || p.startsWith('/en/')) return 'en';
  if (p === '/pl' || p.startsWith('/pl/')) return 'pl';
  return 'zh';
}

/** The page a path names, or null if it isn't one. Accepts a trailing slash and any letter case. */
export function parsePath(pathname: string): { tool: ToolId | null; lang: Lang } | null {
  let p = pathname.toLowerCase().replace(/\/index\.html$/, '/');
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
  if (p === '') return { tool: null, lang: 'zh' };
  if (p === '/') return { tool: null, lang: 'zh' };
  if (p === '/en') return { tool: null, lang: 'en' };
  if (p === '/pl') return { tool: null, lang: 'pl' };
  const lang = langFromPath(p);
  const slug = lang === 'zh' ? p.slice(1) : p.slice(4);
  const tool = TOOL_IDS.find((id) => TOOL_SLUGS[id][lang] === slug);
  return tool ? { tool, lang } : null;
}
