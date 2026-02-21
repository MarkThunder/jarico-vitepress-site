---
title: TypeScripe 的相关研究
category: 技术/Android/Framework
order: 1
date: 2026-02-15
---

### ActivityThread

```java
public Activity handleLaunchActivity(ActivityClientRecord r,
		PendingTransactionActions pendingActions, Intent customIntent) {
	...
	final Activity a = performLaunchActivity(r, customIntent);
	...
}
```

```java
private Activity performLaunchActivity(ActivityClientRecord r, Intent customIntent) {
    ...
	if (activity != null) {
        ...
        if (r.isPersistable()) {
            mInstrumentation.callActivityOnCreate(activity, r.state, r.persistentState);
        } else {
            mInstrumentation.callActivityOnCreate(activity, r.state);
        }
        ...
    }
    ...
}
```

会根据情况调用到以下两个方法

### Instrumentation

```java
public void callActivityOnCreate(Activity activity, Bundle icicle) {
    ...
    activity.performCreate(icicle);
	...
}
```

```java
public void callActivityOnCreate(Activity activity, Bundle icicle,
        PersistableBundle persistentState) {
    ...
    activity.performCreate(icicle, persistentState);
    ...
}
```

### Activity

该方法中会走到 Activity 的 onCreate 生命周期

```java
final void performCreate(Bundle icicle, PersistableBundle persistentState) {
    ...
}
```



### 谁调用的 handleLaunchActivity？

```java
02-17 11:19:35.650  1285  1285 D ActivityThread: java.lang.Throwable
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:3789)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.app.servertransaction.LaunchActivityItem.execute(LaunchActivityItem.java:101)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.app.servertransaction.TransactionExecutor.executeCallbacks(TransactionExecutor.java:135)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.app.servertransaction.TransactionExecutor.execute(TransactionExecutor.java:95)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.app.ActivityThread$H.handleMessage(ActivityThread.java:2308)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.os.Handler.dispatchMessage(Handler.java:106)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.os.Looper.loopOnce(Looper.java:201)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.os.Looper.loop(Looper.java:288)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at android.app.ActivityThread.main(ActivityThread.java:7899)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at java.lang.reflect.Method.invoke(Native Method)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:548)
02-17 11:19:35.650  1285  1285 D ActivityThread: 	at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:936)
```

### ZygoteInit

```java
public static Runnable zygoteInit(int targetSdkVersion, long[] disabledCompatChanges,
        String[] argv, ClassLoader classLoader) {
	...
    return RuntimeInit.applicationInit(targetSdkVersion, disabledCompatChanges, argv,
            classLoader);
}
```

### RuntimeInit

  - Class.forName 加载 className（应用进程里通常是 android.app.ActivityThread）。
  - getMethod("main", String[].class) 获取 public static void main(String[] args)。
  - 校验是 public static。
  - 返回 new MethodAndArgsCaller(m, argv)。

  MethodAndArgsCaller 的 run() 会执行 m.invoke(null, new Object[]{argv})，也就是调用 ActivityThread.main(argv)。
  而 Zygote 在捕获这个 RuntimeException 后会调用 run()，从而把前面的初始化栈清掉。

```java
protected static Runnable applicationInit(int targetSdkVersion, long[] disabledCompatChanges,
        String[] argv, ClassLoader classLoader) {
    // If the application calls System.exit(), terminate the process
    // immediately without running any shutdown hooks.  It is not possible to
    // shutdown an Android application gracefully.  Among other things, the
    // Android runtime shutdown hooks close the Binder driver, which can cause
    // leftover running threads to crash before the process actually exits.
    nativeSetExitWithoutCleanup(true);

    VMRuntime.getRuntime().setTargetSdkVersion(targetSdkVersion);
    VMRuntime.getRuntime().setDisabledCompatChanges(disabledCompatChanges);

    final Arguments args = new Arguments(argv);

    // The end of of the RuntimeInit event (see #zygoteInit).
    Trace.traceEnd(Trace.TRACE_TAG_ACTIVITY_MANAGER);

    // Remaining arguments are passed to the start class's static main
    return findStaticMain(args.startClass, args.startArgs, classLoader);
}
```

