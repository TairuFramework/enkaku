import { polyfillCrypto } from '@sozai/runtime-expo'
import { registerRootComponent } from 'expo'

import App from './App'

polyfillCrypto()
registerRootComponent(App)
