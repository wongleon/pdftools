// Builds the static pages search engines index: one per tool and language
// (/merge-pdf is Chinese, /en/merge-pdf English, /pl/polacz-pdf Polish), the home
// pages (/, /en/, /pl/), the guides (/guides/check-pdf-redaction;
// see guides.ts), the guides index (/guides, /en/guides, /pl/poradniki),
// the 404 page and the sitemap. Each page is the built index.html with its own title,
// description, canonical URL, hreflang links, structured data and crawlable fallback
// content; the app loads on top and opens the tool. Run at build time by vite.config.ts;
// pure string functions, no Node or browser APIs.
import { COMMON, GUIDES_INDEX, HOME_PL, HOME_ZH, TOOL_COPY, TOOL_PAGES, type PageCopy } from './content.ts';
import { GUIDES, guidesFor, type Block, type Guide } from './guides.ts';
import { guidesPath, homePath, TOOL_IDS, toolPath, type Lang, type ToolId } from '../utilities/routes.ts';

export const SITE = 'https://tools.nyxiontech.com';
const ORG_ID = 'https://nyxiontech.com/#organization';
const WEBSITE_ID = `${SITE}/#website`;
const REPO = 'https://github.com/jurecki007/nyxiontech-tools';

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;

/** Every language the site is published in; Chinese is the default. */
const LANGS: Lang[] = ['zh', 'en', 'pl'];

/** The other language a page links to in its footer. */
const otherLang = (lang: Lang): Lang => (lang === 'zh' ? 'en' : lang === 'en' ? 'zh' : 'en');

/** How each language names itself in a language link. */
const LANG_LABEL: Record<Lang, string> = { zh: '中文', en: 'English', pl: 'Polski' };

/** The Windows desktop app link in a home page footer. */
const WINDOWS_APP: Record<Lang, string> = { zh: 'Windows 应用', en: 'Windows app', pl: 'Aplikacja na Windows' };

const OG_LOCALE: Record<Lang, string> = { zh: 'zh_CN', en: 'en_US', pl: 'pl_PL' };

