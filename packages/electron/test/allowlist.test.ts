import { describe, expect, test } from 'vitest'

import { isAllowedSenderURL } from '../src/allowlist.js'

describe('isAllowedSenderURL', () => {
  test('matches exact string entries', () => {
    expect(
      isAllowedSenderURL('https://app.example.com/index.html', [
        'https://app.example.com/index.html',
      ]),
    ).toBe(true)
    expect(
      isAllowedSenderURL('https://evil.example.com/index.html', [
        'https://app.example.com/index.html',
      ]),
    ).toBe(false)
  })

  test('matches prefix entries ending with *', () => {
    expect(isAllowedSenderURL('file:///opt/app/renderer/index.html', ['file://*'])).toBe(true)
    expect(
      isAllowedSenderURL('https://app.example.com/page?x=1', ['https://app.example.com/*']),
    ).toBe(true)
    expect(
      isAllowedSenderURL('https://app.example.com.evil.io/page', ['https://app.example.com/*']),
    ).toBe(false)
  })

  test('matches RegExp entries', () => {
    expect(isAllowedSenderURL('http://localhost:5173/', [/^http:\/\/localhost:\d+\//])).toBe(true)
    expect(isAllowedSenderURL('http://localhost.evil.io/', [/^http:\/\/localhost:\d+\//])).toBe(
      false,
    )
  })

  test('denies everything with an empty allowlist', () => {
    expect(isAllowedSenderURL('file:///opt/app/index.html', [])).toBe(false)
  })

  test('first matching entry wins across mixed entries', () => {
    const allowlist = ['https://app.example.com/*', /^file:\/\/\/opt\/app\//]
    expect(isAllowedSenderURL('file:///opt/app/index.html', allowlist)).toBe(true)
    expect(isAllowedSenderURL('file:///tmp/other.html', allowlist)).toBe(false)
  })
})
