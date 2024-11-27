import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    { type: 'doc', id: 'overview' },
    { type: 'doc', id: 'quick-start' },
    { type: 'doc', id: 'concepts' },
  ],
  apis: [
    { type: 'doc', id: 'api' },
    {
      type: 'category',
      label: 'Core',
      items: [
        'api/protocol/index',
        'api/schema/index',
        'api/token/index',
        'api/capability/index',
        'api/stream/index',
        'api/transport/index',
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
      ],
    },
    {
      type: 'category',
      label: 'Key stores',
      items: [
        'api/browser-keystore/index',
        'api/desktop-keystore/index',
        'api/expo-keystore/index',
      ],
    },
    {
      type: 'category',
      label: 'Misc',
      items: ['api/codec/index', 'api/util/index'],
    },
  ],
}

export default sidebars
