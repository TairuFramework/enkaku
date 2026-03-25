import * as matchers from '@testing-library/jest-dom/matchers'
import type { MatchersObject } from '@vitest/expect'
import { expect } from 'vitest'

expect.extend(matchers as unknown as MatchersObject)