/** The "this app needs JavaScript" line, swapped into the noscript block. */
const NOSCRIPT: Record<Lang, string> = {
  zh: '此应用需要启用 JavaScript 才能运行。所有处理都在你的设备上完成。',
  en: 'This app needs JavaScript. Everything runs on your device.',
  pl: 'Ta aplikacja wymaga JavaScriptu. Wszystko działa na Twoim urządzeniu.',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (path: string) => SITE + path;

/**
 * The social card a page shows when its address is pasted into a chat or a post.
 * Every page has its own, generated from this name by `scripts/build-og-images.mjs`
 * and committed to `public/og/`. The English pages reuse the card of the same page in
 * Chinese, and the Chinese home page keeps the hand-made card.
 */
const ogImageName = (path: string) => path.replace(/^\/en(?=\/)/, '').replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
export const ogImage = (path: string) => (path === '/' || path === '/en/' ? `${SITE}/og-image.png` : `${SITE}/og/${ogImageName(path)}.png`);

/** hreflang links for a page that exists in every language. */
function alternates(paths: Record<Lang, string>) {
  return [
    `<link rel="alternate" hreflang="zh-CN" href="${url(paths.zh)}" />`,
    `<link rel="alternate" hreflang="en" href="${url(paths.en)}" />`,
    `<link rel="alternate" hreflang="pl" href="${url(paths.pl)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${url(paths.zh)}" />`,
  ].join('\n    ');
}

/** Head tags the home pages get: their hreflang links. */
export const homeAlternates = () => alternates({ zh: homePath('zh'), en: homePath('en'), pl: homePath('pl') });

/** The list of links to every tool page, for a home page's fallback content. */
export function toolLinks(lang: Lang) {
  const items = TOOL_IDS.map((id) => `<li><a href="${toolPath(id, lang)}">${esc(TOOL_COPY[lang][id].name)}</a></li>`);
  return `<ul>\n          ${items.join('\n          ')}\n        </ul>`;
}

/** Replaces exactly one match, so a changed index.html fails the build instead of producing a broken page. */
function swap(html: string, pattern: RegExp, replacement: string | ((...groups: string[]) => string), what: string): string {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'));
  if (matches?.length !== 1) throw new Error(`seo pages: expected one ${what} in index.html, found ${matches?.length ?? 0}`);
  return html.replace(pattern, typeof replacement === 'function' ? replacement : () => replacement);
}

interface Head {
  lang: Lang;
  title: string;
  description: string;
  path: string;
  /** hreflang tags; null removes them. */
  alternates: string | null;
  jsonLd: object | null;
  /** Content of the fallback <main>. */
  body: string;
  robots?: string;
}

/** Rewrites the built index.html into another page. */
function render(template: string, h: Head): string {
  let html = template;
  html = swap(html, /<html lang="[^"]*">/, `<html lang="${h.lang}">`, '<html lang>');
  html = swap(html, /<title>[^<]*<\/title>/, `<title>${esc(h.title)}</title>`, '<title>');
  html = swap(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(h.description)}" />`, 'meta description');
  if (h.robots) html = swap(html, /<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${h.robots}" />`, 'meta robots');
  html = swap(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url(h.path)}" />`, 'canonical link');
  html = swap(html, /(\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>)+/, h.alternates ? `\n    ${h.alternates}` : '', 'hreflang links');
  for (const [attr, value] of [
    ['property="og:title"', h.title],
    ['property="og:description"', h.description],
    ['property="og:url"', url(h.path)],
    ['property="og:image"', ogImage(h.path)],
    ['property="og:image:alt"', h.title],
    ['name="twitter:title"', h.title],
    ['name="twitter:description"', h.description],
    ['name="twitter:image"', ogImage(h.path)],
  ]) {
    html = swap(html, new RegExp(`<meta ${attr} content="[^"]*" />`), `<meta ${attr} content="${esc(value)}" />`, attr);
  }
  const locale = OG_LOCALE[h.lang];
  const others = LANGS.filter((l) => l !== h.lang).map((l) => OG_LOCALE[l]);
  html = swap(
    html,
    /<meta property="og:locale" content="[^"]*" \/>/,
    `<meta property="og:locale" content="${locale}" />\n    ${others.map((l) => `<meta property="og:locale:alternate" content="${l}" />`).join('\n    ')}`,
    'og:locale',
  );
  // A data block, not a script: "<" is escaped so the text can never close the tag.
  const ld = h.jsonLd ? `<script type="application/ld+json">\n${JSON.stringify(h.jsonLd, null, 2).replace(/</g, '\\u003c')}\n    </script>` : '';
  html = swap(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, ld, 'JSON-LD block');
  html = swap(html, /(<main class="boot-fallback"[^>]*>)[\s\S]*?(<noscript>[\s\S]*?<\/noscript>\s*<\/main>)/, (_, open: string, tail: string) => `${open}\n${h.body}\n        ${tail}`, 'fallback <main>');
  html = html.replace(/<noscript><p>[^<]*<\/p>/, `<noscript><p>${NOSCRIPT[h.lang]}</p>`);
  return html;
}

const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'Nyxiontech',
  url: 'https://nyxiontech.com',
  logo: `${SITE}/icon-512.png`,
  // Directories of European software decline a product whose country of origin they
  // cannot establish from a public source. Country only: no address, no registration data.
  address: { '@type': 'PostalAddress', addressCountry: 'PL' },
};
const website = { '@type': 'WebSite', '@id': WEBSITE_ID, name: 'Nyxiontech PDF Tools', url: `${SITE}/`, publisher: { '@id': ORG_ID } };

