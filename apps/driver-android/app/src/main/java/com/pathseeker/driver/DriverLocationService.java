package com.pathseeker.driver;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import com.amap.api.location.AMapLocationClient;
import com.amap.api.location.AMapLocationClientOption;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

public final class DriverLocationService extends Service {
    static final String STOP = "com.pathseeker.driver.STOP";
    static volatile boolean running;
    private static final String CHANNEL = "driver_location";
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private SessionStore store;
    private DriverApi api;
    private AMapLocationClient client;
    private String roomId = "";
    private volatile JSONObject latest;
    private volatile boolean stopping;
    private long uploadedTime;
    private long heartbeatAt;

    @Override public void onCreate() {
        super.onCreate();
        store = new SessionStore(this);
        api = new DriverApi(store);
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "行程定位", NotificationManager.IMPORTANCE_LOW));
        Notification notice = notification("正在启动行程定位");
        if (Build.VERSION.SDK_INT >= 29) startForeground(101, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(101, notice);
        running = true;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) { stopSharing(); return START_NOT_STICKY; }
        if (client != null || stopping) return START_NOT_STICKY;
        roomId = store.preferences().getString("roomId", "");
        try {
            if (roomId.isEmpty() || !store.preferences().getBoolean("privacyAccepted", false)) throw new Exception("请先同意定位授权并创建房间");
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) throw new Exception("请允许精确定位后再开始");
            String key = store.preferences().getString("amapKey", BuildConfig.AMAP_KEY);
            if (key.isEmpty()) throw new Exception("请填写高德 Android 定位 Key");
            AMapLocationClient.updatePrivacyShow(this, true, true);
            AMapLocationClient.updatePrivacyAgree(this, true);
            AMapLocationClient.setApiKey(key);
            client = new AMapLocationClient(getApplicationContext());
            AMapLocationClientOption options = new AMapLocationClientOption();
            options.setLocationMode(AMapLocationClientOption.AMapLocationMode.Hight_Accuracy);
            options.setInterval(3000);
            options.setLocationCacheEnable(false);
            options.setNeedAddress(false);
            options.setOffset(true);
            options.setMockEnable(false);
            options.setHttpTimeOut(10000);
            client.setLocationOption(options);
            client.setLocationListener(location -> {
                if (stopping) return;
                if (location == null || location.getErrorCode() != 0) {
                    status(location == null ? "等待有效定位" : "定位暂不可用：" + location.getErrorInfo());
                    return;
                }
                long age = System.currentTimeMillis() - location.getTime();
                if (location.isMock() || age > 120000 || age < -30000 || location.getAccuracy() <= 0 || location.getAccuracy() > 500) {
                    status("定位精度不足，等待有效坐标");
                    return;
                }
                try {
                    latest = new JSONObject().put("longitude", location.getLongitude()).put("latitude", location.getLatitude())
                        .put("accuracy", location.getAccuracy()).put("coordinateSystem", "GCJ-02")
                        .put("sampledAt", Instant.ofEpochMilli(location.getTime()).toString());
                    store.preferences().edit().putString("lastFix", latest.toString()).apply();
                } catch (Exception failure) { status("定位数据异常"); }
            });
            client.enableBackgroundLocation(102, notification("正在后台获取位置"));
            client.startLocation();
            store.preferences().edit().putBoolean("sharing", true).apply();
            status("定位已启动，等待有效坐标");
            worker.scheduleWithFixedDelay(this::upload, 0, 3, TimeUnit.SECONDS);
        } catch (Exception failure) { terminate(failure.getMessage()); }
        return START_NOT_STICKY;
    }

    private void upload() {
        if (stopping) return;
        try {
            long now = System.currentTimeMillis();
            JSONObject fix = latest;
            if (fix != null) {
                long sampledAt = Instant.parse(fix.getString("sampledAt")).toEpochMilli();
                if (sampledAt > uploadedTime && now - sampledAt <= 120000) {
                    api.call("/DriverLocations/" + roomId, "POST", fix);
                    uploadedTime = sampledAt;
                    heartbeatAt = now;
                    store.preferences().edit().putLong("lastUploadAt", System.currentTimeMillis()).apply();
                    status("位置已上报 · " + java.time.LocalTime.now().withNano(0));
                }
            }
            if (now - heartbeatAt >= 10000) {
                api.call("/DriverLocations/" + roomId + "/heartbeat", "POST", new JSONObject());
                heartbeatAt = now;
                if (fix == null || now - Instant.parse(fix.getString("sampledAt")).toEpochMilli() > 30000) status("连接正常，等待有效定位");
            }
        } catch (DriverApi.ApiException failure) {
            if (failure.terminal()) terminate(failure.getMessage());
            else status("上报失败，将自动重试：" + failure.getMessage());
        } catch (Exception failure) { status("网络暂不可用，将自动重试"); }
    }

    private Notification notification(String message) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, DriverLocationService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("寻迹车夫 · 行程定位").setContentText(message).setContentIntent(open).setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "停止共享", stop).build()).build();
    }

    private void status(String message) {
        store.preferences().edit().putString("locationStatus", message).apply();
        if (!stopping) getSystemService(NotificationManager.class).notify(101, notification(message));
    }

    private void terminate(String message) {
        status(message == null ? "定位已停止" : message);
        stopSharing();
    }

    private void stopSharing() {
        if (stopping) return;
        stopping = true;
        latest = null;
        if (client != null) { client.stopLocation(); client.disableBackgroundLocation(true); client.onDestroy(); client = null; }
        store.preferences().edit().putBoolean("sharing", false).apply();
        worker.execute(() -> {
            try { if (!roomId.isEmpty()) api.call("/DriverLocations/" + roomId + "/stop", "POST", new JSONObject()); }
            catch (Exception ignored) { }
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        });
    }

    @Override public void onDestroy() {
        running = false;
        stopping = true;
        if (client != null) { client.stopLocation(); client.disableBackgroundLocation(true); client.onDestroy(); }
        store.preferences().edit().putBoolean("sharing", false).apply();
        worker.shutdownNow();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
