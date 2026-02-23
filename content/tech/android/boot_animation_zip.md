---
title: 开机动画 .zip 预制
category: 技术/Android/Framework
order: 1
date: 2026-02-23
---

### 预制步骤

 Bootanimation.zip 编进 system/media 的步骤（AOSP 13 / sdk_phone_x86_64）

  1. 准备动画文件
     把 bootanimation.zip 放到源码树内，例如：
     device/generic/goldfish/bootanimation/bootanimation.zip
  2. 在产品 mk 中加入复制规则
     编辑 build/make/target/product/sdk_phone_x86_64.mk，添加：

  PRODUCT_COPY_FILES += \
      device/generic/goldfish/bootanimation/bootanimation.zip:system/media/bootanimation.zip

  3. 允许 artifact path（该产品有校验）
     同一文件中加入白名单：

  PRODUCT_ARTIFACT_PATH_REQUIREMENT_ALLOWED_LIST += \
      system/media/bootanimation.zip

  4. 编译
     执行：

  m -j$(nproc)

  这样编译出的 system 镜像里就会包含 /system/media/bootanimation.zip。

### zip解析

  基本参数

  - 分辨率：543 x 143
  - 帧率：60 fps

  desc.txt 内容

  543 143 60
  c 1 30 part0
  c 1 0 part1
  c 0 0 part2
  c 1 64 part3
  c 1 15 part4

  字段含义（标准 BootAnimation 约定）

  - 行格式：<type> <count> <pause> <folder>
  - type：p=普通播放；c=播放并在支持时叠加时钟（你这里全是 c）
  - count：播放次数，0 表示无限循环
  - pause：每次播放结束后额外停顿的帧数（按 fps 换算为秒）
  - folder：帧图片目录

  各段解析（含帧数与时长）

  - part0：1 帧
      - 播放 1 次；播放时长 1/60 = 0.017s
      - 结束暂停 30/60 = 0.5s
  - part1：109 帧
      - 播放 1 次；时长 109/60 ≈ 1.817s
  - part2：180 帧
      - 无限循环；每轮 180/60 = 3.0s
  - part3：107 帧
      - 播放 1 次；时长 107/60 ≈ 1.783s
      - 结束暂停 64/60 ≈ 1.067s
  - part4：58 帧
      - 播放 1 次；时长 58/60 ≈ 0.967s
      - 结束暂停 15/60 = 0.25s

  整体播放逻辑（常见实现）

  - 通常 part0 → part1 → part2 循环播放。
  - 当系统设置 service.bootanim.exit 或 sys.boot_completed 后，bootanimation 进
    程会退出；part2 可能在当前循环结束后退出。
  - 是否继续播放 part3/part4 取决于厂商的 bootanimation 实现，有的会直接退出不播
    放后续，有的会在收到退出信号后执行“尾场”段。