const faqLd = (id: string, faq: [string, string][]) => ({
  '@type': 'FAQPage',
  '@id': id,
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

const IMAGE_TOOLS: ToolId[] = ['image-converter', 'remove-background', 'heic-to-jpg', 'qr'];

function toolJsonLd(id: ToolId, lang: Lang, copy: PageCopy, faq: [string, string][]) {
  const pageUrl = url(toolPath(id, lang));
  const c = COMMON[lang];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: copy.title,
        description: copy.description,
        inLanguage: lang,
        isPartOf: { '@id': WEBSITE_ID },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        mainEntity: { '@id': `${pageUrl}#app` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${pageUrl}#app`,
        name: copy.name,
        url: pageUrl,
        description: copy.description,
        applicationCategory: IMAGE_TOOLS.includes(id) ? 'MultimediaApplication' : 'BusinessApplication',
        operatingSystem: 'Any (web browser), Windows 10, Windows 11',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        license: 'https://www.gnu.org/licenses/agpl-3.0.html',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: c.home, item: url(homePath(lang)) },
          { '@type': 'ListItem', position: 2, name: copy.name, item: pageUrl },
        ],
      },
      faqLd(`${pageUrl}#faq`, faq),
    ],
  };
}

const IND = '          ';
const list = (tag: 'ul' | 'ol', items: string[]) => `${IND}<${tag}>\n${items.map((i) => `${IND}  <li>${i}</li>`).join('\n')}\n${IND}</${tag}>`;
const faqHtml = (faq: [string, string][]) => faq.map(([q, a]) => `${IND}<h3>${esc(q)}</h3>\n${IND}<p>${esc(a)}</p>`).join('\n');

function toolBody(id: ToolId, lang: Lang, copy: PageCopy, faq: [string, string][]) {
  const c = COMMON[lang];
  const other = otherLang(lang);
  const related = TOOL_PAGES[id].related.map((r) => `<a href="${toolPath(r, lang)}">${esc(TOOL_COPY[lang][r].name)}</a>`);
  return [
    `${IND}<p><a href="${homePath(lang)}">${esc(c.home)}</a> › ${esc(copy.name)}</p>`,
    `${IND}<h1>${esc(copy.h1)}</h1>`,
    ...copy.intro.map((p) => `${IND}<p>${esc(p)}</p>`),
    `${IND}<h2>${esc(c.howTo)}</h2>`,
    list('ol', copy.steps.map(esc)),
    `${IND}<h2>${esc(c.faq)}</h2>`,
    faqHtml(faq),
    ...guidesFor(id, lang).map((g) => `${IND}<p><a href="${g.path}">${esc(g.name)}</a></p>`),
    `${IND}<h2>${esc(c.related)}</h2>`,
    list('ul', related),
    `${IND}<p><a href="${homePath(lang)}">${esc(c.allTools)}</a> · <a href="${guidesPath(lang)}">${esc(c.guides)}</a> · <a href="${toolPath(id, other)}" hreflang="${other}" lang="${other}">${esc(LANG_LABEL[other])}</a> · <a href="${REPO}">${esc(c.source)}</a></p>`,
    `${IND}<p>${esc(c.footer)}</p>`,
  ].join('\n');
}

/** Inline markup of guide text: `code`, **bold**, [label](href); everything else escaped. */
function inline(text: string): string {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
      href.startsWith('http') ? `<a href="${href}" rel="noopener">${label}</a>` : `<a href="${href}">${label}</a>`,
    );
}

function blockHtml(b: Block): string {
  if ('h2' in b) return `${IND}<h2>${inline(b.h2)}</h2>`;
  if ('p' in b) return `${IND}<p>${inline(b.p)}</p>`;
  if ('ul' in b) return list('ul', b.ul.map(inline));
  if ('ol' in b) return list('ol', b.ol.map(inline));
  return `${IND}<pre><code>${esc(b.pre)}</code></pre>`;
}

/** Plain text of a guide's body, for the word count in its structured data. */
const guideText = (g: Guide) =>
  g.blocks
    .flatMap((b) => ('h2' in b ? [b.h2] : 'p' in b ? [b.p] : 'ul' in b ? b.ul : 'ol' in b ? b.ol : [b.pre]))
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '');

