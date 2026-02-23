---
title: 开机动画OpenGL绘制
category: 技术/Android/Framework
order: 1
date: 2026-02-22
---
## 开机动画OpenGL绘制

### bootanimation

代码位置：

frameworks/base/cmds/bootanimation

BootAnimation.cpp

```c++
bool BootAnimation::android() {
    glActiveTexture(GL_TEXTURE0);

    SLOGD("%sAnimationShownTiming start time: %" PRId64 "ms", mShuttingDown ? "Shutdown" : "Boot",
            elapsedRealtime());
    initTexture(&mAndroid[0], mAssets, "images/android-logo-mask.png");
    initTexture(&mAndroid[1], mAssets, "images/android-logo-shine.png");

    mCallbacks->init({});

    // clear screen
    glDisable(GL_DITHER);
    glDisable(GL_SCISSOR_TEST);
    glUseProgram(mImageShader);

    glClearColor(0,0,0,1);
    glClear(GL_COLOR_BUFFER_BIT);
    eglSwapBuffers(mDisplay, mSurface);

    // Blend state
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    const nsecs_t startTime = systemTime();
    do {
        processDisplayEvents();
        const GLint xc = (mWidth  - mAndroid[0].w) / 2;
        const GLint yc = (mHeight - mAndroid[0].h) / 2;
        const Rect updateRect(xc, yc, xc + mAndroid[0].w, yc + mAndroid[0].h);
        glScissor(updateRect.left, mHeight - updateRect.bottom, updateRect.width(),
                updateRect.height());

        nsecs_t now = systemTime();
        double time = now - startTime;
        float t = 4.0f * float(time / us2ns(16667)) / mAndroid[1].w;
        GLint offset = (1 - (t - floorf(t))) * mAndroid[1].w;
        GLint x = xc - offset;

        glDisable(GL_SCISSOR_TEST);
        glClear(GL_COLOR_BUFFER_BIT);

        glEnable(GL_SCISSOR_TEST);
        glDisable(GL_BLEND);
        glBindTexture(GL_TEXTURE_2D, mAndroid[1].name);
        drawTexturedQuad(x,                 yc, mAndroid[1].w, mAndroid[1].h);
        drawTexturedQuad(x + mAndroid[1].w, yc, mAndroid[1].w, mAndroid[1].h);

        glEnable(GL_BLEND);
        glBindTexture(GL_TEXTURE_2D, mAndroid[0].name);
        drawTexturedQuad(xc, yc, mAndroid[0].w, mAndroid[0].h);

        EGLBoolean res = eglSwapBuffers(mDisplay, mSurface);
        if (res == EGL_FALSE)
            break;

        // 12fps: don't animate too fast to preserve CPU
        const nsecs_t sleepTime = 83333 - ns2us(systemTime() - now);
        if (sleepTime > 0)
            usleep(sleepTime);

        checkExit();
    } while (!exitPending());

    glDeleteTextures(1, &mAndroid[0].name);
    glDeleteTextures(1, &mAndroid[1].name);
    return false;
}
```

  - 贴图准备
      - initTexture(&mAndroid[0], ... "android-logo-mask.png")
      - initTexture(&mAndroid[1], ... "android-logo-shine.png")
        这两张贴图分别是“logo遮罩”和“高光条”。
  - 初始化 GL 状态
      - 关闭抖动/裁剪，使用 mImageShader
      - 清屏为黑色并 eglSwapBuffers
      - 设置混合因子 glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
  - 进入循环，直到 exitPending()
    每一帧做：
      1. 计算 logo 居中位置
          - xc = (mWidth - mAndroid[0].w) / 2
          - yc = (mHeight - mAndroid[0].h) / 2
      2. 计算“高光条”水平滚动位置
          - time = now - startTime
          - t = 4.0f * float(time / us2ns(16667)) / mAndroid[1].w
          - offset = (1 - (t - floorf(t))) * mAndroid[1].w
          - x = xc - offset
            这段逻辑相当于用一个周期函数不断改变 x，让高光条从左到右平滑循环。
      3. 绘制顺序
          - 清屏
          - 先画高光条（mAndroid[1]），画两次实现平铺：
            drawTexturedQuad(x, yc, w, h)
            drawTexturedQuad(x + w, yc, w, h)
          - 再画 logo 遮罩（mAndroid[0]），让高光“透过”logo区域显示
      4. 交换缓冲 eglSwapBuffers
      5. 12fps 限速
          - sleepTime = 83333 - ns2us(systemTime() - now)
          - usleep(sleepTime)
      6. 调用 checkExit() 检查是否需要退出

  核心效果总结

  - 背景黑色。
  - 先铺一条不断移动的高光纹理。
  - 再叠加固定的 logo 遮罩，让高光只在 logo 区域“扫过”。
  - 以 12fps 更新，直到 service.bootanim.exit=1 触发退出。



