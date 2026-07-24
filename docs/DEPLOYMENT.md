# MOCA Web 部署说明

本文档覆盖四种部署方式：

1. Vercel
2. GitHub Pages
3. Cloudflare Pages
4. 自有 Node.js 服务器

所有方案都以 `main` 为生产分支，并要求实现：

- `main` 更新后自动构建或部署；
- 首页 Contact 表单最终能够发送邮件；
- 密码、Token 和 SMTP 凭据不进入 Git。

## 方案对比

| 方案 | 站点运行方式 | 邮件方式 | `main` 自动更新 | 建议 |
| --- | --- | --- | --- | --- |
| Vercel | Astro SSR / Serverless Function | 直接 SMTP、HTTPS webhook，或 Resend Contact API | Vercel Git Integration | 配置最少 |
| GitHub Pages | 纯静态 | 必须调用外部 HTTPS Contact API，可由 Resend 提供发信能力 | 项目内 GitHub Pages Action | 不能直接运行 SMTP |
| Cloudflare Pages | 静态页面 + Pages Function | Pages Function 调用 HTTPS webhook 或 Resend API | Cloudflare Git Integration | 不使用 Nodemailer SMTP |
| 自有服务器 | Astro Node SSR，或静态文件 | 直接 SMTP、HTTPS webhook，或 Resend Contact API | CI 成功后通知部署 webhook | 控制力最高 |

> `PUBLIC_*` 变量会进入浏览器构建结果，只能存放公开地址。SMTP
> 密码、邮件服务 Token 等必须使用平台 Secret 或服务器环境变量。

## 需要 Nelson 确认的架构选择

部署平台和邮件架构是两个独立决策。最终上线前由 Nelson 确认：

### 方案 A：保留当前混合运行方式

- Vercel和自有服务器运行 Astro SSR，可直接使用 SMTP；
- GitHub Pages 使用外部 Contact API；
- Cloudflare Pages 使用 Pages Function；
- 不同平台继续通过 `DEPLOY_TARGET` 选择静态或 SSR 构建。

适合需要保留自有 SMTP、未来可能增加动态服务端功能的情况。

### 方案 B：统一静态站点 + Resend（推荐）

- Astro 在所有平台都生成相同的静态 `dist`；
- Contact 表单统一请求一个独立的 HTTPS Contact API；
- Contact API 推荐部署为 Cloudflare Worker，也可以使用其他 Serverless
  Function；
- Function 在服务端读取 `RESEND_API_KEY` 并调用 Resend；
- Vercel、GitHub Pages、Cloudflare Pages和自有服务器共用同一个
  `PUBLIC_CONTACT_ENDPOINT`；
- GitHub 只负责固定的检查和构建，部署平台负责监听 `main`。

适合当前以首页和新闻内容为主、不需要常驻 SSR 服务的站点。选择此方案后，
需要进行一次性代码收敛：改为统一静态输出，移除 Nodemailer、SMTP 和 Astro
Node/Vercel SSR adapter。完成改造前，当前代码仍按方案 A 运行。

### Nelson 决策记录

上线前在此确认：

- [ ] 方案 A：混合运行方式
- [ ] 方案 B：统一静态站点 + Resend
- [ ] 正式部署平台：Vercel / GitHub Pages / Cloudflare Pages / 自有服务器
- [ ] 正式域名：
- [ ] Contact 收件地址：

## 公共准备工作

### 1. 生产域名

设置：

```env
PUBLIC_SITE_URL=https://www.example.com
```

### 2. SMTP 配置

Vercel和自有服务器可以直接使用：

```env
CONTACT_MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=website@example.com
SMTP_PASSWORD=<app-password>
CONTACT_FROM_EMAIL=website@example.com
CONTACT_FROM_NAME=MOCA Website
CONTACT_TO_EMAIL=hello@example.com
CONTACT_SUBJECT_PREFIX=[MOCA Website]
```

通常：

- 端口 `587`：`SMTP_SECURE=false`、`SMTP_REQUIRE_TLS=true`；
- 端口 `465`：`SMTP_SECURE=true`；
- `CONTACT_FROM_EMAIL` 应当是 SMTP 服务允许发送的地址；
- 上线前需要完成发件域名验证、SPF 和 DKIM 配置。

### 3. HTTPS 邮件 webhook

Cloudflare Pages Function，以及不允许直连 SMTP 的运行时，使用：

