---
title: 开机动画启动分析
category: 技术/Android/Framework
order: 1
date: 2026-02-22
---

## 开机动画启动分析

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

`StartPropertySetThread.cpp`

SurfaceFlinger::init() 触发 Start() 方法后
  - 作用/动机：注释说明 property_set() 在 init 阶段可能阻塞（例如并发 mount_all --late），所以单独起线程避免阻塞 SF init。见 frameworks/native/services/surfaceflinger/
    StartPropertySetThread.h:27。
  - Start() 做什么：Start() 只是调用 Thread::run() 启动线程。见 frameworks/native/services/surfaceflinger/StartPropertySetThread.cpp:25。
  - run() 触发的实际工作：线程执行 threadLoop()，依次：
      1. 设置 service.sf.present_timestamp（值由构造参数决定）；
      2. 清空 bootanim 退出与进度标志：service.bootanim.exit=0、service.bootanim.progress=0；
      3. 通过 ctl.start=bootanim 触发启动 bootanimation 服务；
      4. 返回 false 立刻退出线程。
         见 frameworks/native/services/surfaceflinger/StartPropertySetThread.cpp:29。
  - SurfaceFlinger::init 里如何调用：先根据 HWC 能力算 presentFenceReliable，再创建 StartPropertySetThread 并 Start()。见 frameworks/native/services/surfaceflinger/
    SurfaceFlinger.cpp:839。

```c++
namespace android {

StartPropertySetThread::StartPropertySetThread(bool timestampPropertyValue):
        Thread(false), mTimestampPropertyValue(timestampPropertyValue) {}

status_t StartPropertySetThread::Start() {
    return run("SurfaceFlinger::StartPropertySetThread", PRIORITY_NORMAL);
}

bool StartPropertySetThread::threadLoop() {
    // Set property service.sf.present_timestamp, consumer need check its readiness
    property_set(kTimestampProperty, mTimestampPropertyValue ? "1" : "0");
    // Clear BootAnimation exit flag
    property_set("service.bootanim.exit", "0");
    property_set("service.bootanim.progress", "0");
    // Start BootAnimation if not started
    property_set("ctl.start", "bootanim");
    // Exit immediately
    return false;
}

} // namespace android
```

### Init

代码位置

system/core/init

  - main() 在 system/core/init/main.cpp
  - 第一阶段 FirstStageMain()（system/core/init/first_stage_init.cpp）
  - 第二阶段 SecondStageMain()（system/core/init/init.cpp）

主要分析第二阶段

init.cpp

```c++
int SecondStageMain(int argc, char** argv) {
    ...
	StartPropertyService(&property_fd);
    ...
}
```

property_service.cpp

```c++
void StartPropertyService(int* epoll_socket) {
    InitPropertySet("ro.property_service.version", "2");

    int sockets[2];
    if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, sockets) != 0) {
        PLOG(FATAL) << "Failed to socketpair() between property_service and init";
    }
    *epoll_socket = from_init_socket = sockets[0];
    init_socket = sockets[1];
    StartSendingMessages();

    if (auto result = CreateSocket(PROP_SERVICE_NAME, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK,
                                   false, 0666, 0, 0, {});
        result.ok()) {
        property_set_fd = *result;
    } else {
        LOG(FATAL) << "start_property_service socket creation failed: " << result.error();
    }

    listen(property_set_fd, 8);

    auto new_thread = std::thread{PropertyServiceThread};
    property_service_thread.swap(new_thread);
}
```

  1. StartPropertyService() 建立 property_service_socket 并启动线程

  - system/core/init/property_service.cpp:1370（创建 socket、启动 PropertyServiceThread）

  2. property_set("ctl.start", "bootanim") 到达 property_service

  - system/core/init/property_service.cpp:527（handle_property_set_fd() 接收请求）
  - system/core/init/property_service.cpp:481（HandlePropertySet() 处理）
  - system/core/init/property_service.cpp:489（检测 ctl.*，调用 SendControlMessage()）

  3. 发送控制消息给 init 主循环

  - system/core/init/property_service.cpp:390（SendControlMessage()）
  - system/core/init/property_service.cpp:405 → QueueControlMessage()
  - system/core/init/init.cpp:464（QueueControlMessage()）

  4. init 主循环处理控制消息并启动服务

  - system/core/init/init.cpp:476（HandleControlMessages()）
  - system/core/init/init.cpp:382（DoControlStart()）

  所以：StartPropertyService() 是这条链路的“入口服务端”，ctl.start=bootanim 会通过它被接收并转成控制消息，最终触发 DoControlStart() 启动 bootanim 服务。