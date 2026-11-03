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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import java.time.OffsetDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import org.json.JSONObject;

public final class DriverCommentaryService extends Service {
    static final String START = "com.pathseeker.driver.COMMENTARY_START";
    static final String PAUSE = "com.pathseeker.driver.COMMENTARY_PAUSE";
    static final String STOP = "com.pathseeker.driver.COMMENTARY_STOP";
    static final String QUESTIONS = "com.pathseeker.driver.COMMENTARY_QUESTIONS";
    static final String STOP_QUESTIONS = "com.pathseeker.driver.COMMENTARY_STOP_QUESTIONS";
    static volatile boolean running;
    private static final String CHANNEL = "driver_commentary";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final OkHttpClient client = new OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS).pingInterval(15, TimeUnit.SECONDS).build();
    private SessionStore store;
    private DriverApi api;
    private WebSocket socket;
    private volatile WebSocket sendingSocket;
    private DriverAudioCapture capture;
    private DriverQuestionPlayer questions;
    private PowerManager.WakeLock wakeLock;
    private String roomId;
    private boolean destroyed;
    private boolean connecting;
    private boolean wanted = true;
    private boolean inputPending;
    private boolean pausing;
    private boolean playAfterPause;
    private boolean terminating;
    private int generation;
    private int reconnects;
    private long lastLevelAt;
    private final Runnable resetReconnects = () -> reconnects = 0;
    private final Runnable pauseTimeout = () -> terminate("暂停确认超时，请返回 APP 重新开启麦克风");
    private final Runnable startTimeout = () -> lost("讲解启动超时，正在重新连接", true);
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            if (destroyed || terminating) return;
            questions.publish();
            if (socket != null && !socket.send("{\"type\":\"ping\"}")) lost("讲解连接中断", true);
            handler.postDelayed(this, 15000);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        store = new SessionStore(this); api = new DriverApi(store);
        roomId = store.preferences().getString("roomId", "");
        questions = new DriverQuestionPlayer(this, store, message -> status(store.preferences().getString("commentaryState", "paused"), message));
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "实时讲解", NotificationManager.IMPORTANCE_LOW));
        running = true;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (terminating) return START_NOT_STICKY;
        if (intent == null || STOP.equals(intent.getAction())) { terminate("讲解连接已关闭"); return START_NOT_STICKY; }
        if (roomId.isEmpty() || !roomId.equals(store.preferences().getString("roomId", ""))
            || !store.preferences().getBoolean("microphonePrivacyAccepted", false)
            || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            terminate("请先创建房间并允许麦克风权限"); return START_NOT_STICKY;
        }
        try {
            Notification notice = notification("正在连接讲解房间");
            if (Build.VERSION.SDK_INT >= 30) startForeground(201, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(201, notice);
            if (wakeLock == null) {
                wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, getPackageName() + ":commentary");
                wakeLock.acquire(TimeUnit.HOURS.toMillis(3));
                handler.post(heartbeat);
            }
            if (STOP_QUESTIONS.equals(intent.getAction())) {
                questions.stop(); status("paused", "已停止收听提问，点击麦克风继续讲解");
            } else if (PAUSE.equals(intent.getAction())) pause(false);
            else if (QUESTIONS.equals(intent.getAction())) pause(true);
            else {
                if (pausing || capture != null || inputPending) return START_NOT_STICKY;
                questions.stop(); wanted = true;
                if (socket == null) connect(); else startInput();
            }
        } catch (Exception failure) { terminate("麦克风启动失败，请检查录音权限后重试"); }
        return START_NOT_STICKY;
    }

    private void connect() {
        if (destroyed || terminating || connecting) return;
        connecting = true;
        int attempt = ++generation;
        status(reconnects == 0 ? "connecting" : "reconnecting", reconnects == 0 ? "正在连接讲解房间" : "网络中断，正在重新连接…");
        worker.execute(() -> {
            try {
                JSONObject room = api.call("/TranslationRooms/" + roomId, "GET", null);
                String token = api.accessToken();
                if (!room.optBoolean("isHost") || token.isEmpty() || "closed".equals(room.optString("status"))
                    || "draining".equals(room.optString("status"))
                    || OffsetDateTime.parse(room.getString("expiresAt")).isBefore(OffsetDateTime.now()))
                    throw new DriverApi.ApiException(400, "房间已结束，请重新创建房间");
                Request request = new Request.Builder().url(store.apiBase().replaceFirst("^https", "wss") + "/TranslationRooms/" + roomId + "/events")
                    .header("Authorization", "Bearer " + token).header("Sec-WebSocket-Protocol", "translation").build();
                handler.post(() -> {
                    if (destroyed || terminating || generation != attempt) return;
                    saveSnapshot(room);
                    socket = client.newWebSocket(request, new WebSocketListener() {
                        @Override public void onOpen(WebSocket opened, Response response) {
                            handler.post(() -> {
                                if (!current(opened, attempt)) return;
                                connecting = false; sendingSocket = opened;
                            });
                        }
                        @Override public void onMessage(WebSocket opened, String text) {
                            handler.post(() -> { if (current(opened, attempt)) event(text); });
                        }
                        @Override public void onClosing(WebSocket opened, int code, String reason) {
                            opened.close(code, null);
                            handler.post(() -> { if (current(opened, attempt)) lost(code == 1008 ? "房间不可用或麦克风已被其他设备接管，请返回 APP 重试" : "讲解连接已断开", code != 1008); });
                        }
                        @Override public void onFailure(WebSocket opened, Throwable failure, Response response) {
                            handler.post(() -> { if (current(opened, attempt)) lost("讲解网络连接失败", response == null || response.code() >= 500 || response.code() == 401); });
                        }
                    });
                });
            } catch (Exception failure) {
                handler.post(() -> {
                    if (destroyed || terminating || generation != attempt) return;
                    connecting = false;
                    boolean retry = !(failure instanceof DriverApi.ApiException) || !((DriverApi.ApiException) failure).terminal();
                    lost(failure.getMessage() == null ? "讲解连接失败" : failure.getMessage(), retry);
                });
            }
        });
    }

    private boolean current(WebSocket opened, int attempt) { return !destroyed && !terminating && generation == attempt && socket == opened; }

    private void event(String text) {
        try {
            JSONObject event = new JSONObject(text);
            String type = event.optString("type");
            JSONObject payload = event.optJSONObject("payload");
            if (payload == null) payload = new JSONObject();
            if ("room.snapshot".equals(type) || "room.members.changed".equals(type)) {
                saveSnapshot(payload);
                if ("room.snapshot".equals(type)) {
                    if (wanted) startInput();
                    else status("paused", "麦克风已暂停，游客可以继续留在房间");
                }
            } else if ("room.started".equals(type) && inputPending && !pausing) {
                handler.removeCallbacks(startTimeout);
                startCapture();
                handler.removeCallbacks(resetReconnects);
                handler.postDelayed(resetReconnects, 30000);
            } else if ("input.paused".equals(type)) {
                handler.removeCallbacks(pauseTimeout); handler.removeCallbacks(startTimeout);
                stopCapture(); inputPending = false; pausing = false;
                status("paused", "麦克风已暂停，点击继续讲解");
                if (playAfterPause) { playAfterPause = false; questions.play(); }
            } else if ("transcript.final".equals(type) || "translation.committed".equals(type)) {
                String source = payload.optString("text");
                if (!source.isEmpty()) store.preferences().edit().putString("commentaryText", source).apply();
            } else if ("question.updated".equals(type)) questions.accept(payload);
            else if ("room.closed".equals(type) || "room.draining".equals(type)) {
                store.preferences().edit().putString("roomStatus", "closed").apply();
                terminate("讲解房间已结束");
            } else if ("room.paused".equals(type) && !pausing && capture != null) {
                wanted = false; stopCapture();
                status("pausing", "输入已暂停，正在完成剩余识别…"); pausing = true;
                handler.postDelayed(pauseTimeout, 45000);
            } else if ("segment.error".equals(type)) {
                String message = payload.optString("message", "本段识别失败，请重复讲解");
                if ("asr_capacity_exceeded".equals(payload.optString("code"))) { wanted = false; pause(false); }
                status(store.preferences().getString("commentaryState", "paused"), message);
            } else if ("language.error".equals(type) || "audio.error".equals(type)) {
                store.preferences().edit().putString("translationWarning", payload.optString("message", "本段翻译暂不可用")).apply();
            }
        } catch (Exception failure) { terminate("讲解数据异常，请重新连接"); }
    }

    private void saveSnapshot(JSONObject room) {
        if (!roomId.equals(room.optString("roomId"))) return;
        store.preferences().edit().putString("roomSnapshot", room.toString()).putString("roomStatus", room.optString("status", "open")).apply();
    }

    private void startInput() {
        if (destroyed || terminating || socket == null || !wanted || inputPending || pausing) return;
        inputPending = true;
        status("starting", "正在开启麦克风…");
        if (!socket.send("{\"type\":\"input.start\"}")) { lost("麦克风连接失败", true); return; }
        handler.postDelayed(startTimeout, 15000);
    }

    private void startCapture() {
        if (capture != null || !wanted || destroyed || terminating) return;
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { terminate("录音权限已被撤销"); return; }
        try {
            WebSocket target = socket;
            DriverAudioCapture next = new DriverAudioCapture(this, new DriverAudioCapture.Listener() {
                @Override public void frame(byte[] pcm, int level) {
                    if (sendingSocket != target) return;
                    if (target.queueSize() > 96000 || !target.send(ByteString.of(pcm))) {
                        sendingSocket = null;
                        handler.post(() -> { if (socket == target) lost("音频上传积压，请检查网络后重新开始讲解", false); });
                        return;
                    }
                    long now = android.os.SystemClock.elapsedRealtime();
                    if (now - lastLevelAt >= 200) {
                        lastLevelAt = now;
                        handler.post(() -> { if (!destroyed && sendingSocket == target && capture != null) store.preferences().edit().putInt("microphoneLevel", level).apply(); });
                    }
                }
                @Override public void failed(String message) {
                    handler.post(() -> { if (!destroyed && socket == target && capture != null) lost(message, false); });
                }
            });
            capture = next; next.start();
            status("live", "正在收音，游客将收到实时讲解");
        } catch (Exception failure) { lost(failure.getMessage() == null ? "无法使用麦克风" : failure.getMessage(), false); }
    }

    private void pause(boolean listen) {
        wanted = false; playAfterPause = listen;
        questions.stop();
        stopCapture();
        if (pausing) return;
        if (socket == null) { if (listen) status("stopped", "讲解未连接，请先开启麦克风"); return; }
        if (!inputPending) { status("paused", "麦克风已暂停"); if (listen) { playAfterPause = false; questions.play(); } return; }
        pausing = true; handler.removeCallbacks(startTimeout);
        status("pausing", "麦克风已关闭，正在完成剩余识别…");
        if (!socket.send("{\"type\":\"input.pause\"}")) { lost("暂停讲解失败，请重新连接", false); return; }
        handler.postDelayed(pauseTimeout, 45000);
    }

    private void stopCapture() {
        DriverAudioCapture previous = capture;
        capture = null;
        if (previous != null) previous.stop();
        store.preferences().edit().putInt("microphoneLevel", 0).apply();
    }

    private void lost(String message, boolean retry) {
        if (destroyed || terminating) return;
        handler.removeCallbacks(resetReconnects);
        handler.removeCallbacks(startTimeout); handler.removeCallbacks(pauseTimeout);
        sendingSocket = null; stopCapture();
        WebSocket previous = socket; socket = null; generation++; connecting = false; inputPending = false; pausing = false;
        questions.clear(); playAfterPause = false;
        if (previous != null) previous.cancel();
        if (retry && reconnects < 3) {
            reconnects++;
            status("reconnecting", "连接中断，正在重连；这段时间的讲话不会补传");
            handler.postDelayed(this::connect, (1L << (reconnects - 1)) * 1000);
        } else terminate(message + "，请点击麦克风重试");
    }

    private void status(String state, String message) {
        if (destroyed) return;
        store.preferences().edit().putString("commentaryState", state).putString("commentaryStatus", message)
            .putBoolean("commentaryActive", "live".equals(state)).apply();
        getSystemService(NotificationManager.class).notify(201, notification(message));
    }

    private Notification notification(String message) {
        PendingIntent open = PendingIntent.getActivity(this, 2, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent pause = PendingIntent.getService(this, 3, new Intent(this, DriverCommentaryService.class).setAction(PAUSE), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop = PendingIntent.getService(this, 4, new Intent(this, DriverCommentaryService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_microphone)
            .setContentTitle(getString(R.string.commentary_notification)).setContentText(message).setContentIntent(open).setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "暂停收音", pause).build())
            .addAction(new Notification.Action.Builder(null, "断开讲解", stop).build()).build();
    }

    private void terminate(String message) {
        if (destroyed || terminating) return;
        status("stopped", message);
        terminating = true; sendingSocket = null; stopCapture(); questions.stop();
        stopSelf();
    }

    @Override public void onDestroy() {
        destroyed = true; running = false; generation++; sendingSocket = null;
        handler.removeCallbacksAndMessages(null); stopCapture(); questions.close();
        if (socket != null) { socket.cancel(); socket = null; }
        client.dispatcher().executorService().shutdown(); client.connectionPool().evictAll();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        store.preferences().edit().putBoolean("commentaryActive", false).putString("commentaryState", "stopped").apply();
        worker.shutdownNow(); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
