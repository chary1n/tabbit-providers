// The cookie store: a synthetic Chromium v10 blob, decrypted with a known
// password, and the store lookup that finds the file.

import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { decryptValue, cookieStore, copyStore, profileDirs, readCookies } from "../src/cookie.mjs"

const HOST = "web.tabbit.com"
const PASSWORD = "test-password"

// seal makes the blob Chromium's own macOS encryption makes: AES-128-CBC
// under the keychain password, `v10`, a 32-byte SHA-256 of the host in
// front of the plaintext, and PKCS#7 padding.
function seal(plaintext, { password = PASSWORD, host = HOST } = {}) {
  const key = crypto.pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1")
  const body = Buffer.concat([crypto.createHash("sha256").update(host).digest(), Buffer.from(plaintext, "utf8")])
  const pad = 16 - (body.length % 16)
  const padded = Buffer.concat([body, Buffer.alloc(pad, pad)])
  const cipher = crypto.createCipheriv("aes-128-cbc", key, Buffer.alloc(16, 0x20))
  cipher.setAutoPadding(false)
  return Buffer.concat([Buffer.from("v10", "latin1"), cipher.update(padded), cipher.final()])
}

test("a v10 blob decrypts to the plaintext", () => {
  const token = "eyJhbGciOiJSUzI1NiJ9.payload.sig"
  assert.equal(decryptValue(seal(token), { password: PASSWORD }), token)
})

test("the wrong password does not yield a plausible value", () => {
  let value = null
  try {
    value = decryptValue(seal("hello"), { password: "wrong" })
  } catch {
    /* a wrong key usually throws on the padding */
  }
  assert.notEqual(value, "hello")
})

test("a blob that isn't v10 is refused", () => {
  assert.throws(() => decryptValue(Buffer.from("v20xxxx"), { password: PASSWORD }), /unsupported cookie encryption/)
})

test("profileDirs honours an explicit override first", () => {
  const dirs = profileDirs({ TABBIT_PROFILE_DIR: "/tmp/one" }, "/home/u")
  assert.equal(dirs[0], "/tmp/one")
})

test("cookieStore finds Default/Cookies under a profile root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tabbit-test-"))
  fs.mkdirSync(path.join(root, "Default"), { recursive: true })
  fs.writeFileSync(path.join(root, "Default", "Cookies"), "")
  assert.equal(cookieStore([root]), path.join(root, "Default", "Cookies"))
  assert.equal(cookieStore([path.join(root, "missing")]), null)
})

test("copyStore copies the database and its WAL", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tabbit-test-"))
  const file = path.join(root, "Cookies")
  fs.writeFileSync(file, "db")
  fs.writeFileSync(file + "-wal", "wal")
  const copy = copyStore(file, fs.mkdtempSync(path.join(os.tmpdir(), "tabbit-copy-")))
  assert.equal(fs.readFileSync(copy, "utf8"), "db")
  assert.equal(fs.readFileSync(copy + "-wal", "utf8"), "wal")
})

test("readCookies reads token and user_id back out of a real sqlite file", () => {
  let DatabaseSync
  try {
    DatabaseSync = globalThis.process.getBuiltinModule("node:sqlite").DatabaseSync
  } catch {
    return // older Node: the plugin says so at runtime too
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tabbit-test-"))
  const file = path.join(root, "Cookies")
  const db = new DatabaseSync(file)
  db.exec("create table cookies(host_key text, name text, value text, encrypted_value blob)")
  db.prepare("insert into cookies values (?,?,?,?)").run(HOST, "token", "", seal("tok-123"))
  db.prepare("insert into cookies values (?,?,?,?)").run(HOST, "user_id", "u-1", Buffer.alloc(0))
  db.close()
  const rows = readCookies(file)
  const token = rows.find((r) => r.name === "token")
  assert.equal(decryptValue(token.encrypted, { password: PASSWORD }), "tok-123")
  assert.equal(rows.find((r) => r.name === "user_id").value, "u-1")
})