```env
CONTACT_MAIL_TRANSPORT=webhook
CONTACT_MAIL_SERVICE_URL=https://mail-service.example.com/send
CONTACT_MAIL_SERVICE_TOKEN=<secret-token>
CONTACT_FROM_EMAIL=website@example.com
CONTACT_FROM_NAME=MOCA Website
CONTACT_TO_EMAIL=hello@example.com
CONTACT_SUBJECT_PREFIX=[MOCA Website]
```

邮件服务需要接受以下 JSON：

```json
{
  "from": "website@example.com",
  "fromName": "MOCA Website",
  "to": "hello@example.com",
  "replyTo": "visitor@example.com",
  "subject": "[MOCA Website] Visitor subject",
  "text": "Name: Visitor\nEmail: visitor@example.com\n\nMessage body"
}
```

Node/Vercel 版本目前发送相同字段，但旧 webhook 服务忽略额外字段也应正常工作。

### 4. Resend 托管发信

Resend 可以托管发信和域名身份验证，因此站点不需要常驻 Astro SSR 或自行连接
SMTP。它不等于传统邮箱收件箱：Contact 邮件仍会投递到
`CONTACT_TO_EMAIL` 指定的真实邮箱。

建议使用专门的发信子域名，例如：

```text
mail.example.com
```

操作步骤：

1. 在 Resend 添加子域名；
2. 在 DNS 服务商添加 Resend 提供的 SPF、DKIM 记录；
3. 建议再添加 DMARC；
4. 创建仅具有 Sending access 的生产 API Key；
5. 在 Worker/Function Secret 中配置：

   ```env
   RESEND_API_KEY=<secret>
   RESEND_FROM_EMAIL=MOCA Website <website@mail.example.com>
   CONTACT_TO_EMAIL=hello@example.com
   CONTACT_ALLOWED_ORIGINS=https://www.example.com
   ```

6. 在所有静态站点的公开构建变量中配置：

   ```env
   PUBLIC_CONTACT_ENDPOINT=https://api.example.com/contact
   ```

浏览器只能向 Contact API 提交表单，不能直接调用 Resend。`RESEND_API_KEY`
必须保存在 Worker/Function Secret 中。Contact API 还应实现：

- 请求来源白名单；
- 字段长度和邮箱格式校验；
- Honeypot 或 Turnstile；
- IP/时间窗口频率限制；
- `replyTo` 使用访客填写的邮箱；
- 失败日志中不记录完整表单和密钥。

Resend 域名验证和 API 文档：

- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend send email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend with Cloudflare](https://resend.com/cloudflare)

### 5. GitHub Actions 总开关

仓库内的 `.github/workflows/ci.yml` 会在 Pull Request 和 `main` 更新时执行：

```sh
npm ci
npm run build
```

建议在 GitHub 中为 `main` 开启 Branch protection，并要求 `CI / build`
通过后才允许合并。

---

## 一、Vercel 部署

### 适用情况

- 希望最少运维；
- 需要保留当前 `/api/contact`；
- 需要直接 SMTP；
- 主要用户不完全依赖中国大陆网络。

### 操作步骤

1. 登录 Vercel，选择 **Add New → Project**。
2. 导入 GitHub 仓库 `KOLPlanet/moca-web`。
3. Framework Preset 选择 Astro，保持：
   - Install command：`npm install` 或默认值；
   - Build command：`npm run build`；
   - Output directory：由 Astro/Vercel adapter 自动识别。
4. 在 **Project Settings → Environments → Production → Branch Tracking**
   中确认生产分支为 `main`。
5. 在 Production Environment Variables 添加：
   - `PUBLIC_SITE_URL`
   - SMTP 配置，或邮件 webhook 配置
6. 在 **Domains** 添加自定义域名并按提示配置 DNS。
7. 触发一次 Production Deployment，并真实提交一次 Contact 表单。

项目在 Vercel 环境中会自动使用 `@astrojs/vercel`。不需要设置
`DEPLOY_TARGET`。

### 自动更新

Vercel Git Integration 会自动：

- 为非 `main` 分支创建 Preview Deployment；
- 在提交或合并到 `main` 后创建 Production Deployment；
- 部署成功后把生产域名切换到新版本。

将 GitHub Repository variable `DEPLOY_TARGET` 设置为 `vercel`，可以确保项目内
其他平台的条件部署 Workflow 保持跳过状态。

### 邮件验证

部署后检查：

1. Contact 表单返回 `Thanks — your message has been sent.`；
2. `CONTACT_TO_EMAIL` 收到邮件；
3. 邮件 Reply-To 是访客填写的地址；
4. Vercel Function Logs 没有 SMTP 或鉴权错误。

官方文档：

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)

