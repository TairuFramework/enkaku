import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    { type: 'doc', id: 'introduction' },
    { type: 'doc', id: 'quick-start' },
    { type: 'doc', id: 'procedures' },
    { type: 'doc', id: 'communications' },
    { type: 'doc', id: 'validation' },
    { type: 'doc', id: 'security' },
    {
      type: 'category',
      label: 'Examples',
      collapsed: false,
      items: [
        'examples/stateless-http',
        // 'examples/stateful-http',
        'examples/authenticated-db-access',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: ['guides/http-transports', 'guides/custom-transports', 'guides/key-management'],
    },
  ],
  apis: [
    { type: 'doc', id: 'api' },
    {
      type: 'category',
      label: 'Core',
      items: [
        'api/schema/index',
        'api/token/index',
        'api/capability/index',
        'api/stream/index',
        'api/transport/index',
        'api/protocol/index',
      ],
    },
    {
      type: 'category',
      label: 'RPC',
      items: ['api/client/index', 'api/server/index', 'api/standalone/index'],
    },
    {
      type: 'category',
      label: 'Transports',
      items: [
        'api/http-client-transport/index',
        'api/http-server-transport/index',
        'api/message-transport/index',
        'api/node-streams-transport/index',
        'api/socket-transport/index',
      ],
    },
    {
      type: 'category',
      label: 'Key stores',
      items: ['api/browser-keystore/index', 'api/expo-keystore/index', 'api/node-keystore/index'],
    },
    {
      type: 'category',
      label: 'Miscellaneous',
      items: ['api/codec/index', 'api/util/index'],
    },
  ],
}

export default sidebars
