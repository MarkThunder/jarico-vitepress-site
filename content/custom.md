---
title: 自定义方案说明书
category: 说明
order: 1
date: 2026-02-15
---

# VitePress 自定义方案说明书（最小改动优先）

本文基于当前工程结构整理，优先选择“改动小、影响面小、不破坏其他模块”的自定义方式。

## 1. 项目结构与入口

- 站点配置：`.vitepress/config.mts`
- 主题扩展：`.vitepress/theme/index.ts`
- 主题样式：`.vitepress/theme/style.css`
- 内容页面：`*.md`（如 `index.md`、`markdown-examples.md`、`api-examples.md`）

## 2. 低风险自定义（推荐优先）

### 2.1 站点信息与导航（配置层）

文件：`.vitepress/config.mts`

可改项（影响范围小）：
- 站点标题/描述：`title`、`description`
- 顶部导航：`themeConfig.nav`
- 侧边栏：`themeConfig.sidebar`
- 社交链接：`themeConfig.socialLinks`

建议做法：
- 只调整文字和链接，不改结构字段名
- 新增页面时同步补充 `nav` / `sidebar`

### 2.2 首页文案与模块（内容层）

文件：`index.md`

可改项：
- 首页布局：`layout: home`（保留即可）
- Hero 区：`hero.name` / `hero.text` / `hero.tagline` / `hero.actions`
- 特性卡片：`features` 列表

建议做法：
- 改文案/链接即可，无需改布局结构
- `actions` 的 `link` 保持指向已有页面

### 2.3 主题色与基础样式（样式层）

文件：`.vitepress/theme/style.css`

可改项（推荐仅改 CSS 变量）：
- 品牌色：`--vp-c-brand-*`
- 提示块颜色：`--vp-c-tip-*` / `--vp-c-warning-*` / `--vp-c-danger-*`
- 按钮颜色：`--vp-button-brand-*`
- 首页 Hero 渐变：`--vp-home-hero-*`

建议做法：
- 优先覆盖变量，不写具体选择器
- 改动集中在 `:root` 区块中

## 3. 中等风险自定义（谨慎使用）

### 3.1 布局插槽扩展

文件：`.vitepress/theme/index.ts`

可做内容：
- 利用 DefaultTheme Layout slots 添加组件（如公告条、全局提示）

风险说明：
- 影响全站布局
- 需要写 Vue 组件，维护成本略高

建议：
- 确认需求稳定后再加
- 仅在有明确新增 UI 模块时使用

## 4. 内容页面扩展（低风险）

文件：任意 `*.md`

可做内容：
- 增加新页面
- 追加章节
- 使用 VitePress Markdown 扩展语法（如 `::: tip`）

建议：
- 新增页面后同步更新 `sidebar`/`nav`
- 内容变动不影响其他模块

## 5. 推荐的最小改动路径（按优先级）

1. 改文案：`index.md`
2. 改标题/导航/侧栏：`.vitepress/config.mts`
3. 改品牌色：`.vitepress/theme/style.css`
4. 扩展布局：`.vitepress/theme/index.ts`

## 6. 当前项目内可直接修改的文件清单

- `.vitepress/config.mts`（站点结构）
- `.vitepress/theme/style.css`（样式变量）
- `index.md`（首页）
- `markdown-examples.md`（示例页）
- `api-examples.md`（示例页）

---

如需我按你的目标（例如“换成某品牌色”“改首页结构”）提供具体改法，可以直接告诉我目标。