---

## 二、GitHub Pages 部署

### 重要限制

GitHub Pages 只发布静态文件，不能运行：

- Astro SSR；
- `/api/contact`；
- Nodemailer；
- SMTP 连接。

因此本方案必须提供一个独立的 HTTPS Contact API，例如：

- 单独部署在 Vercel 的 Contact API；
- Cloudflare Pages Function / Worker；
- 自有服务器的 `/api/contact`；
- 已适配当前 JSON 契约的第三方邮件服务。

该 API 必须返回 JSON，并允许站点域名跨域访问。项目 Node API 与
Cloudflare Pages Function 都支持通过 `CONTACT_ALLOWED_ORIGINS` 配置允许来源。

### 操作步骤

1. 准备外部 Contact API，并确认：

   ```env
   CONTACT_ALLOWED_ORIGINS=https://www.example.com
   ```

2. 在 GitHub **Settings → Secrets and variables → Actions → Variables**
   添加：

   | Repository variable | 示例 |
   | --- | --- |
   | `DEPLOY_TARGET` | `github-pages` |
   | `PUBLIC_SITE_URL` | `https://www.example.com` |
   | `PUBLIC_CONTACT_ENDPOINT` | `https://contact-api.example.com/api/contact` |

3. 在 GitHub **Settings → Pages**：
   - Source 选择 **GitHub Actions**；
   - Custom domain 填写正式域名；
   - 按 GitHub 提示添加 DNS；
   - DNS 生效后启用 **Enforce HTTPS**。

4. 合并代码到 `main`。

`.github/workflows/deploy-github-pages.yml` 会：

1. 检查必要变量；
2. 使用 `DEPLOY_TARGET=github-pages` 构建静态站点；
3. 上传 Pages artifact；
4. 发布到 `github-pages` Environment。

当前站点大量使用根路径 `/news`、`/images/...`，因此此配置以自定义域名或
GitHub 用户根站点为前提，不建议直接部署到
`https://<owner>.github.io/moca-web/` 子路径。

### 自动更新

Workflow 监听：

```yaml
on:
  push:
    branches:
      - main
```

每次 `main` 变化都会重新构建并发布。只有 Repository variable
`DEPLOY_TARGET=github-pages` 时才会真正执行部署。

### 邮件验证

1. 在浏览器 Network 中确认请求发送到 `PUBLIC_CONTACT_ENDPOINT`；
2. 响应包含正确的 `Access-Control-Allow-Origin`；
3. 页面显示发送成功；
4. 收件箱收到邮件。

官方文档：

