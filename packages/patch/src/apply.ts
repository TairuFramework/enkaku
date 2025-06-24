import type { PatchOperation } from './schemas.js'

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

export function parsePath(path: string): Array<string | number> {
  assertValidPath(path)
  return path
    .slice(1)
    .split('/')
    .map((key) => {
      // Handle JSON Pointer escape sequences
      const unescaped = key.replace(/~1/g, '/').replace(/~0/g, '~')
      // Convert array indices to numbers
      const index = Number(unescaped)
      return Number.isNaN(index) ? unescaped : index
    })
}

export function getPath(obj: unknown, path: string): unknown {
  const keys = parsePath(path)
  // @ts-ignore index signature
  return keys.reduce((acc, key) => acc?.[key], obj)
}

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
      // @ts-ignore unknown object
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

export function deletePath(obj: Record<string, unknown> | Array<unknown>, path: string): void {
  const keys = parsePath(path)
  const lastKey = keys.pop()
  if (lastKey !== undefined) {
    const target = keys.reduce((acc, key) => {
      if (acc === undefined) {
        throw new PatchError(`Path ${path} does not exist`, 'PATH_NOT_FOUND')
      }
      // @ts-ignore unknown object
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
      default:
        // @ts-ignore never type
        throw new PatchError(`Unknown operation: ${patch.op}`, 'INVALID_OPERATION')
    }
  }
}
