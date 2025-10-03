import type { Options as UmamiOptions } from '@dipakparmar/docusaurus-plugin-umami'
import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
  title: 'Enkaku',
  tagline: 'RPC for modern applications',
  favicon: 'img/favicon.ico',
  url: 'https://enkaku.dev',
  baseUrl: '/',
  trailingSlash: true,
  organizationName: 'TairuFramework',
  projectName: 'enkaku',
  onBrokenLinks: 'throw',
  future: {
    experimental_faster: true,
    v4: true,
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        tsconfig: './tsconfig.docs.json',
        sidebar: {
          autoConfiguration: false,
        },
      },
    ],
    [
      '@dipakparmar/docusaurus-plugin-umami',
      {
        websiteID: '02a7c6ea-561e-4ea2-b210-f7e3dbb34a86',
        analyticsDomain: 'metrics.tairu.dev',
        dataAutoTrack: true,
        dataDoNotTrack: true,
        dataCache: true,
      } satisfies UmamiOptions,
    ],
    '@orama/plugin-docusaurus-v3',
    function fixMermaidLayoutElk() {
      return {
        name: 'fix-mermaid-layout-elk',
        configureWebpack() {
          return {
            resolve: {
              alias: {
                '@mermaid-js/layout-elk': false,
              },
            },
          }
        },
      }
    },
  ],
  themeConfig: {
    // Replace with your project's social card
    // image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Enkaku',
      logo: {
        alt: 'Enkaku',
        src: 'img/logo-light.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apis',
          position: 'left',
          label: 'APIs',
        },
        {
          href: 'https://github.com/TairuFramework/enkaku',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Introduction', to: '/docs/introduction' },
            { label: 'Procedures', to: '/docs/procedures' },
            { label: 'Communications', to: '/docs/communications' },
            { label: 'Validation', to: '/docs/validation' },
            { label: 'Security', to: '/docs/security' },
          ],
        },
        {
          title: 'APIs',
          items: [
            { label: 'Overview', to: '/docs/api' },
            { label: 'Server', to: '/docs/api/server' },
            { label: 'Client', to: '/docs/api/client' },
          ],
        },
        {
          title: 'More',
          items: [
            // { label: 'Blog', to: '/blog' },
            { label: 'GitHub', href: 'https://github.com/TairuFramework/enkaku' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Enkaku.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
}

export default config
