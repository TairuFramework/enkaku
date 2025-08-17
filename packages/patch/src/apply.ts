import type { PatchOperation } from './schemas.js'

/**
 * Error thrown when patch operations fail.
 *
 * @public
 */
export class PatchError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'PatchError'
    this.code = code
  }
}

function assertValidPath(path: string): void {
  if (!path.startsWith('/')) {
    throw new PatchError('Path must start with /', 'INVALID_PATH')
  }
}

function assertValidArrayIndex(target: unknown[], index: number): void {
  if (index < 0 || index > target.length) {
    throw new PatchError(
      `Array index ${index} out of bounds (length: ${target.length})`,
      'INVALID_INDEX',
    )
  }
}

function assertPathExists(obj: unknown, path: string): void {
  const value = getPath(obj, path)
  if (value === undefined) {
    throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
  }
}

function assertPathDoesNotExist(obj: unknown, path: string): void {
  const value = getPath(obj, path)
  if (value !== undefined) {
    throw new PatchError(`Path ${path} already exists`, 'PATH_EXISTS')
  }
}

/**
 * Parses a JSON Pointer path into an array of keys.
 *
 * @param path - JSON Pointer path (e.g., "/foo/bar/0")
 * @returns Array of property keys and array indices
 * @throws {PatchError} When path doesn't start with '/'
 *
 * @public
 */
export function parsePath(path: string): Array<string | number> {
  assertValidPath(path)
  return path
    .slice(1)
    .split('/')
    .map((key) => {
      // Handle JSON Pointer escape sequences
      const unescaped = key.replace(/~1/g, '/').replace(/~0/g, '~')
      // Convert array indices to numbers, but not empty strings
      if (unescaped === '') {
        return unescaped
      }
      const index = Number(unescaped)
      return Number.isNaN(index) ? unescaped : index
    })
}

/**
 * Gets a value from an object using a JSON Pointer path.
 *
 * @param obj - Object to traverse
 * @param path - JSON Pointer path
 * @returns The value at the specified path, or undefined if not found
 *
 * @public
 */
export function getPath(obj: unknown, path: string): unknown {
  const keys = parsePath(path)
  // @ts-expect-error index signature
  return keys.reduce((acc, key) => acc?.[key], obj)
}

/**
 * Sets a value in an object using a JSON Pointer path.
 *
 * @param obj - Object to modify
 * @param path - JSON Pointer path
 * @param value - Value to set
 * @param shouldExist - Whether the path should already exist
 * @throws {PatchError} When path validation fails
 *
 * @public
 */
export function setPath(
  obj: Record<string, unknown> | Array<unknown>,
  path: string,
  value: unknown,
  shouldExist = false,
): void {
  const keys = parsePath(path)
  const lastKey = keys.pop()
  if (lastKey !== undefined) {
    const target = keys.reduce((acc, key) => {
      if (acc === undefined) {
        throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
      }
      // @ts-expect-error unknown object
      return acc[key]
    }, obj)

    if (target === undefined) {
      throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
    }

    if (Array.isArray(target)) {
      if (typeof lastKey !== 'number') {
        throw new PatchError('Array index must be a number', 'INVALID_INDEX')
      }
      assertValidArrayIndex(target, lastKey)
      if (lastKey === target.length) {
        target.push(value)
      } else {
        target[lastKey] = value
      }
    } else {
      if (shouldExist && !(lastKey in target)) {
        throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
      }
      const targetObj = target as Record<string, unknown>
      targetObj[lastKey as string] = value
    }
  }
}

/**
 * Deletes a value from an object using a JSON Pointer path.
 *
 * @param obj - Object to modify
 * @param path - JSON Pointer path
 * @throws {PatchError} When path doesn't exist or is invalid
 *
 * @public
 */
export function deletePath(obj: Record<string, unknown> | Array<unknown>, path: string): void {
  const keys = parsePath(path)
  const lastKey = keys.pop()
  if (lastKey !== undefined) {
    const target = keys.reduce((acc, key) => {
      if (acc === undefined) {
        throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
      }
      // @ts-expect-error unknown object
      return acc[key]
    }, obj)

    if (target === undefined) {
      throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
    }

    if (Array.isArray(target)) {
      if (typeof lastKey !== 'number') {
        throw new PatchError('Array index must be a number', 'INVALID_INDEX')
      }
      assertValidArrayIndex(target, lastKey)
      target.splice(lastKey, 1)
    } else {
      if (!(lastKey in target)) {
        throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
      }
      const targetObj = target as Record<string, unknown>
      delete targetObj[lastKey as string]
    }
  }
}

/**
 * Applies an array of JSON Patch operations to an object.
 *
 * Operations are applied sequentially. If any operation fails,
 * the function throws and no further operations are applied.
 *
 * @param data - Object to modify
 * @param patches - Array of patch operations to apply
 * @throws {PatchError} When any operation fails
 *
 * @example
 * ```typescript
 * const data = { foo: { bar: 1 } }
 * applyPatches(data, [
 *   { op: 'replace', path: '/foo/bar', value: 2 },
 *   { op: 'add', path: '/foo/baz', value: 3 }
 * ])
 * // data is now { foo: { bar: 2, baz: 3 } }
 * ```
 *
 * @public
 */
export function applyPatches(data: Record<string, unknown>, patches: Array<PatchOperation>): void {
  for (const patch of patches) {
    switch (patch.op) {
      case 'add':
        assertPathDoesNotExist(data, patch.path)
        setPath(data, patch.path, patch.value)
        break
      case 'replace':
        assertPathExists(data, patch.path)
        setPath(data, patch.path, patch.value, true)
        break
      case 'set':
        setPath(data, patch.path, patch.value)
        break
      case 'remove':
        assertPathExists(data, patch.path)
        deletePath(data, patch.path)
        break
      case 'copy': {
        assertPathExists(data, patch.from)
        const value = getPath(data, patch.from)
        if (value === undefined) {
          throw new PatchError(`Source path ${patch.from} does not exist`, 'PATH_NOT_FOUND')
        }
        setPath(data, patch.path, value)
        break
      }
      case 'move': {
        assertPathExists(data, patch.from)
        const value = getPath(data, patch.from)
        if (value === undefined) {
          throw new PatchError(`Source path ${patch.from} does not exist`, 'PATH_NOT_FOUND')
        }
        deletePath(data, patch.from)
        setPath(data, patch.path, value)
        break
      }
      case 'test': {
        assertPathExists(data, patch.path)
        const value = getPath(data, patch.path)
        if (!Object.is(value, patch.value)) {
          throw new PatchError(
            `Test operation failed at path ${patch.path}: expected ${JSON.stringify(patch.value)}, got ${JSON.stringify(value)}`,
            'TEST_FAILED',
          )
        }
        break
      }
      default:
        // @ts-expect-error never type
        throw new PatchError(`Unknown operation: ${patch.op}`, 'INVALID_OPERATION')
    }
  }
}
