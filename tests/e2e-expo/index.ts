import { polyfillCrypto } from '@enkaku/expo-runtime'
import { registerRootComponent } from 'expo'

import App from './App'

polyfillCrypto()
registerRootComponent(App)