export const guideWords = (g: Guide) => guideText(g).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// Guides are articles, not the app: no app script or stylesheet, and the content is
// visible at once. Light and dark colours follow the system, like the app.
const GUIDE_STYLE = `<style>
      :root { color-scheme: light dark; --fg: #14171c; --muted: #5b6270; --bg: #ffffff; --soft: #f2f4f7; --line: #dde1e7; --link: #1d5bd6; }
      @media (prefers-color-scheme: dark) { :root { --fg: #e8eaee; --muted: #a3a9b5; --bg: #14171c; --soft: #1f242c; --line: #2e343e; --link: #7aa7ff; } }
      html { background: var(--bg); }
      body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.6; }
      .guide { max-width: 46rem; margin: 0 auto; padding: 2rem 1rem 3rem; }
      .guide a { color: var(--link); }
      .guide .crumbs, .guide footer { color: var(--muted); font-size: 0.9rem; }
      /* The guides index: a line of description under each link. */
      .guide .note { color: var(--muted); font-size: 0.95rem; }
      .guide li:has(.note) { margin: 0.8rem 0; }
      .guide h1 { font-size: 1.9rem; line-height: 1.25; margin: 0.5rem 0 1rem; }
      .guide h2 { font-size: 1.3rem; margin: 2.2rem 0 0.6rem; }
      .guide li { margin: 0.35rem 0; }
      .guide code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.9em; background: var(--soft); padding: 0.1em 0.3em; border-radius: 4px; }
      .guide pre { background: var(--soft); border: 1px solid var(--line); border-radius: 8px; padding: 0.8rem 1rem; overflow-x: auto; }
      .guide pre code { background: none; padding: 0; }
      .guide footer { border-top: 1px solid var(--line); margin-top: 2.5rem; padding-top: 1rem; }
    </style>`;

function guidePage(template: string, g: Guide): string {
  const c = COMMON[g.lang];
  const tool = TOOL_COPY[g.lang][g.tool];
  const toolUrl = toolPath(g.tool, g.lang);
  const pageUrl = url(g.path);
  const body = [
    `${IND}<p class="crumbs"><a href="${homePath(g.lang)}">${esc(c.home)}</a> › <a href="${toolUrl}">${esc(tool.name)}</a></p>`,
    `${IND}<h1>${esc(g.h1)}</h1>`,
    ...g.blocks.map(blockHtml),
    `${IND}<footer><p><a href="${homePath(g.lang)}">${esc(c.allTools)}</a> · <a href="${guidesPath(g.lang)}">${esc(c.guides)}</a> · <a href="${REPO}">${esc(c.source)}</a> · ${esc(c.footer)}</p></footer>`,
  ].join('\n');
  let html = render(template, {
    lang: g.lang,
    title: g.title,
    description: g.description,
    path: g.path,
    alternates: null,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        organization,
        website,
        {
          '@type': 'Article',
          '@id': `${pageUrl}#article`,
          url: pageUrl,
          headline: g.h1,
          description: g.description,
          inLanguage: g.lang,
          datePublished: g.published,
          dateModified: g.published,
          wordCount: guideWords(g),
          image: `${SITE}/og-image.png`,
          author: { '@id': ORG_ID },
          publisher: { '@id': ORG_ID },
          isPartOf: { '@id': WEBSITE_ID },
          mainEntityOfPage: pageUrl,
          about: { '@id': `${url(toolUrl)}#app` },
          breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${pageUrl}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: c.home, item: url(homePath(g.lang)) },
            { '@type': 'ListItem', position: 2, name: tool.name, item: url(toolUrl) },
            { '@type': 'ListItem', position: 3, name: g.h1, item: pageUrl },
          ],
        },
      ],
    },
    body,
  });
  html = swap(html, /<meta property="og:type" content="[^"]*" \/>/, '<meta property="og:type" content="article" />', 'og:type');
  // One language only: no alternate locale either.
  html = html.replace(/\s*<meta property="og:locale:alternate" content="[^"]*" \/>/g, '');
  return asArticle(html);
}

/**
 * Turns a rendered page into a standalone article: the text is the page and the app is
 * never loaded on top of it. Used by the guides and by the page that lists them.
 */
