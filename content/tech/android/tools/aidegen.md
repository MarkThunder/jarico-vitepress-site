---
title: aidegen 使用
category: 技术/Android/tools
order: 1
date: 2026-02-15
---

## AIDEGEN 使用手册（AOSP 简明版）

------

# 1️⃣ 环境准备

```bash
source build/envsetup.sh
lunch <target>
```

建议：

```bash
lunch aosp_cf_x86_64_phone-userdebug
```

------

# 2️⃣ 基本用法

## 生成工程（推荐）

```bash
aidegen -n <path_or_module>
```

例子：

```bash
aidegen -n frameworks/av
```

说明：

- `-n` = 只生成，不自动打开 IDE

------

## 按模块名生成

```bash
aidegen -n Settings
```

------

## 多模块

```bash
aidegen -n frameworks/av frameworks/base/services
```

------

# 3️⃣ 推荐使用方式（重点）

❌ 不要：

```bash
aidegen -n frameworks/base
```

✅ 应该：

```bash
aidegen -n frameworks/base/services
```

原则：

> 只加载当前开发模块。

------

# 4️⃣ 打开工程

Android Studio / IntelliJ：

```
Open → 编译的对应模块根目录
```

------

# 5️⃣ 常用参数

| 参数            | 作用                 |
| --------------- | -------------------- |
| `-n`            | 只生成 project       |
| `--skip-build`  | 跳过 build，速度更快 |
| `-p <ide_path>` | 指定 IDE 路径        |

例：

```bash
aidegen --skip-build -n frameworks/av
```

------

# 6️⃣ 常见问题

## IDE 卡死

原因：

- 模块太大

解决：

```
只导入子目录
```

------

## 找不到 IDE

使用：

```bash
aidegen -n ...
```

------

## Python 报错

使用：

```
Python 3.8–3.10
```

------

# 7️⃣ 推荐工作流（AOSP 系统开发）

```bash
aidegen -n frameworks/av
aidegen -n frameworks/base/services
```

不要一次加载整个 AOSP。

------

# 8️⃣ 一句话总结

```
aidegen = 按模块生成 IDE 工程
模块越小，IDE 越流畅
```