### 简单解释

  - android-logo-mask.png 是“镂空的遮罩层”。它本身不做动画，只决定哪些区域可见。
  - android-logo-shine.png 是“高光纹理”。它在水平方向循环平移。
  - 每一帧先画移动的高光纹理，再把遮罩叠上去（带 alpha 混合）。
  - 视觉上就变成“logo 内部在亮起/扫过”的效果，暗到明的变化来自高光纹理的移动，而不是 logo 自身在变。



### 利用OpenGL自定义绘制时间

  - 增加字体纹理生命周期管理（创建与释放）。
  - 在 BootAnimation 类中新增 mClockFont 成员，保存字体资源。

  关键点（对应代码变更）

  - 初始化字体并记录成功状态：
      - initFont(&mClockFont, CLOCK_FONT_ASSET)
      - 新增 hasInitFont 控制清理逻辑
      - 添加日志 ALOGD("android init Font ok...")
  - 调整裁剪区域：
      - updateRect 高度从 mAndroid[0].h 扩大到 mAndroid[0].h * 2
      - glScissor 高度也扩大为 *2
        （目的是让新增文字绘制不被 logo 区域裁掉）
  - 在绘制 logo 后追加文字绘制：
      - drawClock(mClockFont, TEXT_CENTER_VALUE, yc + mAndroid[0].h)
      - 恢复绘制状态：
        glUseProgram(mImageShader); glBindTexture(GL_TEXTURE_2D, mAndroid[0].name);
  - 释放字体纹理：
      - 如果初始化成功，glDeleteTextures(1, &mClockFont.texture.name);

```c++
1) BootAnimation.h：新增字体成员

// BootAnimation.h (class BootAnimation)
private:
  Texture     mAndroid[2];
  Font        mClockFont;  // 新增：保存 clock 字体纹理
  int         mWidth;

2) BootAnimation.cpp：初始化字体

// BootAnimation.cpp :: BootAnimation::android()
bool hasInitFont = false;
if (initFont(&mClockFont, CLOCK_FONT_ASSET) == NO_ERROR) {
  hasInitFont = true;
  ALOGD("android init Font ok, fontname = %u", mClockFont.texture.name);
}

3) 扩大 scissor 裁剪区域（避免文字被裁掉）

// 原先只裁剪 logo 区域
const Rect updateRect(xc, yc, xc + mAndroid[0].w, yc + mAndroid[0].h);

// 修改为更大的区域（为文字预留空间）
const Rect updateRect(xc, yc, xc + mAndroid[0].w, yc + mAndroid[0].h * 2);
glScissor(updateRect.left, mHeight - updateRect.bottom,
        updateRect.width(), updateRect.height() * 2);

4) 在 logo 绘制后追加文字 + 恢复状态

// 先画 logo
glBindTexture(GL_TEXTURE_2D, mAndroid[0].name);
drawTexturedQuad(xc, yc, mAndroid[0].w, mAndroid[0].h);

// 再画文字
drawClock(mClockFont, TEXT_CENTER_VALUE, yc + mAndroid[0].h);

// 恢复状态，防止影响后续绘制
glUseProgram(mImageShader);
glBindTexture(GL_TEXTURE_2D, mAndroid[0].name);

5) 退出时释放字体纹理

glDeleteTextures(1, &mAndroid[0].name);
glDeleteTextures(1, &mAndroid[1].name);

if (hasInitFont) {
  glDeleteTextures(1, &mClockFont.texture.name);
}
```