function asArticle(html: string): string {
  html = swap(html, /\s*<script type="module"[^>]*><\/script>/, '', 'app script');
  html = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, '');
  html = swap(html, /\s*<link rel="stylesheet"[^>]*href="\/assets\/[^"]*"[^>]*>/, '', 'app stylesheet');
  html = html.replace(/\s*<!-- The fallback below[^]*?-->/, '');
  html = swap(html, /\s*<noscript>[\s\S]*?<\/noscript>/, '', '<noscript>');
  html = swap(html, /<style>[^<]*boot-fallback[^<]*<\/style>/, GUIDE_STYLE, 'boot-fallback style');
  html = swap(html, /<main class="boot-fallback"[^>]*>/, '<main class="guide">', 'fallback <main>');
  return html;
}

/**
 * The page that lists the guides, one per language (/guides, /en/guides, /pl/poradniki). An
 * article like the guides, so the app is not loaded over it, but unlike a guide it exists
 * in every language and keeps its hreflang links. Entries are grouped by the tool each
 * guide is about, in the order of the app's sidebar, so the page reads as a map of the site.
 */
function guidesIndexPage(template: string, lang: Lang): string {
  const c = COMMON[lang];
  const copy = GUIDES_INDEX[lang];
  const other = otherLang(lang);
  const path = guidesPath(lang);
  const pageUrl = url(path);
  const groups = TOOL_IDS.map((id) => ({ id, guides: GUIDES.filter((g) => g.lang === lang && g.tool === id) })).filter((g) => g.guides.length > 0);
  const listed = groups.flatMap((g) => g.guides);
  const body = [
    `${IND}<p class="crumbs"><a href="${homePath(lang)}">${esc(c.home)}</a> › ${esc(c.guides)}</p>`,
    `${IND}<h1>${esc(copy.h1)}</h1>`,
    ...copy.intro.map((p) => `${IND}<p>${esc(p)}</p>`),
    ...groups.flatMap(({ id, guides }) => [
      `${IND}<h2><a href="${toolPath(id, lang)}">${esc(TOOL_COPY[lang][id].name)}</a></h2>`,
      list(
        'ul',
        guides.map((g) => `<a href="${g.path}">${esc(g.h1)}</a><br /><span class="note">${esc(g.description)}</span>`),
      ),
    ]),
    `${IND}<footer><p><a href="${homePath(lang)}">${esc(c.allTools)}</a> · <a href="${guidesPath(other)}" hreflang="${other}" lang="${other}">${esc(LANG_LABEL[other])}</a> · <a href="${REPO}">${esc(c.source)}</a> · ${esc(c.footer)}</p></footer>`,
  ].join('\n');
  return asArticle(
    render(template, {
      lang,
      title: copy.title,
      description: copy.description,
      path,
      alternates: alternates({ zh: guidesPath('zh'), en: guidesPath('en'), pl: guidesPath('pl') }),
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          organization,
          website,
          {
            '@type': 'CollectionPage',
            '@id': `${pageUrl}#webpage`,
            url: pageUrl,
            name: copy.title,
            description: copy.description,
            inLanguage: lang,
            isPartOf: { '@id': WEBSITE_ID },
            breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
            mainEntity: { '@id': `${pageUrl}#list` },
          },
          {
            '@type': 'ItemList',
            '@id': `${pageUrl}#list`,
            numberOfItems: listed.length,
            itemListElement: listed.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: url(g.path), name: g.h1 })),
          },
          {
            '@type': 'BreadcrumbList',
            '@id': `${pageUrl}#breadcrumb`,
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: c.home, item: url(homePath(lang)) },
              { '@type': 'ListItem', position: 2, name: c.guides, item: pageUrl },
            ],
          },
        ],
      },
      body,
    }),
  );
}

export interface StaticPage {
  /** Output file, relative to dist. */
  file: string;
  /** Public path (what the canonical URL names). */
  path: string;
  lang: Lang;
  title: string;
  html: string;
}

