import { describe, expect, test } from 'vitest'

import { formatBaggage, parseBaggage } from '../src/baggage.js'

describe('formatBaggage', () => {
  test('formats a single member', () => {
    expect(formatBaggage([{ key: 'userId', value: 'alice' }])).toBe('userId=alice')
  })

  test('formats multiple members preserving order', () => {
    expect(
      formatBaggage([
        { key: 'userId', value: 'alice' },
        { key: 'serverNode', value: 'DF28' },
      ]),
    ).toBe('userId=alice,serverNode=DF28')
  })

  test('percent-encodes values', () => {
    expect(formatBaggage([{ key: 'k', value: 'a b,c;d' }])).toBe('k=a%20b%2Cc%3Bd')
  })

  test('formats valueless and key=value properties', () => {
    expect(
      formatBaggage([
        { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
      ]),
    ).toBe('k=v;secure;ttl=30')
  })

  test('drops members with invalid (non-token) keys', () => {
    expect(
      formatBaggage([
        { key: 'bad key', value: 'v' },
        { key: 'good', value: 'v' },
      ]),
    ).toBe('good=v')
  })

  test('round-trips an empty value', () => {
    expect(formatBaggage([{ key: 'k', value: '' }])).toBe('k=')
    expect(parseBaggage('k=')).toEqual([{ key: 'k', value: '' }])
  })
})

describe('parseBaggage', () => {
  test('parses a valid header', () => {
    expect(parseBaggage('userId=alice,serverNode=DF28')).toEqual([
      { key: 'userId', value: 'alice' },
      { key: 'serverNode', value: 'DF28' },
    ])
  })

  test('percent-decodes values', () => {
    expect(parseBaggage('k=a%20b%2Cc%3Bd')).toEqual([{ key: 'k', value: 'a b,c;d' }])
  })

  test('parses valueless and key=value properties', () => {
    expect(parseBaggage('k=v;secure;ttl=30')).toEqual([
      { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
    ])
  })

  test('drops malformed members, never throws', () => {
    expect(parseBaggage('good=v,garbage,=novalue,bad key=x')).toEqual([{ key: 'good', value: 'v' }])
  })

  test('drops members with un-decodable percent sequences', () => {
    expect(parseBaggage('bad=%zz,good=v')).toEqual([{ key: 'good', value: 'v' }])
  })

  test('returns empty array for empty header', () => {
    expect(parseBaggage('')).toEqual([])
  })

  test('drops duplicate keys, keeping the first', () => {
    expect(parseBaggage('a=1,a=2')).toEqual([{ key: 'a', value: '1' }])
  })
})

describe('baggage round-trip', () => {
  test('parse(format(x)) reproduces values and properties', () => {
    const entries = [
      { key: 'userId', value: 'alice smith,jr' },
      { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
    ]
    expect(parseBaggage(formatBaggage(entries))).toEqual(entries)
  })
})
