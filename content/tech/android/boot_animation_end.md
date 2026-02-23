---
title: 开机动画运行到停止分析
category: 技术/Android/Framework
order: 1
date: 2026-02-22
---

## 开机动画运行到停止分析

### bootanimation

代码位置：

frameworks/base/cmds/bootanimation

启动我们的开机动画会进入 `bootanimation_main.cpp` 的 main 方法，这里会 new BootAnimation

```c++
int main()
{
    setpriority(PRIO_PROCESS, 0, ANDROID_PRIORITY_DISPLAY);

    bool noBootAnimation = bootAnimationDisabled();
    ALOGI_IF(noBootAnimation,  "boot animation disabled");
    if (!noBootAnimation) {

        sp<ProcessState> proc(ProcessState::self());
        ProcessState::self()->startThreadPool();

        // create the boot animation object (may take up to 200ms for 2MB zip)
        sp<BootAnimation> boot = new BootAnimation(audioplay::createAnimationCallbacks());

        waitForSurfaceFlinger();

        boot->run("BootAnimation", PRIORITY_DISPLAY);

        ALOGV("Boot animation set up. Joining pool.");

        IPCThreadState::self()->joinThreadPool();
    }
    return 0;
}
```

BootAnimation.cpp

```c++
BootAnimation::BootAnimation(sp<Callbacks> callbacks)
        : Thread(false), mLooper(new Looper(false)), mClockEnabled(true), mTimeIsAccurate(false),
        mTimeFormat12Hour(false), mTimeCheckThread(nullptr), mCallbacks(callbacks) {
    mSession = new SurfaceComposerClient();

    std::string powerCtl = android::base::GetProperty("sys.powerctl", "");
    if (powerCtl.empty()) {
        mShuttingDown = false;
    } else {
        mShuttingDown = true;
    }
    ALOGD("%sAnimationStartTiming start time: %" PRId64 "ms", mShuttingDown ? "Shutdown" : "Boot",
            elapsedRealtime());
}

void BootAnimation::onFirstRef() {
    status_t err = mSession->linkToComposerDeath(this);
    SLOGE_IF(err, "linkToComposerDeath failed (%s) ", strerror(-err));
    if (err == NO_ERROR) {
        // Load the animation content -- this can be slow (eg 200ms)
        // called before waitForSurfaceFlinger() in main() to avoid wait
        ALOGD("%sAnimationPreloadTiming start time: %" PRId64 "ms",
                mShuttingDown ? "Shutdown" : "Boot", elapsedRealtime());
        preloadAnimation();
        ALOGD("%sAnimationPreloadStopTiming start time: %" PRId64 "ms",
                mShuttingDown ? "Shutdown" : "Boot", elapsedRealtime());
    }
}
```

  启动链路（init → SurfaceFlinger → bootanimation 进程）

  - init 注册 bootanim 服务：frameworks/base/cmds/bootanimation/bootanim.rc:1（service bootanim /system/bin/bootanimation，oneshot）。
  - SurfaceFlinger 初始化完成后启动属性线程：frameworks/native/services/surfaceflinger/SurfaceFlinger.cpp:841。
  - StartPropertySetThread 在 threadLoop() 里发起启动：
      - 清空退出标记 service.bootanim.exit=0
      - property_set("ctl.start","bootanim") 触发 init 启动 bootanim 服务
        位置：frameworks/native/services/surfaceflinger/StartPropertySetThread.cpp:22-30

  bootanimation 进程主流程

  - 入口：frameworks/base/cmds/bootanimation/bootanimation_main.cpp:24
      - 创建 BootAnimation 对象
      - boot->run() 启动线程，进入 readyToRun()→threadLoop()
  - 资源/显示环境初始化：BootAnimation::readyToRun()
      - 创建 Surface、初始化 EGL、注册 DisplayEventReceiver
        位置：frameworks/base/cmds/bootanimation/BootAnimation.cpp:494
  - 渲染主循环：BootAnimation::threadLoop()
      - 有 zip → movie()；无 zip → android()
        位置：frameworks/base/cmds/bootanimation/BootAnimation.cpp:760

  退出触发逻辑（谁设置“退出标记”）

  - 关键退出标记是属性 service.bootanim.exit，BootAnimation::checkExit() 每帧读取它：
      - 若为 1 → requestExit()
        位置：frameworks/base/cmds/bootanimation/BootAnimation.cpp:853
  - 置位 service.bootanim.exit=1 的主要触发点：
      1. WindowManagerService 在“屏幕可显示/窗口已绘制”阶段停止 bootanim：
         frameworks/base/services/core/java/com/android/server/wm/WindowManagerService.java:3700
      2. SurfaceFlinger 在 bootFinished() 里也会设 service.bootanim.exit=1：
         frameworks/native/services/surfaceflinger/SurfaceFlinger.cpp:664

  退出时“动画何时真正停”

  - exitPending() 被置位后，播放逻辑会按动画配置决定在哪一帧/哪一段退出：
      - playUntilComplete、framesToFadeCount 等控制“淡出”和“播完再停”
        位置：BootAnimation::playAnimation() 与 shouldStopPlayingPart()
        frameworks/base/cmds/bootanimation/BootAnimation.cpp:1390、1564、1620

  一句话总结

  - SurfaceFlinger 用 ctl.start bootanim 触发 init 启动 bootanimation。
  - bootanimation 通过 service.bootanim.exit 轮询决定退出；这个属性由 WMS（显示就绪）和 SurfaceFlinger（bootFinished）置 1。
  - 退出时是否淡出/播完取决于 bootanimation.zip 里 part 的配置。