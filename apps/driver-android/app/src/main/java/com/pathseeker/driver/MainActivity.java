package com.pathseeker.driver;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private SessionStore store;
    private DriverApi api;
    private DriverMapController map;
    private Bundle mapState;
    private TextView feedback;
    private TextView mapMessage;
    private Button roomAction;
    private Button microphoneAction;
    private Button questionsAction;
    private ProgressBar microphoneLevel;
    private View settings;
    private boolean busy;
    private boolean alive = true;
    private boolean resumed;
    private boolean starting;
    private boolean pendingStart;
    private boolean pendingMicrophone;
    private boolean refreshing;
    private long refreshedAt;
    private final SharedPreferences.OnSharedPreferenceChangeListener changed = (preferences, name) -> runOnUiThread(() -> {
        if (!alive || microphoneLevel == null) return;
        if ("microphoneLevel".equals(name)) microphoneLevel.setProgress(preferences.getInt("microphoneLevel", 0));
        else render();
    });
    private final Runnable ticker = new Runnable() {
        @Override public void run() { if (alive && resumed) { render(); refreshRoom(); handler.postDelayed(this, 5000); } }
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        store = new SessionStore(this);
        if (!store.loggedIn()) { DriverUi.openLogin(this); return; }
        api = new DriverApi(store);
        if (sharing() && !DriverLocationService.running)
            store.preferences().edit().putBoolean("sharing", false).putString("locationStatus", "上次共享已中断，请重新开始").apply();
        if (!DriverCommentaryService.running) store.preferences().edit().putBoolean("commentaryActive", false).putString("commentaryState", "stopped")
            .remove("questionCount").remove("questionText").putBoolean("questionPlaying", false).apply();
        setContentView(R.layout.activity_console);
        ((View) findViewById(R.id.map_host).getParent()).setClipToOutline(true);
        DriverUi.insets(this);
        feedback = findViewById(R.id.feedback);
        mapMessage = findViewById(R.id.map_message);
        roomAction = findViewById(R.id.room_action);
        microphoneAction = findViewById(R.id.microphone_action);
        questionsAction = findViewById(R.id.questions_action);
        microphoneLevel = findViewById(R.id.microphone_level);
        settings = findViewById(R.id.settings);
        ((TextView) findViewById(R.id.account_name)).setText(store.preferences().getString("lastAccount", "车夫账号"));
        mapState = saved == null ? null : saved.getBundle("map");
        mapMessage.setOnClickListener(view -> {
            if (map != null) return;
            if (store.preferences().getBoolean("mapPrivacyAccepted", false)) initializeMap();
            else DriverUi.privacy(this, store, this::initializeMap);
        });
        findViewById(R.id.recenter).setOnClickListener(view -> { if (map != null) map.recenter(); });
        roomAction.setOnClickListener(view -> { if (!busy) { if (roomId().isEmpty()) createRoom(); else loadRoom(true); } });
        microphoneAction.setOnClickListener(view -> {
            if (store.preferences().getBoolean("commentaryActive", false))
                startService(new Intent(this, DriverCommentaryService.class).setAction(DriverCommentaryService.PAUSE));
            else requestMicrophone();
        });
        questionsAction.setOnClickListener(view -> showQuestions());
        findViewById(R.id.details_action).setOnClickListener(view -> showDetails());
        settings.setOnClickListener(view -> showSettings());
        store.preferences().registerOnSharedPreferenceChangeListener(changed);
        if (store.preferences().getBoolean("mapPrivacyAccepted", false)) initializeMap();
        render();
        if (!roomId().isEmpty()) loadRoom(false);
    }

    private void initializeMap() {
        if (!alive || map != null) return;
        FrameLayout host = findViewById(R.id.map_host);
        try {
            map = new DriverMapController(this, host, store, mapState);
            if (resumed) map.resume();
            render();
        } catch (Exception failure) { host.removeAllViews(); mapMessage.setText(R.string.map_failed); }
    }

    private void createRoom() {
        task(() -> {
            saveRoom(api.call("/TranslationRooms", "POST", new JSONObject().put("sourceLanguage", DriverLanguages.normalize(store.preferences().getString("sourceLanguage", "zh-CN")))));
            return "房间已创建，可以开始共享位置";
        }, () -> { showQr(); requestLocation(); });
    }

    private void loadRoom(boolean displayQr) {
        task(() -> {
            try { saveRoom(api.call("/TranslationRooms/" + roomId(), "GET", null)); }
            catch (DriverApi.ApiException failure) { if (unavailable(failure)) clearRoom(); throw failure; }
            return "";
        }, displayQr ? this::showQr : null);
    }

    private void saveRoom(JSONObject room) throws Exception {
        String status = room.optString("status");
        if ("closed".equals(status) || "draining".equals(status)
            || OffsetDateTime.parse(room.getString("expiresAt")).isBefore(OffsetDateTime.now())) {
            clearRoom(); throw new Exception("房间已结束，请重新创建房间");
        }
        store.preferences().edit().putString("roomId", room.getString("roomId")).putString("roomCode", room.getString("code"))
            .putString("sourceLanguage", room.optString("sourceLanguage", "zh-CN"))
            .putString("roomSnapshot", room.toString()).putString("roomStatus", status).apply();
    }

    private void refreshRoom() {
        if (busy || refreshing || DriverCommentaryService.running || roomId().isEmpty() || System.currentTimeMillis() - refreshedAt < 15000) return;
        refreshing = true; refreshedAt = System.currentTimeMillis();
        String currentRoom = roomId();
        worker.execute(() -> {
            try {
                JSONObject room = api.call("/TranslationRooms/" + currentRoom, "GET", null);
                if (alive && currentRoom.equals(roomId())) saveRoom(room);
            } catch (DriverApi.ApiException failure) {
                if (alive && currentRoom.equals(roomId()) && unavailable(failure)) clearRoom();
            } catch (Exception ignored) { }
            finally { runOnUiThread(() -> { refreshing = false; if (alive) render(); }); }
        });
    }

    private void showQr() {
        if (roomId().isEmpty()) return;
        String code = store.preferences().getString("roomCode", "");
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = DriverUi.dp(this, 24);
        content.setPadding(padding, padding, padding, padding);
        TextView label = new TextView(this);
        label.setText(code); label.setContentDescription(getString(R.string.room_code_value, code));
        label.setTextSize(32); label.setTextColor(getColor(R.color.driver_ink));
        label.setLetterSpacing(0.08f);
        label.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        label.setGravity(android.view.Gravity.CENTER); content.addView(label);
        TextView hint = new TextView(this);
        try {
            com.google.zxing.common.BitMatrix matrix = RoomInvitation.matrix(BuildConfig.ALIPAY_APP_ID, code);
            int width = matrix.getWidth(), height = matrix.getHeight();
            int[] pixels = new int[width * height];
            for (int row = 0; row < height; row++) for (int column = 0; column < width; column++)
                pixels[row * width + column] = matrix.get(column, row) ? android.graphics.Color.BLACK : android.graphics.Color.WHITE;
            android.graphics.Bitmap bitmap = android.graphics.Bitmap.createBitmap(pixels, width, height, android.graphics.Bitmap.Config.ARGB_8888);
            ImageView qr = new ImageView(this);
            qr.setContentDescription(getString(R.string.room_qr_description)); qr.setImageBitmap(bitmap);
            qr.setScaleType(ImageView.ScaleType.FIT_CENTER);
            content.addView(qr, new LinearLayout.LayoutParams(-1, DriverUi.dp(this, 260)));
            hint.setText("请使用支付宝扫一扫，加入当前讲解房间");
        } catch (IllegalArgumentException | com.google.zxing.WriterException failure) {
            hint.setText("二维码生成失败，请让游客输入房间码加入");
        }
        hint.setTextColor(getColor(R.color.driver_muted)); hint.setTextSize(14);
        hint.setGravity(android.view.Gravity.CENTER); hint.setPadding(0, DriverUi.dp(this, 12), 0, 0);
        content.addView(hint);
        DriverUi.show(new AlertDialog.Builder(this).setTitle("邀请游客加入").setView(DriverUi.scroll(this, content)).setNegativeButton("关闭", null)
            .setPositiveButton("复制房间码", (dialog, which) -> {
                getSystemService(ClipboardManager.class).setPrimaryClip(ClipData.newPlainText("房间码", code));
                Toast.makeText(this, "房间码已复制", Toast.LENGTH_SHORT).show();
            }).create());
    }

    private void requestLocation() {
        if (busy || starting || sharing()) return;
        if (roomId().isEmpty()) { showFeedback("请先创建房间"); return; }
        if (store.preferences().getString("amapKey", BuildConfig.AMAP_KEY).isEmpty()) { showFeedback(getString(R.string.missing_amap_key)); return; }
        if (!store.preferences().getBoolean("mapPrivacyAccepted", false)) {
            DriverUi.privacy(this, store, () -> { initializeMap(); requestLocation(); }); return;
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }, 10); return;
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 11); return;
        }
        startLocation();
    }

    private void startLocation() {
        if (!alive || busy || starting || roomId().isEmpty() || sharing()) return;
        if (!resumed) { pendingStart = true; return; }
        try {
            starting = true; startForegroundService(new Intent(this, DriverLocationService.class));
            showFeedback(""); render();
            handler.postDelayed(() -> { if (alive) { starting = false; render(); } }, 3000);
        } catch (Exception failure) { starting = false; showFeedback(getString(R.string.start_failed, failure.getMessage())); render(); }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == 10) {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) requestLocation();
            else showFeedback("需要精确定位权限，请在应用设置中授权");
        } else if (requestCode == 11) startLocation();
        else if (requestCode == 12) {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) requestMicrophone();
            else showFeedback("需要麦克风权限，请在系统设置中允许录音");
        } else if (requestCode == 13) startCommentary();
    }

    private void requestMicrophone() {
        if (busy || roomId().isEmpty()) return;
        if ("closed".equals(store.preferences().getString("roomStatus", ""))) { showFeedback("房间已结束，请在行程中结束旧房间后重新创建"); return; }
        if (!store.preferences().getBoolean("microphonePrivacyAccepted", false)) {
            DriverUi.show(new AlertDialog.Builder(this).setTitle(R.string.commentary_mic_consent).setMessage(R.string.commentary_mic_message)
                .setNegativeButton("取消", null).setPositiveButton("同意并开启", (dialog, which) -> {
                    store.preferences().edit().putBoolean("microphonePrivacyAccepted", true).apply(); requestMicrophone();
                }).create()); return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, 12); return;
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 13); return;
        }
        startCommentary();
    }

    private void startCommentary() {
        if (!alive || busy || roomId().isEmpty()) return;
        if (!resumed) { pendingMicrophone = true; return; }
        try {
            store.preferences().edit().putString("commentaryState", "connecting").putString("commentaryStatus", "正在连接讲解房间").apply();
            startForegroundService(new Intent(this, DriverCommentaryService.class).setAction(DriverCommentaryService.START));
            showFeedback("");
        } catch (Exception failure) {
            store.preferences().edit().putString("commentaryState", "stopped").apply();
            showFeedback(getString(R.string.start_failed, failure.getMessage()));
        }
    }

    private void showQuestions() {
        String text = store.preferences().getString("questionText", "");
        AlertDialog.Builder builder = new AlertDialog.Builder(this).setTitle("游客提问").setMessage(text.isEmpty() ? "游客提问后，翻译文字会显示在这里。" : text)
            .setNegativeButton("关闭", null);
        if (store.preferences().getInt("questionCount", 0) > 0 || store.preferences().getBoolean("questionPlaying", false)) {
            builder.setPositiveButton(store.preferences().getBoolean("questionPlaying", false) ? "停止收听" : "暂停讲解并收听", (dialog, which) -> {
                if (!DriverCommentaryService.running) { showFeedback("请先连接讲解房间"); return; }
                startService(new Intent(this, DriverCommentaryService.class).setAction(
                    store.preferences().getBoolean("questionPlaying", false) ? DriverCommentaryService.STOP_QUESTIONS : DriverCommentaryService.QUESTIONS));
            });
        }
        DriverUi.show(builder.create());
    }

    private void showDetails() {
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = DriverUi.dp(this, 20); content.setPadding(padding, padding, padding, padding);
        TextView detail = new TextView(this);
        String coordinates = getString(R.string.coordinates_waiting);
        try {
            JSONObject fix = new JSONObject(store.preferences().getString("lastFix", ""));
            coordinates = getString(R.string.coordinates_value, fix.getDouble("longitude"), fix.getDouble("latitude"), (int) Math.ceil(fix.getDouble("accuracy")));
        } catch (Exception ignored) { }
        long uploaded = store.preferences().getLong("lastUploadAt", 0);
        detail.setText(getString(R.string.trip_detail_value, sharing() ? getString(R.string.sharing_active) : getString(R.string.sharing_stopped),
            store.preferences().getString("locationStatus", ""), coordinates,
            uploaded == 0 ? getString(R.string.upload_waiting) : getString(R.string.upload_latest, time(uploaded)),
            store.preferences().getString("translationWarning", "")));
        detail.setTextSize(14); detail.setTextColor(getColor(R.color.driver_ink));
        detail.setLineSpacing(DriverUi.dp(this, 4), 1); content.addView(detail);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(R.string.trip_title).setView(DriverUi.scroll(this, content)).setNegativeButton("关闭", null).create();
        Button share = DriverUi.dialogAction(this, sharing() ? R.string.stop_sharing_action : R.string.start_sharing_action, false); share.setEnabled(!busy && !starting && !roomId().isEmpty());
        share.setOnClickListener(view -> { dialog.dismiss(); if (sharing()) stopSharing(); else requestLocation(); }); content.addView(share);
        Button disconnect = DriverUi.dialogAction(this, R.string.commentary_disconnect, false); disconnect.setEnabled(DriverCommentaryService.running);
        disconnect.setOnClickListener(view -> { stopService(new Intent(this, DriverCommentaryService.class)); dialog.dismiss(); }); content.addView(disconnect);
        Button end = DriverUi.dialogAction(this, R.string.end_room_action, true); end.setEnabled(!busy && !starting && !roomId().isEmpty());
        end.setOnClickListener(view -> { dialog.dismiss(); confirmEndRoom(); }); content.addView(end);
        DriverUi.show(dialog);
    }

    private void stopSharing() {
        if (busy || starting) return;
        String currentRoom = roomId();
        stopService(new Intent(this, DriverLocationService.class));
        store.preferences().edit().putBoolean("sharing", false).putString("locationStatus", "位置共享已停止").apply();
        task(() -> {
            if (!currentRoom.isEmpty()) api.call("/DriverLocations/" + currentRoom + "/stop", "POST", new JSONObject());
            return "已停止位置共享";
        }, null);
    }

    private void confirmEndRoom() {
        if (busy || starting || roomId().isEmpty()) return;
        AlertDialog confirmation = new AlertDialog.Builder(this).setTitle("结束当前房间？").setMessage("位置共享将停止，游客将无法继续加入该房间。")
            .setNegativeButton("取消", null).setPositiveButton("结束房间", (dialog, which) -> task(() -> {
                try { api.call("/TranslationRooms/" + roomId() + "/close", "POST", new JSONObject()); }
                catch (DriverApi.ApiException failure) { if (!unavailable(failure)) throw failure; }
                clearRoom(); return "房间已结束";
            }, null)).create();
        DriverUi.show(confirmation).getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(getColor(R.color.driver_error));
    }

    private void clearRoom() {
        stopService(new Intent(this, DriverCommentaryService.class));
        stopService(new Intent(this, DriverLocationService.class));
        store.preferences().edit().remove("roomId").remove("roomCode").remove("roomQr").remove("lastFix")
            .remove("lastUploadAt").remove("locationStatus").remove("roomSnapshot").remove("roomStatus").remove("commentaryText")
            .remove("commentaryStatus").remove("translationWarning").remove("questionText").remove("questionCount")
            .remove("microphoneLevel").remove("questionPlaying")
            .putString("commentaryState", "stopped").putBoolean("commentaryActive", false).putBoolean("sharing", false).apply();
    }

    private boolean unavailable(DriverApi.ApiException failure) { return failure.status == 400 || failure.status == 401 || failure.status == 403 || failure.status == 404; }

    private void showSettings() {
        if (busy || starting) return;
        DriverUi.show(new AlertDialog.Builder(this).setTitle(R.string.settings_action)
            .setItems(new String[] { "连接设置", "后台运行与电池设置", "讲话语言", "退出登录" }, (dialog, which) -> {
                if (which == 0) DriverUi.settings(this, store, () -> {
                    if (!store.loggedIn()) DriverUi.openLogin(this);
                    else {
                        if (map != null) { map.destroy(); map = null; ((FrameLayout) findViewById(R.id.map_host)).removeAllViews(); }
                        if (store.preferences().getBoolean("mapPrivacyAccepted", false)) initializeMap();
                    }
                });
                else if (which == 1) startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + getPackageName())));
                else if (which == 2) chooseSourceLanguage();
                else if (sharing() || !roomId().isEmpty()) showFeedback("请先结束当前房间再退出登录");
                else { store.clear(); DriverUi.openLogin(this); }
            }).create());
    }

    private void chooseSourceLanguage() {
        if (!roomId().isEmpty()) { showFeedback("请先结束当前房间，再修改讲话语言"); return; }
        DriverUi.show(new AlertDialog.Builder(this).setTitle(R.string.source_language).setItems(DriverLanguages.LABELS, (dialog, which) -> {
            store.preferences().edit().putString("sourceLanguage", DriverLanguages.CODES[which]).apply(); render();
        }).create());
    }

    private String sourceLabel() {
        return DriverLanguages.label(store.preferences().getString("sourceLanguage", "zh-CN"));
    }

    private String roomId() { return store.preferences().getString("roomId", ""); }
    private boolean sharing() { return store.preferences().getBoolean("sharing", false); }
    private String time(long timestamp) { return java.text.DateFormat.getTimeInstance(java.text.DateFormat.MEDIUM).format(new java.util.Date(timestamp)); }

    private void render() {
        if (!alive || feedback == null) return;
        boolean hasRoom = !roomId().isEmpty();
        boolean shared = sharing();
        TextView connection = findViewById(R.id.connection_badge);
        connection.setText(hasRoom ? R.string.room_ready : R.string.room_waiting);
        connection.setActivated(hasRoom);
        connection.setTextColor(getColor(hasRoom ? R.color.driver_teal : R.color.driver_on_dark));
        ((TextView) findViewById(R.id.room_code)).setText(hasRoom ? store.preferences().getString("roomCode", "") : getString(R.string.no_room_code));
        roomAction.setText(hasRoom ? R.string.room_code_action : R.string.create_room_action);
        roomAction.setCompoundDrawablesRelativeWithIntrinsicBounds(hasRoom ? R.drawable.ic_qr : 0, 0, 0, 0);
        roomAction.setCompoundDrawablePadding(DriverUi.dp(this, 6));
        roomAction.setEnabled(!busy && !starting); settings.setEnabled(!busy && !starting);
        String state = store.preferences().getString("commentaryState", "stopped");
        boolean active = store.preferences().getBoolean("commentaryActive", false);
        boolean pending = "connecting".equals(state) || "reconnecting".equals(state) || "starting".equals(state) || "pausing".equals(state);
        microphoneAction.setText(pending ? R.string.operation_pending : active ? R.string.commentary_pause : "paused".equals(state) ? R.string.commentary_continue : R.string.commentary_start);
        microphoneAction.setActivated(active); microphoneAction.setEnabled(!busy && !pending && hasRoom);
        microphoneAction.setCompoundDrawablesRelativeWithIntrinsicBounds(active ? R.drawable.ic_pause : R.drawable.ic_microphone, 0, 0, 0);
        microphoneAction.setCompoundDrawableTintList(getColorStateList(R.color.driver_primary_text));
        TextView commentaryBadge = findViewById(R.id.commentary_badge);
        commentaryBadge.setText(pending ? R.string.operation_pending : active ? R.string.commentary_badge_live
            : "paused".equals(state) ? R.string.commentary_badge_paused : R.string.commentary_badge_idle);
        commentaryBadge.setActivated(active);
        commentaryBadge.setTextColor(getColor(active ? R.color.driver_teal : R.color.driver_muted));
        ((TextView) findViewById(R.id.commentary_state)).setText(hasRoom
            ? store.preferences().getString("commentaryStatus", getString(R.string.commentary_idle)) : getString(R.string.commentary_idle));
        String source = store.preferences().getString("commentaryText", "");
        ((TextView) findViewById(R.id.commentary_text)).setText(source.isEmpty() ? getString(R.string.commentary_text_waiting) : source);
        ((TextView) findViewById(R.id.commentary_text)).setTextColor(getColor(source.isEmpty() ? R.color.driver_muted : R.color.driver_ink));
        int count = store.preferences().getInt("questionCount", 0);
        questionsAction.setText(count == 0 ? getString(R.string.questions_action) : getString(R.string.questions_count, count));
        int listeners = 0;
        try { listeners = new JSONObject(store.preferences().getString("roomSnapshot", "")).optInt("listenerCount"); } catch (Exception ignored) { }
        ((TextView) findViewById(R.id.listener_count)).setText(hasRoom ? getString(R.string.listeners_count, listeners, sourceLabel()) : getString(R.string.listeners_waiting));
        microphoneLevel.setProgress(store.preferences().getInt("microphoneLevel", 0));
        if (map == null) mapMessage.setText(store.preferences().getBoolean("mapPrivacyAccepted", false) ? R.string.map_failed : R.string.map_consent);
        else mapMessage.setText(R.string.map_waiting);
        try {
            String saved = store.preferences().getString("lastFix", "");
            if (!saved.isEmpty()) {
                JSONObject fix = new JSONObject(saved);
                int accuracy = (int) Math.ceil(fix.getDouble("accuracy"));
                long sampledAt = Instant.parse(fix.getString("sampledAt")).toEpochMilli();
                if (map != null) {
                    map.update(fix);
                    mapMessage.setText(shared && System.currentTimeMillis() - sampledAt <= 30000
                        ? getString(R.string.map_current, accuracy) : getString(R.string.map_old, time(sampledAt)));
                }
            } else if (map != null) map.clear();
        } catch (Exception ignored) { }
    }

    private void showFeedback(String message) { showFeedback(message, true); }
    private void showFeedback(String message, boolean error) {
        feedback.setText(message); feedback.setTextColor(getColor(error ? R.color.driver_error : R.color.driver_teal));
        feedback.setVisibility(message.isEmpty() ? View.GONE : View.VISIBLE);
    }
    private interface Work { String run() throws Exception; }
    private void task(Work work, Runnable success) {
        if (busy || !alive) return;
        busy = true; showFeedback(""); render();
        worker.execute(() -> {
            try {
                String message = work.run();
                runOnUiThread(() -> { if (alive) { busy = false; render(); showFeedback(message, false); if (success != null) success.run(); } });
            } catch (Exception failure) {
                runOnUiThread(() -> { if (alive) { busy = false; render(); showFeedback(failure.getMessage() == null ? "操作失败，请稍后重试" : failure.getMessage()); } });
            }
        });
    }

    @Override public void onResume() {
        super.onResume(); resumed = true;
        if (map != null) map.resume();
        if (feedback != null) ticker.run();
        if (pendingStart) { pendingStart = false; startLocation(); }
        if (pendingMicrophone) { pendingMicrophone = false; startCommentary(); }
    }
    @Override public void onPause() { resumed = false; handler.removeCallbacks(ticker); if (map != null) map.pause(); super.onPause(); }
    @Override public void onSaveInstanceState(Bundle state) {
        if (map != null) { Bundle saved = new Bundle(); map.save(saved); state.putBundle("map", saved); }
        super.onSaveInstanceState(state);
    }
    @Override public void onDestroy() {
        alive = false; handler.removeCallbacksAndMessages(null);
        if (store != null) store.preferences().unregisterOnSharedPreferenceChangeListener(changed);
        if (map != null) map.destroy();
        worker.shutdown(); super.onDestroy();
    }
}
