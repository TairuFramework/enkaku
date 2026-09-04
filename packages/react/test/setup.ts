import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0])