- [Astro on GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

---

## 三、Cloudflare Pages 部署

### 本项目采用的兼容方式

当前 Astro 版本使用以下组合：

- Astro 主站：静态输出；
- Contact API：`functions/api/contact.ts`；
- 邮件发送：Pages Function 调用 HTTPS 邮件 webhook；
- 自动更新：Cloudflare Pages Git Integration。

这里不使用 Nodemailer。Cloudflare Pages Functions 运行在 Workers runtime，
不是完整 Node.js SMTP 运行时。若必须使用现有 SMTP Host，请把 SMTP 放在
Vercel或自有服务器上，再让 Pages Function 通过 HTTPS 调用。

### Cloudflare Dashboard 操作

1. 打开 **Workers & Pages → Create application → Pages → Import an existing
   Git repository**。
2. 选择 `KOLPlanet/moca-web`。
3. 设置：

   | 选项 | 值 |
   | --- | --- |
   | Production branch | `main` |
   | Build command | `DEPLOY_TARGET=cloudflare-pages npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` |

4. 添加 Build variable：

   ```env
   DEPLOY_TARGET=cloudflare-pages
   PUBLIC_SITE_URL=https://www.example.com
   ```

5. 在 **Settings → Variables and Secrets** 添加运行时 Secret：

   ```env
   CONTACT_MAIL_SERVICE_URL=https://mail-service.example.com/send
   CONTACT_MAIL_SERVICE_TOKEN=<secret-token>
   CONTACT_FROM_EMAIL=website@example.com
   CONTACT_FROM_NAME=MOCA Website
   CONTACT_TO_EMAIL=hello@example.com
   CONTACT_SUBJECT_PREFIX=[MOCA Website]
   ```

6. 如果其他域名也会调用该 Function，再添加：

   ```env
   CONTACT_ALLOWED_ORIGINS=https://www.example.com,https://example.com
   ```

   同域部署不需要额外配置。

7. 添加自定义域名并完成 DNS 配置。
8. 部署后访问 `/api/contact` 并真实提交一次表单。

### 自动更新

Cloudflare Pages Git Integration 会监听 GitHub：

- `main` 新提交自动发布 Production；
- Pull Request/其他分支自动创建 Preview；
- 不需要额外的 Cloudflare GitHub Action。

将 GitHub Repository variable `DEPLOY_TARGET` 设置为 `cloudflare-pages`，可让
GitHub Pages和自有服务器部署 Workflow 自动跳过。

> Cloudflare Pages 项目一旦选择 Git Integration，后续若要改成 Wrangler
> Direct Upload，需要按 Cloudflare 的项目迁移流程处理，不应同时启用两套
> Production 发布方式。

### 邮件验证

1. Cloudflare Functions 日志中没有 `Mail delivery is not configured`；
2. `/api/contact` 返回 200；
3. 邮件 webhook 收到正确的 `replyTo`；
4. 最终收件箱收到邮件。

官方文档：

- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Pages variables and secrets](https://developers.cloudflare.com/pages/functions/bindings/)

---

## 四、自有服务器部署

### 运行要求

- Linux；
- Node.js 22；
- Nginx 或 Caddy；
- systemd、PM2 或 Docker；
- 可以访问 SMTP 服务；
- 部署 webhook 必须使用 HTTPS 并验证 Token。

### 首次部署

```sh
git clone https://github.com/KOLPlanet/moca-web.git /srv/moca-web
cd /srv/moca-web
git checkout main
npm ci
npm run build
```

启动 Astro：

```sh
HOST=127.0.0.1 PORT=4321 node ./dist/server/entry.mjs
```

生产环境建议使用 systemd，并在 Nginx/Caddy 中反向代理到
`127.0.0.1:4321`。环境变量应由 systemd `EnvironmentFile`、Docker Secret
或服务器密钥管理服务注入。

### 自动更新

1. 在 GitHub **Settings → Secrets and variables → Actions → Variables**
   设置：

   ```text
   DEPLOY_TARGET=self-hosted
   ```

2. 创建 GitHub Environment：`production`。
3. 在该 Environment 添加：

   | Secret | 说明 |
   | --- | --- |
   | `DEPLOY_WEBHOOK_URL` | 服务器 HTTPS 部署入口 |
   | `DEPLOY_WEBHOOK_SECRET` | 足够长的随机 Bearer Token |

4. 服务器部署入口收到请求后必须：
   - 验证 `Authorization: Bearer ...`；
   - 验证 `repository=KOLPlanet/moca-web`；
   - 验证 `branch=main`；
   - 防止两个部署任务同时执行；
   - 获取指定 `sha`；
   - 在新 release 目录运行 `npm ci && npm run build`；
   - 构建成功后原子切换 release；
   - 重启或 reload 服务；
   - 构建失败时保留旧版本。

`.github/workflows/deploy-webhook.yml` 只会在以下条件全部满足时通知服务器：

- CI Workflow 成功；
- 分支为 `main`；
- `DEPLOY_TARGET=self-hosted`。

请求格式：

```http
POST /deploy
Authorization: Bearer <DEPLOY_WEBHOOK_SECRET>
Content-Type: application/json

{
  "repository": "KOLPlanet/moca-web",
  "sha": "<已经通过 CI 的 commit sha>",
  "branch": "main"
}
```

不要让部署 URL 直接执行请求体中的命令，也不要允许客户端传入任意分支、
目录或 shell 参数。

### 邮件验证

自有服务器可以直接使用本文前面的 SMTP 配置。上线后检查：

```sh
journalctl -u moca-web -f
```

然后提交 Contact 表单，确认接口、日志和收件箱都正常。

---

## 切换部署平台

建议一次只启用一个生产部署目标：

| Repository variable `DEPLOY_TARGET` | 生效方式 |
| --- | --- |
| `vercel` | Vercel Git Integration |
| `github-pages` | `deploy-github-pages.yml` |
| `cloudflare-pages` | Cloudflare Pages Git Integration |
| `self-hosted` | `deploy-webhook.yml` |

修改部署目标前：

1. 先在新平台完成 Preview/测试域名部署；
2. 验证 Contact 邮件；
3. 再切换正式 DNS；
4. 最后停用旧平台自动部署。

## 回滚

- Vercel：Promote 上一个成功 Deployment。
- GitHub Pages：Re-run 旧提交对应 Workflow，或 revert `main`。
- Cloudflare Pages：在 Deployments 中回滚/重新发布旧版本。
- 自有服务器：切回上一个 immutable release 后重启服务。
