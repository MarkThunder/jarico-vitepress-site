---
title: Android 剪贴板记录应用开发实践
category: tech/Android/app
order: 1
date: 2026-02-23
---

## 前言

本文记录了一个 Android 剪贴板记录应用的完整开发过程，包括架构设计、踩坑经历以及最终的解决方案。该应用的核心功能是监听用户的复制操作，最多记录 10 条历史，设备重启后自动清空。

项目地址：https://github.com/MarkThunder/ClipHistory

---

## 技术栈

- 语言：Kotlin
- 架构：MVVM + Repository 模式
- 异步：Coroutines + StateFlow
- UI：RecyclerView + ListAdapter + DiffUtil + ViewBinding
- 构建：AGP 8.3.2 + Gradle 8.6 + Version Catalog

---

## 项目结构

```
app/src/main/java/com/example/pasteapp/
├── data/
│   ├── ClipboardItem.kt        # 数据模型
│   └── ClipboardUiState.kt     # sealed class UI 状态
├── repository/
│   └── ClipboardRepository.kt  # 单例内存数据源
├── ui/
│   ├── MainActivity.kt         # UI 层，无业务逻辑
│   └── ClipboardAdapter.kt     # ListAdapter + DiffUtil
└── viewmodel/
    └── ClipboardViewModel.kt   # 状态转换，viewModelScope
```

数据单向流动：

```
用户复制 → MainActivity(onWindowFocusChanged)
              → ClipboardViewModel.addItem()
                  → ClipboardRepository(StateFlow)
                      → ViewModel(uiState)
                          → MainActivity(submitList)
```

---

## 踩坑记录

### 1. AGP 版本与 JDK 版本不兼容

**现象：**

```
No matching variant of com.android.tools.build:gradle:8.3.2 was found.
Incompatible because this component declares a component compatible with Java 11
and the consumer needed a component compatible with Java 8
```

**原因：** AGP 7.0 起就要求 JDK 11+，AGP 8.x 要求 JDK 17+。系统默认 JDK 是 Java 8，直接 Sync 就报错。

**解决方案：** 机器上有 Android Studio 2024.2，其内置 JBR 21。在 Studio 里指定 Gradle JDK：

```
File → Settings → Build, Execution, Deployment → Build Tools → Gradle
  → Gradle JDK → 选择 Embedded JDK (JBR 21)
```

这样系统默认 `java` 命令不受影响，AOSP 等其他编译环境完全隔离。

---

### 2. 后台无法读取剪贴板

**现象：**

```
Denying clipboard access to com.example.pasteapp,
application is not in focus nor is it a system service for user 0
```

**原因：** Android 10+ 限制后台应用访问剪贴板，Android 12+ 更严格，前台服务也无法绕过。

**最初方案：** 使用前台 Service + `ClipboardManager.OnPrimaryClipChangedListener` 监听。

**最终方案：** 放弃后台监听，改为在 `onWindowFocusChanged` 获焦时读取剪贴板。用户复制后切回 app，此时 app 处于前台，系统允许访问。

```kotlin
override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
        clipboardManager.addPrimaryClipChangedListener(inAppClipListener)
        readClipboard()
    } else {
        clipboardManager.removePrimaryClipChangedListener(inAppClipListener)
    }
}
```

同时在窗口有焦点期间注册 `OnPrimaryClipChangedListener`，实现 app 内复制立即置顶，失焦时注销避免后台触发。

---

### 3. 前台服务类型权限缺失（API 34）

**现象：**

```
Starting FGS with type dataSync requires permissions:
allOf=true [android.permission.FOREGROUND_SERVICE_DATA_SYNC]
```

**原因：** Android 14 (API 34) 要求每种 `foregroundServiceType` 必须声明对应的专属权限，仅声明 `FOREGROUND_SERVICE` 不够。

**解决：** 在 Manifest 补充对应权限（后来因改用 `onWindowFocusChanged` 方案，前台服务整体被移除）。

---

### 4. 删除/清空后内容被重新读回

**现象：** 删除某条记录或点击清空后，重新打开 app，刚才删除的内容又出现了。

**原因：** `onWindowFocusChanged` 获焦时会读取系统剪贴板，而系统剪贴板里的内容并没有被清除。

**解决：** 在 Repository 维护一个 `deletedContents` 黑名单：

```kotlin
private val deletedContents = mutableSetOf<String>()

fun addItem(content: String) {
    if (deletedContents.contains(content)) return
    // ...
}

fun removeItem(id: Long) {
    val content = _items.value.find { it.id == id }?.content
    if (content != null) deletedContents.add(content)
    _items.value = _items.value.filter { it.id != id }
}

fun clearAll(currentClipContent: String? = null) {
    deletedContents.clear()
    if (!currentClipContent.isNullOrEmpty()) deletedContents.add(currentClipContent)
    _items.value = emptyList()
}
```

删除单条时将内容加入黑名单；清空时先清空黑名单，再把当前剪贴板内容加入黑名单，防止下次获焦被读回。

---

### 5. 重复内容处理

需求：同一内容再次复制时，移除旧记录，将新记录置顶（更新时间戳）。

```kotlin
fun addItem(content: String) {
    if (deletedContents.contains(content)) return
    val current = _items.value
    if (current.isNotEmpty() && current.first().content == content) return

    val newItem = ClipboardItem(
        id = System.currentTimeMillis(),
        content = content,
        timestamp = System.currentTimeMillis()
    )
    // 过滤掉所有相同内容的旧记录，插入顶部
    _items.value = (listOf(newItem) + current.filter { it.content != content }).take(MAX_ITEMS)
}
```

---

## 国内镜像加速

Gradle 和 Maven 依赖默认走官方源，在国内下载极慢，配置镜像后速度提升明显。

`gradle-wrapper.properties`：

```properties
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-8.6-bin.zip
```

`settings.gradle.kts`：

```kotlin
pluginManagement {
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }
        maven { url = uri("https://maven.aliyun.com/repository/central") }
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/central") }
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        google()
        mavenCentral()
    }
}
```

---

## 总结

| 问题 | 根因 | 方案 |
|------|------|------|
| AGP 与 JDK 不兼容 | 系统 JDK 8，AGP 8.x 需要 JDK 17+ | 使用 Android Studio 内置 JBR 21 |
| 后台无法读剪贴板 | Android 10+ 系统限制 | 改用 `onWindowFocusChanged` 前台读取 |
| API 34 前台服务权限 | 新增专属权限要求 | 补充 `FOREGROUND_SERVICE_DATA_SYNC` |
| 删除后内容被读回 | 系统剪贴板未清除 | Repository 维护黑名单 |
| 重复内容置顶 | 直接插入不去重 | 先过滤旧记录再插入顶部 |
