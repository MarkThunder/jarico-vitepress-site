---
title: 开机动画分析
category: 技术/Android/Framework
order: 1
date: 2026-02-22
---

## 开机动画分析

### bootanimation

代码位置：

frameworks/base/cmds/bootanimation

  - Android.bp:1：Soong 构建配置。定义 bootanimation 可执行文件和 libbootanimation 共享库、源码列表、依赖库以及 init rc 文件。
  - bootanimation_main.cpp:1：入口 main()。设置进程优先级，判断是否禁用 bootanimation，启动 Binder 线程池，创建 BootAnimation（带音频回调），等待 SurfaceFlinger 后运行
    动画线程。
  - BootAnimation.h:1：核心类声明。定义 BootAnimation、动画数据结构（Animation/Part/Frame/Font）、回调接口、渲染/加载/时间检测等成员与方法签名。
  - BootAnimation.cpp:1：核心实现。负责加载动画 zip、解析 desc.txt、预加载帧与 trim.txt/audio.wav、EGL/GL 渲染、时钟与进度显示、动态配色、显示裁剪/投影处理、退出逻辑
    等。
  - BootAnimationUtil.h:1 / BootAnimationUtil.cpp:1：辅助函数。检查是否禁用动画、等待 SurfaceFlinger、判断是否允许播放声音（基于系统属性与 bootreason）。
  - audioplay.h:1 / audioplay.cpp:1：OpenSL ES 播放引擎与 WAV 解析。提供 BootAnimation 回调实现：在动画初始化时建音频引擎、在指定 part 首次播放 audio.wav、结束时销毁引
    擎。
  - bootanim.rc:1：init service 定义。声明 bootanim 服务、运行用户/组、进程属性（oneshot、rt ioprio、MaxPerformance 等）。
  - FORMAT.md:1：bootanimation.zip 格式文档。包含 desc.txt 语法、部件目录、trim.txt、audio.wav、字体说明、动态配色规则等。
  - OWNERS:1：代码所有者列表，用于审核与维护责任归属。

### surfaceflinger

代码位置

frameworks/native/services/surfaceflinger

init 进程启动之后会启动 `surfaceflinger.rc` 文件

```
service surfaceflinger /system/bin/surfaceflinger
    class core animation
    user system
    group graphics drmrpc readproc
    capabilities SYS_NICE
    onrestart restart --only-if-running zygote
    task_profiles HighPerformance
    socket pdx/system/vr/display/client     stream 0666 system graphics u:object_r:pdx_display_client_endpoint_socket:s0
    socket pdx/system/vr/display/manager    stream 0666 system graphics u:object_r:pdx_display_manager_endpoint_socket:s0
    socket pdx/system/vr/display/vsync      stream 0666 system graphics u:object_r:pdx_display_vsync_endpoint_socket:s0
```

然后会执行 `main_surfaceflinger.cpp` 

```c++
int main(int, char**) {
	...

    // instantiate surfaceflinger
    sp<SurfaceFlinger> flinger = surfaceflinger::createSurfaceFlinger();

	...

    // initialize before clients can connect
    flinger->init();

	...

    // run surface flinger in this thread
    flinger->run();

    return 0;
}
```

再看 `SurfaceFlinger.cpp` 的 init 方法

```c++
void SurfaceFlinger::init() {
	...
    mStartPropertySetThread = getFactory().createStartPropertySetThread(presentFenceReliable);

    if (mStartPropertySetThread->Start() != NO_ERROR) {
        ALOGE("Run StartPropertySetThread failed!");
    }

    ALOGV("Done initializing");
}
```