```java
protected static Runnable findStaticMain(String className, String[] argv,
            ClassLoader classLoader) {
    Class<?> cl;

    try {
        cl = Class.forName(className, true, classLoader);
    } catch (ClassNotFoundException ex) {
        throw new RuntimeException(
                "Missing class when invoking static main " + className,
                ex);
    }

    Method m;
    try {
        m = cl.getMethod("main", new Class[] { String[].class });
    } catch (NoSuchMethodException ex) {
        throw new RuntimeException(
                "Missing static main on " + className, ex);
    } catch (SecurityException ex) {
        throw new RuntimeException(
                "Problem getting static main on " + className, ex);
    }

    int modifiers = m.getModifiers();
    if (! (Modifier.isStatic(modifiers) && Modifier.isPublic(modifiers))) {
        throw new RuntimeException(
                "Main method is not public and static on " + className);
    }

    /*
     * This throw gets caught in ZygoteInit.main(), which responds
     * by invoking the exception's run() method. This arrangement
     * clears up all the stack frames that were required in setting
     * up the process.
     */
    return new MethodAndArgsCaller(m, argv);
}
```

### ActivityThread

通过这个 Looper.loop() 

> **Looper.loop() 本质是一个阻塞式无限循环，持续从 MessageQueue 取消息，并分发给对应 Handler，而不是主动轮询 Handler。**

```java
public static void main(String[] args) {
	...
    Looper.loop();
	
    throw new RuntimeException("Main thread loop unexpectedly exited");
}
```

Handler 类最后会将消息分发到 ActivityThread 中的 

```java
class H extends Handler {
	public void handleMessage(Message msg) {
        ...
        case EXECUTE_TRANSACTION:
            final ClientTransaction transaction = (ClientTransaction) msg.obj;
            mTransactionExecutor.execute(transaction);
            if (isSystem()) {
                // Client transactions inside system process are recycled on the client side
                // instead of ClientLifecycleManager to avoid being cleared before this
                // message is handled.
                transaction.recycle();
            }
            // TODO(lifecycler): Recycle locally scheduled transactions.
            break;
        ...
    }
}
```

### TransactionExecutor

```java
public void execute(ClientTransaction transaction) {
	...
    executeCallbacks(transaction);
	...
}
```

```java
@VisibleForTesting
public void executeCallbacks(ClientTransaction transaction) {
    final List<ClientTransactionItem> callbacks = transaction.getCallbacks();
	...
    final int size = callbacks.size();
    for (int i = 0; i < size; ++i) {
        final ClientTransactionItem item = callbacks.get(i);
		...
        item.execute(mTransactionHandler, token, mPendingActions);
		...
    }
}
```

ClientTransactionItem 作为抽象“骨架类”把接口先挂上，但把必须实现的 `execute()` 留给各个具体 Item（Launch/Resume/Pause…）去实现。

### LaunchActivityItem

```java
@Override
public void execute(ClientTransactionHandler client, IBinder token,
        PendingTransactionActions pendingActions) {
	...
    client.handleLaunchActivity(r, pendingActions, null /* customIntent */);
    ...
}
```

这里调用之后就走进了

handleLaunchActivity 的 handleLaunchActivity

###  谁发 EXECUTE_TRANSACTION？

```
- 真正发消息的是 应用进程里的 ClientTransactionHandler.scheduleTransaction()，它调用 sendMessage(ActivityThread.H.EXECUTE_TRANSACTION, transaction)。
aosp13/frameworks/base/core/java/android/app/ClientTransactionHandler.java:49-52

  调用链（从系统进程到发消息）：

  1. 系统进程 ClientLifecycleManager.scheduleTransaction(...) 调用 ClientTransaction.schedule()
     aosp13/frameworks/base/services/core/java/com/android/server/wm/ClientLifecycleManager.java:45-53
  2. ClientTransaction.schedule() 会走 IApplicationThread.scheduleTransaction(...)（Binder）
  3. 应用进程 ActivityThread.ApplicationThread.scheduleTransaction(...)

aosp13/frameworks/base/core/java/android/app/ActivityThread.java:1847-1848
  4. 进入 ClientTransactionHandler.scheduleTransaction()，这里发出 EXECUTE_TRANSACTION

  所以：消息是应用进程内部由 ClientTransactionHandler 发送的，但触发它的来源是系统进程通过 Binder 的 IApplicationThread.scheduleTransaction 调用。
```

