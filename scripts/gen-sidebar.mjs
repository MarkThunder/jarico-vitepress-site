import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const contentDir = path.join(repoRoot, 'content')
const outputFile = path.join(repoRoot, '.vitepress', 'sidebar.ts')

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---')) return {}
  const end = markdown.indexOf('\n---', 3)
  if (end === -1) return {}
  const raw = markdown.slice(3, end).trim()
  const data = {}
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    value = value.replace(/^['"]|['"]$/g, '')
    data[key] = value
  }
  return data
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files
}

function toLink(relPath) {
  const withoutExt = relPath.replace(/\\/g, '/').replace(/\.md$/, '')
  if (withoutExt === 'index') return '/'
  if (withoutExt.endsWith('/index')) {
    return `/${withoutExt.slice(0, -'/index'.length)}/`
  }
  return `/${withoutExt}`
}

function toText(relPath, title) {
  if (relPath === 'index.md') return 'Home'
  return title || path.basename(relPath, '.md')
}

function addToTree(tree, categoryPath, item) {
  const parts = categoryPath.split('/').map((p) => p.trim()).filter(Boolean)
  let node = tree
  for (const part of parts) {
    if (!node.children.has(part)) {
      node.children.set(part, { text: part, children: new Map(), items: [] })
    }
    node = node.children.get(part)
  }
  node.items.push(item)
}

function buildSidebarFromTree(node) {
  const sections = []
  const children = Array.from(node.children.values()).sort((a, b) =>
    a.text.localeCompare(b.text, 'zh-Hans-CN')
  )
  for (const child of children) {
    const items = child.items.map(({ text, link }) => ({ text, link }))
    const nested = buildSidebarFromTree(child)
    const mergedItems = items.concat(nested)
    sections.push({ text: child.text, items: mergedItems })
  }
  return sections
}

async function main() {
  const files = await walk(contentDir)
  const items = []

  for (const file of files) {
    const relPath = path.relative(contentDir, file)
    const markdown = await fs.readFile(file, 'utf8')
    const frontmatter = parseFrontmatter(markdown)
    const title = frontmatter.title || extractTitle(markdown)
    const category = frontmatter.category || 'Other'
    const order = Number.isFinite(Number(frontmatter.order))
      ? Number(frontmatter.order)
      : Number.POSITIVE_INFINITY
    const date = frontmatter.date || ''

    if (relPath === 'index.md') continue

    items.push({
      category,
      order,
      date,
      text: toText(relPath, title),
      link: toLink(relPath),
    })
  }

  const tree = { children: new Map(), items: [] }
  for (const item of items) {
    addToTree(tree, item.category, item)
  }

  function sortTree(node) {
    for (const child of node.children.values()) {
      child.items.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        return a.text.localeCompare(b.text, 'zh-Hans-CN')
      })
      sortTree(child)
    }
  }
  sortTree(tree)

  const sidebar = buildSidebarFromTree(tree)

  const content = `export default ${JSON.stringify(sidebar, null, 2)}\n`
  await fs.writeFile(outputFile, content, 'utf8')
  console.log(`Generated sidebar with ${items.length} items.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