/** Checks the copy against the limits search engines show. */
function checkCopy(where: string, title: string, description: string) {
  if (title.length > MAX_TITLE) throw new Error(`seo pages: ${where} title is ${title.length} characters (max ${MAX_TITLE}): ${title}`);
  if (description.length > MAX_DESCRIPTION) throw new Error(`seo pages: ${where} description is ${description.length} characters (max ${MAX_DESCRIPTION})`);
}

/** The English home page (/en/); the Chinese one is the app's index.html. */
const HOME_EN = {
  title: 'Free PDF tools that never upload your files | Nyxiontech',
  description: 'Free, open-source PDF tools that run in your browser: edit, sign, merge, compress, OCR, redact and convert. Your files are never uploaded.',
  h1: 'Nyxiontech PDF Tools',
  intro: [
    'Free, open-source PDF and image tools that run entirely in your browser. Files are never uploaded: no account, no tracking, no limits.',
    'There is also a Windows app that works offline and updates itself, and the interface speaks Chinese, English and Polish.',
  ],
  faq: [
    ['Are my files uploaded?', 'No. Every tool runs in your browser on your own device, so your files never leave it. There is no account and no tracking.'],
    ['Is Nyxiontech PDF Tools free?', 'Yes, with no limits, sign-up or watermarks. It is open source under the GNU AGPL v3.'],
    ['How do I make a scanned PDF searchable?', 'Open "OCR: searchable PDF" and add the file. It recognises the text and adds an invisible text layer over the unchanged pages.'],
    ['Is the redaction safe?', 'Yes. Pages with redactions are re-rendered as images with the boxes burnt in, so the hidden text is removed, not just covered.'],
    ['Is there a desktop app?', 'Yes, for Windows 10 and 11. It works offline and updates itself with signed updates. Download it from the GitHub releases page.'],
  ] as [string, string][],
};

/** Body of a home page, in any language. */
function homeBody(lang: Lang, copy: { h1: string; intro: string[]; faq: [string, string][] }) {
  const c = COMMON[lang];
  const other = otherLang(lang);
  return [
    `${IND}<h1>${esc(copy.h1)}</h1>`,
    ...copy.intro.map((p) => `${IND}<p>${esc(p)}</p>`),
    `${IND}<h2>${esc(c.allTools)}</h2>`,
    `${IND}${toolLinks(lang)}`,
    `${IND}<h2>${esc(c.faq)}</h2>`,
    faqHtml(copy.faq),
    `${IND}<p><a href="${guidesPath(lang)}">${esc(c.guides)}</a> · <a href="${homePath(other)}" hreflang="${other}" lang="${other}">${esc(LANG_LABEL[other])}</a> · <a href="${REPO}">${esc(c.source)}</a> · <a href="${REPO}/releases/latest">${esc(WINDOWS_APP[lang])}</a> · <a href="https://nyxiontech.com">Nyxiontech</a></p>`,
    `${IND}<p>${esc(c.footer)}</p>`,
  ].join('\n');
}

/** Structured data for a home page. */
function homeJsonLd(lang: Lang, copy: { title: string; description: string; faq: [string, string][] }) {
  const pageUrl = url(homePath(lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: copy.title,
        description: copy.description,
        inLanguage: lang,
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': `${SITE}/#app` },
      },
      faqLd(`${pageUrl}#faq`, copy.faq),
    ],
  };
}

/**
 * Every generated page. File names follow Cloudflare Pages' clean URLs: "merge-pdf.html"
 * is served at /merge-pdf (no trailing slash, no redirect) and "en/index.html" at /en/.
 */
