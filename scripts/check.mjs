// Loads this package the way magpie and OpenCode load it, and checks the
// shape of what each hook returns — no network, no sign-in. This is the same
// set of checks magpie-community's `scripts/check.mjs` makes for a provider
// package, kept local because that script runs on Bun.
//
//   node scripts/check.mjs

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const problems = []
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const mod = await import(new URL("../" + (pkg.main ?? "index.mjs"), import.meta.url).href)

const fns = Object.values(mod).filter((v) => typeof v === "function")
if (!fns.length) problems.push("main exports no plugin function")

for (const value of Object.values(mod)) {
  if (typeof value !== "function" && typeof value?.server !== "function") {
    problems.push(`main exports a non-plugin (${typeof value}); OpenCode 1.x refuses that`)
    break
  }
}

const client = { app: { log: async () => {} }, auth: { set: async () => {} }, tui: { showToast: async () => {} }, config: { get: async () => ({ data: {} }) } }
for (const fn of fns) {
  const hooks = await fn({ client, directory: process.cwd(), worktree: process.cwd(), $: undefined, project: {} })
  const auth = hooks?.auth
  if (!auth) {
    problems.push(`${fn.name}: no auth hook`)
    continue
  }
  if (typeof auth.provider !== "string" || !auth.provider) problems.push(`${fn.name}: auth.provider`)
  if (!Array.isArray(auth.methods) || !auth.methods.length) problems.push(`${fn.name}: auth.methods`)
  for (const method of auth.methods ?? []) {
    if (!["oauth", "api"].includes(method.type)) problems.push(`${fn.name}: method type ${method.type}`)
    if (method.type === "oauth" && typeof method.authorize !== "function") problems.push(`${fn.name}: ${method.label} has no authorize`)
  }
  if (typeof auth.loader !== "function") problems.push(`${fn.name}: auth.loader`)
  // optional, but if it is offered it must be a function magpie can call
  if (auth.checkin !== undefined && typeof auth.checkin !== "function") problems.push(`${fn.name}: auth.checkin is not a function`)
  if (auth.usage !== undefined && typeof auth.usage !== "function") problems.push(`${fn.name}: auth.usage is not a function`)

  if (hooks.config) {
    const cfg = { provider: {} }
    await hooks.config(cfg)
    const p = cfg.provider[auth.provider]
    if (!p) problems.push(`${fn.name}: config gives no provider ${auth.provider}`)
    else {
      if (!p.npm) problems.push(`${fn.name}: config gives ${auth.provider} no npm`)
      if (!p.models || !Object.keys(p.models).length) problems.push(`${fn.name}: config gives ${auth.provider} no models`)
    }
  }
  if (typeof hooks.provider?.models !== "function") problems.push(`${fn.name}: no provider.models hook`)
  if (hooks.provider?.id !== auth.provider) problems.push(`${fn.name}: provider.id ${hooks.provider?.id} != auth.provider`)
}

// OpenCode 2.x loads exports["."] and wants a default {id, setup}.
const entry = typeof pkg.exports === "string" ? pkg.exports : pkg.exports?.["."] ?? pkg.main
const two = await import(new URL("../" + entry, import.meta.url).href)
const d = two.default
if (!d || typeof d !== "object" || typeof d.id !== "string" || !d.id || (typeof d.setup !== "function" && typeof d.effect !== "function")) {
  problems.push(`${entry} has no default {id, setup} (plugins#657)`)
}

if (problems.length) {
  console.error("✗ " + pkg.name + "\n  " + problems.join("\n  "))
  process.exit(1)
}
console.log("✓ " + pkg.name + " — config / auth / provider.models / OpenCode 2.x all load")
