# 发布与分发

这个包有两种「给别人用」的方式。**A 最快，B 才会出现在 magpie 的「插件 → 发现」里**。
两条路可以都走：先 A 让别人马上能装，再 B 提 PR。

---

## 已经准备好的东西

```
publish/
  magpie-tabbit-provider-0.1.0.tgz   npm 包（29 KB，11 个文件）
  tabbit-community.patch             直接打到 magpie-community/plugins 的补丁
```

已经验证过的：

| 检查 | 结果 |
|---|---|
| `node --test tests/` | 44 通过 |
| `node scripts/check.mjs` | ✓ config / auth / provider.models / OpenCode 2.x |
| 社区仓的 `scripts/check.mjs tabbit` | ✓（补丁打到干净克隆上后跑的） |
| `git apply --check` 到干净克隆 | ✓ 干净应用 |
| 把 tgz 装进空项目再 `import` | ✓ 钩子齐全（含 `checkin`） |
| `npm pack --dry-run` | 11 个文件，不含 tests/、publish/、tgz |

---

## 发布记录

| 版本 | 时间 | 状态 |
|---|---|---|
| 0.1.0 | 2026-11-03 | ✅ 已上线（`latest`），`npm i magpie-tabbit-provider` 可用 |
| 0.1.1 | 2026-11-03 | ⏳ 代码已改好（review 修复），待发布：`npm publish --otp=<6位码>` |

已落地的分发入口：

| 入口 | 地址 | 状态 |
|---|---|---|
| npm | https://www.npmjs.com/package/magpie-tabbit-provider | ✅ 0.1.0 是 `latest` |
| GitHub 源码仓库（`github:` 安装） | https://github.com/chary1n/tabbit-providers | ✅ public，topics 含 `magpie-plugin` |
| 社区仓 PR（进「发现 → 推荐列表」） | https://github.com/magpie-community/plugins/pull/673 | ⏳ open，等 review |

实测踩到的两件事，下次发版直接照做：

1. **首次发布会先出现 `0.0.0-stage` 占位版本**（npm 的暂存发布流程，占名用）。真实版本批准
   后会自动替换，`dist-tags.latest` 指向真实版本即可，占位版本留着无害。
2. **带「bypass 2FA」的 granular token 会被转成 staged**。要直接上线就带 OTP：
   `npm publish --otp=<6位码>`。如果报
   `You cannot publish over the previously published versions: X`，
   说明 X **已经发上去了**——先 `npm view magpie-tabbit-provider version` 确认，
   真要再发就 bump 版本号。

## 路线 A：只发 npm（最快，10 分钟）

前提：一个 npm 账号（2FA 打开也可以，发布时给 OTP）。

```sh
cd ~/Desktop/deepseek_harness_workspace/tabbit_providers

npm login                      # 或 npm adduser
npm whoami                     # 确认登录成功

# 名字可用性：magpie-tabbit-provider 目前在 npm 上是 404（没人占）
# 想用自己的 scope 就把 package.json 的 name 改成 @你的名字/magpie-tabbit-provider

npm publish                    # 开了 2FA 就 npm publish --otp=123456
```

别人安装：

```sh
magpie plugin add npm:magpie-tabbit-provider
# 或简写（magpie 会按 npm 包名去找）
magpie plugin add magpie-tabbit-provider
magpie plugin login tabbit
```

自己先验一遍：

```sh
magpie plugin add npm:magpie-tabbit-provider
magpie plugin login tabbit        # 选「Read Tabbit Browser sign-in (macOS)」
magpie provider test tabbit
```

⚠️ 别用国内镜像发布（镜像只读）：发布时确保 `npm config get registry` 是
`https://registry.npmjs.org/`，或临时 `npm_config_registry=https://registry.npmjs.org npm publish`。

---

## 路线 B：进 magpie 的「插件 → 发现」列表（推荐）

magpie 的发现页读的是 `magpie-community/plugins` 仓库的 `registry.json`。
**只要 PR 合并，magpie 就从仓库的 dist 分支装这个包，不等 npm 首发。**

1. 在 GitHub fork `magpie-community/plugins`
2. 打补丁（里面已经有 `packages/tabbit/` 和 `registry.json` 的那一条）：

```sh
git clone https://github.com/<你>/plugins.git
cd plugins
git checkout -b add-tabbit
git apply /path/to/publish/tabbit-community.patch
```

3. 本地校验（社区仓的检查器要 bun；用 node 的话把 `import.meta.dir` 换成
   `import.meta.dirname` 即可）：

```sh
bun scripts/check.mjs tabbit
# 或
sed 's/import\.meta\.dir/import.meta.dirname/g' scripts/check.mjs > /tmp/check.mjs
node /tmp/check.mjs tabbit
```

4. 提交并开 PR：

```sh
git add packages/tabbit registry.json
git commit -m "tabbit: Tabbit (web.tabbit.com) as a provider, with live catalog, check-in and cycle usage"
git push -u origin add-tabbit
```

5. 合并后：magpie → Plugins → Discover 里出现 **Tabbit**，直接安装即可。
6. npm 的「首发」由 `@magpie-community` 组织的 owner 用 `scripts/owner.sh` 完成，
   **不阻塞使用**。

PR 描述里建议写清三点（审阅者会问）：

- 不走浏览器自动化：一轮对话是 `rooms → runs → join(SSE)`，纯 HTTP；
- 登录是 Tabbit Browser 的 `token` cookie（7 天），macOS 读 Keychain，
  其他平台用粘贴 token；
- 客户端工具调用不支持（Tabbit 的 `supports_tools` 是它自己的服务端工具）。

---

## 版本与后续更新

- 改完就 bump `version`（`0.1.1` / `0.2.0`…），重新 `npm publish`；
  社区仓那边同一个 PR 流程，改 `packages/tabbit/package.json` 的版本即可。
- 别人更新：`magpie plugin update`（社区包还会在一小时内自动更新）。
- `registry.json` 的 `summary` 必须 `en` / `zh` 两份都在。

---

## 发布前清单（每次发版都过一遍）

```sh
node --test tests/            # 44 通过
node scripts/check.mjs        # 钩子形状
npm pack --dry-run            # 看 tarball 内容：不该有 tests/、publish/、*.tgz
npm pack && (在空目录) npm i ./magpie-tabbit-provider-x.y.z.tgz && node -e "import('magpie-tabbit-provider')"
magpie plugin add <本目录或 npm 包> && magpie provider test tabbit
```

---

## 几个容易踩的坑

| 坑 | 说明 |
|---|---|
| scoped 包发布失败 | `@scope/name` 必须 `npm publish --access public`（package.json 里已写 `publishConfig.access`） |
| 用了镜像 | 镜像不接受 publish，见上 |
| npm token 过期 | npm 的 write token 最长 90 天；CI 用 NPM_TOKEN 时注意更换 |
| 把 node_modules 打进去 | `files` 已限定，别改成 `*` |
| 社区包名不对 | 必须是 `@magpie-community/opencode-<name>-auth`，provider id 仍是 `tabbit` |
| `opencode2.mjs` 被改过 | 它必须和社区仓 `scripts/opencode2.mjs` **字节一致**，检查器会报 |
| Windows 读不到 cookie | 目前未实现（需要 DPAPI），README 已写明；PR 里要提一句，免得被当成 bug |