export function buildPages(template: string): StaticPage[] {
  const pages: StaticPage[] = [];
  for (const id of TOOL_IDS) {
    for (const lang of LANGS) {
      const copy = TOOL_COPY[lang][id];
      checkCopy(`${id} (${lang})`, copy.title, copy.description);
      const faq: [string, string][] = [...copy.faq, [COMMON[lang].privacyQ, COMMON[lang].privacyA(copy.name)]];
      const path = toolPath(id, lang);
      pages.push({
        file: `${path.slice(1)}.html`,
        path,
        lang,
        title: copy.title,
        html: render(template, {
          lang,
          title: copy.title,
          description: copy.description,
          path,
          alternates: alternates({ zh: toolPath(id, 'zh'), en: toolPath(id, 'en'), pl: toolPath(id, 'pl') }),
          jsonLd: toolJsonLd(id, lang, copy, faq),
          body: toolBody(id, lang, copy, faq),
        }),
      });
    }
  }

  const homes: [Lang, typeof HOME_EN][] = [
    ['zh', HOME_ZH],
    ['en', HOME_EN],
    ['pl', HOME_PL],
  ];
  for (const [lang, copy] of homes) {
    checkCopy(`home (${lang})`, copy.title, copy.description);
    const path = homePath(lang);
    pages.push({
      file: `${path.slice(1)}index.html`,
      path,
      lang,
      title: copy.title,
      html: render(template, {
        lang,
        title: copy.title,
        description: copy.description,
        path,
        alternates: homeAlternates(),
        jsonLd: homeJsonLd(lang, copy),
        body: homeBody(lang, copy),
      }),
    });
  }

  for (const lang of LANGS) {
    const copy = GUIDES_INDEX[lang];
    checkCopy(`guides index (${lang})`, copy.title, copy.description);
    const path = guidesPath(lang);
    pages.push({ file: `${path.slice(1)}.html`, path, lang, title: copy.title, html: guidesIndexPage(template, lang) });
  }

  for (const g of GUIDES) {
    checkCopy(`guide ${g.path}`, g.title, g.description);
    pages.push({ file: `${g.path.slice(1)}.html`, path: g.path, lang: g.lang, title: g.title, html: guidePage(template, g) });
  }
  return pages;
}

/** The page every unknown address gets, with a 404 status. Doesn't load the app. */
export function notFoundPage(): string {
  const links = TOOL_IDS.map((id) => `<a href="${toolPath(id, 'zh')}">${esc(TOOL_COPY.zh[id].name)}</a>`).join(' · ');
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>页面未找到 | Nyxiontech PDF 工具</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body style="max-width: 46rem; margin: 3rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; line-height: 1.5; color: #14171c; background: #fff">
    <h1>页面未找到</h1>
    <p>这个地址没有内容。<a href="/">打开 Nyxiontech PDF 工具</a>，或选择一个工具：</p>
    <p>${links}</p>
    <p lang="en">There is nothing at this address. <a href="/en/">Open Nyxiontech PDF Tools</a>.</p>
    <p lang="pl">Nie ma takiej strony. <a href="/pl/">Przejdź do narzędzi PDF Nyxiontech</a>.</p>
  </body>
</html>
`;
}

/** sitemap.xml: every page in every language, each with its hreflang alternates; guides (one language) without. */
export function sitemap(): string {
  const entry = (loc: string, paths: Record<Lang, string>) =>
    [
      '  <url>',
      `    <loc>${url(loc)}</loc>`,
      `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${url(paths.zh)}" />`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${url(paths.en)}" />`,
      `    <xhtml:link rel="alternate" hreflang="pl" href="${url(paths.pl)}" />`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(paths.zh)}" />`,
      '  </url>',
    ].join('\n');
  const sets: Record<Lang, string>[] = [
    { zh: homePath('zh'), en: homePath('en'), pl: homePath('pl') },
    { zh: guidesPath('zh'), en: guidesPath('en'), pl: guidesPath('pl') },
    ...TOOL_IDS.map((id): Record<Lang, string> => ({ zh: toolPath(id, 'zh'), en: toolPath(id, 'en'), pl: toolPath(id, 'pl') })),
  ];
  const urls = sets.flatMap((paths) => LANGS.map((lang) => entry(paths[lang], paths)));
  for (const g of GUIDES) urls.push(['  <url>', `    <loc>${url(g.path)}</loc>`, '  </url>'].join('\n'));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}
