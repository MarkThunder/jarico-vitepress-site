import { defineConfig } from 'vitepress'
import sidebar from './sidebar'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  // GitHub Pages 项目站点需要设置 base 为仓库名
  base: "/jarico-vitepress-site/",
  // 统一内容目录，配合脚本自动生成侧边栏
  srcDir: "content",
  title: "Jarico",
  description: "Jarico site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: '随笔', link: '/tobecontinue' }
    ],

    sidebar,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/MarkThunder' }
    ],

    footer: {
      copyright: "Copyright © 2026 Jarico"
    }
  }
})
