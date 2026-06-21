import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CORE = new Set([
  'async',
  'codec',
  'event',
  'execution',
  'flow',
  'generator',
  'log',
  'otel',
  'patch',
  'result',
  'runtime',
  'schema',
  'stream',
])
const IDENTITY = new Set(['token', 'capability'])

function newScope(name) {
  const m = name.match(/^@enkaku\/([a-z-]+)$/)
  if (!m) return null
  if (CORE.has(m[1])) return `@sozai/${m[1]}`
  if (IDENTITY.has(m[1])) return `@kokuin/${m[1]}`
  return null
}

function rewriteDeps(deps) {
  if (!deps) return deps
  const out = {}
  for (const [k, v] of Object.entries(deps)) {
    const t = newScope(k)
    if (t) out[t] = '^0.1.0'
    else out[k] = v
  }
  return out
}

function rewriteSrc(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (e !== 'lib' && e !== 'node_modules') rewriteSrc(p)
    } else if (/\.(ts|tsx)$/.test(e)) {
      const src = readFileSync(p, 'utf8')
      const next = src.replace(/@enkaku\/([a-z-]+)/g, (full, name) => {
        if (CORE.has(name)) return `@sozai/${name}`
        if (IDENTITY.has(name)) return `@kokuin/${name}`
        return full
      })
      if (next !== src) writeFileSync(p, next)
    }
  }
}

const pkgDir = process.argv[2]
const pjPath = join(pkgDir, 'package.json')
const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
pj.dependencies = rewriteDeps(pj.dependencies)
pj.devDependencies = rewriteDeps(pj.devDependencies)
writeFileSync(pjPath, `${JSON.stringify(pj, null, 2)}\n`)
for (const sub of ['src', 'test']) {
  const dir = join(pkgDir, sub)
  if (existsSync(dir)) rewriteSrc(dir)
}
console.log(`codemod: ${pkgDir}`)
