import { baggageEntryMetadataFromString, propagation } from '@opentelemetry/api'
import { describe, expect, test } from 'vitest'

import { baggageToEntries, entriesToBaggage, formatBaggage, parseBaggage } from '../src/baggage.js'

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

  test('drops properties with invalid (non-token) keys', () => {
    expect(
      formatBaggage([{ key: 'k', value: 'v', properties: [{ key: 'bad prop' }, { key: 'ok' }] }]),
    ).toBe('k=v;ok')
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

  test('drops properties with invalid keys, keeping the member', () => {
    expect(parseBaggage('k=v;bad prop;ok')).toEqual([
      { key: 'k', value: 'v', properties: [{ key: 'ok' }] },
    ])
  })

  test('keeps the first valid occurrence when an earlier duplicate is malformed', () => {
    expect(parseBaggage('a=%zz,a=good')).toEqual([{ key: 'a', value: 'good' }])
  })

  test('accepts percent characters in keys (valid token char)', () => {
    expect(parseBaggage('%20=v')).toEqual([{ key: '%20', value: 'v' }])
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

describe('baggageToEntries', () => {
  test('maps plain key/value entries', () => {
    const bag = propagation.createBaggage({
      userId: { value: 'alice' },
      region: { value: 'eu' },
    })
    const entries = baggageToEntries(bag)
    expect(entries).toContainEqual({ key: 'userId', value: 'alice' })
    expect(entries).toContainEqual({ key: 'region', value: 'eu' })
    expect(entries).toHaveLength(2)
  })

  test('parses W3C metadata into structured properties (lossless)', () => {
    const bag = propagation.createBaggage({
      userId: { value: 'alice', metadata: baggageEntryMetadataFromString('ttl=30;internal') },
    })
    const entries = baggageToEntries(bag)
    expect(entries).toEqual([
      {
        key: 'userId',
        value: 'alice',
        properties: [{ key: 'ttl', value: '30' }, { key: 'internal' }],
      },
    ])
  })

  test('round-trips through formatBaggage -> parseBaggage', () => {
    const bag = propagation.createBaggage({
      userId: { value: 'alice', metadata: baggageEntryMetadataFromString('ttl=30;internal') },
    })
    const entries = baggageToEntries(bag)
    expect(parseBaggage(formatBaggage(entries))).toEqual(entries)
  })

  test('omits properties when metadata is empty', () => {
    const bag = propagation.createBaggage({ userId: { value: 'alice' } })
    expect(baggageToEntries(bag)).toEqual([{ key: 'userId', value: 'alice' }])
  })

  test('round-trips a property value containing special characters', () => {
    // OTel stores metadata raw (percent-encoded); parseProperties must decode it,
    // and formatBaggage must re-encode on the way back out.
    const bag = propagation.createBaggage({
      userId: { value: 'alice', metadata: baggageEntryMetadataFromString('note=hello%20world') },
    })
    const entries = baggageToEntries(bag)
    expect(entries).toEqual([
      { key: 'userId', value: 'alice', properties: [{ key: 'note', value: 'hello world' }] },
    ])
    expect(parseBaggage(formatBaggage(entries))).toEqual(entries)
  })

  test('drops malformed metadata segments', () => {
    const bag = propagation.createBaggage({
      userId: {
        value: 'alice',
        metadata: baggageEntryMetadataFromString('ttl=30;bad key!;internal'),
      },
    })
    expect(baggageToEntries(bag)).toEqual([
      {
        key: 'userId',
        value: 'alice',
        properties: [{ key: 'ttl', value: '30' }, { key: 'internal' }],
      },
    ])
  })
})

describe('entriesToBaggage', () => {
  test('round-trips plain entries through baggageToEntries', () => {
    const entries = [
      { key: 'userId', value: 'alice smith,jr' },
      { key: 'region', value: 'eu' },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual(entries)
  })

  test('round-trips entries with properties (lossless)', () => {
    const entries = [
      { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual(entries)
  })

  test('round-trips a property value with special characters', () => {
    const entries = [{ key: 'k', value: 'v', properties: [{ key: 'note', value: 'hello world' }] }]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual(entries)
  })

  test('drops members with invalid (non-token) keys', () => {
    const entries = [
      { key: 'bad key', value: 'v' },
      { key: 'good', value: 'v' },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual([{ key: 'good', value: 'v' }])
  })

  test('keeps the first occurrence of a duplicate key', () => {
    const entries = [
      { key: 'a', value: '1' },
      { key: 'a', value: '2' },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual([{ key: 'a', value: '1' }])
  })

  test('keeps entries whose keys collide with Object.prototype members', () => {
    const entries = [
      { key: 'toString', value: 'v1' },
      { key: 'constructor', value: 'v2' },
      { key: 'hasOwnProperty', value: 'v3' },
      { key: '__proto__', value: 'v4' },
    ]
    const result = baggageToEntries(entriesToBaggage(entries))
    expect(result).toContainEqual({ key: 'toString', value: 'v1' })
    expect(result).toContainEqual({ key: 'constructor', value: 'v2' })
    expect(result).toContainEqual({ key: 'hasOwnProperty', value: 'v3' })
    expect(result).toContainEqual({ key: '__proto__', value: 'v4' })
    expect(result).toHaveLength(4)
  })
})
