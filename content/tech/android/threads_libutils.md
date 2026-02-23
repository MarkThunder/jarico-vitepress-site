---
title: libutils Thread 解析
category: 技术/Android/Framework
order: 2
date: 2026-02-23
---
## 背景

  system/core/libutils/Threads.cpp 是 Android native 层线程封装的实现文件，
  提供：

  - android::Thread 基类（C++ 封装）
  - androidCreateRawThreadEtc 等 C 接口封装（pthread / Win32 兼容）

  对应头文件在：system/core/libutils/include/utils/Thread.h。

## Thread 基类的角色

  这是 native 层常用的线程基类，派生类只需实现 threadLoop()，
  然后调用 run() 启动线程。

  注意：文件里有注释提示“DO NOT USE: please use std::thread”，
  但在 AOSP 中仍广泛使用该封装（尤其在 legacy 代码中）。

## 核心方法速览

  - run(name, priority, stack)
    启动线程，内部创建 pthread，最终进入 _threadLoop。
  - threadLoop()
    纯虚函数，派生类实现；返回 true 继续循环，返回 false 退出。
  - readyToRun()
    一次性初始化钩子，在第一次 threadLoop 之前调用。
  - requestExit() / requestExitAndWait() / join()
    退出请求与等待线程结束。
  - isRunning() / exitPending() / getTid()
    运行状态、退出标记与线程内核 ID。

## 线程生命周期流程

  1. run() 做状态初始化，持有自身强引用，创建系统线程。
  2. 子线程进入 _threadLoop：
     - 第一次先调用 readyToRun()
     - 若成功且未被请求退出，则至少执行一次 threadLoop()
  3. 后续循环：每次调用 threadLoop()，直到返回 false 或收到退出请求。
  4. 退出时清理状态并广播条件变量，唤醒 join/requestExitAndWait。

## 关键细节

  - 线程创建使用 detached 属性（pthread 创建后自动回收）。
  - run() 时必须传入线程名（name 不能为空）。
  - requestExitAndWait / join 不能在本线程里调用，否则会死锁（返回 WOULD_BLOCK）。
  - _threadLoop 使用强/弱引用确保线程对象在生命周期内存活。

## C 接口封装（AndroidThreads）

  libutils 同时提供 C 级别封装，供非 Thread 类使用：

  - androidCreateRawThreadEtc()
  - androidCreateThreadEtc()
  - androidCreateThread()
  - androidCreateThreadGetID()
  - androidSetThreadName()
  - androidSetThreadPriority()

  这些接口在 Android 上会设置线程名、优先级，并封装 platform 差异。

## 小结

  Threads.cpp 不是“单一类”，而是 libutils 的线程基础实现：
  既包含 C++ Thread 基类，又包含 C 接口线程封装。
  理解 run → _threadLoop → threadLoop 的控制流程，是掌握该基类的关键。
