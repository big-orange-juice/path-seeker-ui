package com.pathseeker.driver;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

final class DriverQuestionPlayer {
    private final Context context;
    private final SessionStore store;
    private final java.util.function.Consumer<String> status;
    private final LinkedHashMap<String, JSONObject> questions = new LinkedHashMap<>();
    private final ArrayDeque<byte[]> audio = new ArrayDeque<>();
    private final AudioManager manager;
    private final AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    private AudioFocusRequest focus;
    private MediaPlayer player;
    private File currentFile;
    private boolean playing;

    DriverQuestionPlayer(Context context, SessionStore store, java.util.function.Consumer<String> status) {
        this.context = context; this.store = store; this.status = status;
        manager = context.getSystemService(AudioManager.class);
    }

    void accept(JSONObject question) {
        String id = question.optString("id");
        if (id.isEmpty()) return;
        questions.put(id, question);
        while (questions.size() > 8) questions.remove(questions.keySet().iterator().next());
        long total = questions.values().stream().mapToLong(value -> value.optJSONArray("audio") == null ? 0 : value.optJSONArray("audio").toString().length()).sum();
        if (total > 8 * 1024 * 1024) question.remove("audio");
        publish();
    }

    void publish() {
        questions.values().removeIf(question -> question.optLong("expiresAt") <= System.currentTimeMillis());
        int count = 0;
        StringBuilder text = new StringBuilder();
        for (JSONObject question : questions.values()) {
            if (question.optJSONArray("audio") != null) count++;
            String content = question.optString("text", question.optString("source"));
            if (content.isEmpty()) content = question.optString("source");
            if (content.isEmpty()) continue;
            if (text.length() > 0) text.append('\n');
            text.append(question.optString("displayName", "游客")).append("：").append(content);
        }
        store.preferences().edit().putInt("questionCount", count).putString("questionText", text.toString()).putBoolean("questionPlaying", playing).apply();
    }

    void play() {
        stop();
        publish();
        try {
            for (JSONObject question : questions.values()) {
                JSONArray sentences = question.optJSONArray("audio");
                if (sentences == null) continue;
                for (int index = 0; index < sentences.length(); index++) {
                    JSONObject sentence = sentences.getJSONObject(index);
                    if (!"mp3".equals(sentence.optString("format", "mp3"))) continue;
                    String hex = sentence.optString("hex");
                    if (hex.isEmpty() || hex.length() % 2 != 0 || hex.length() > 8 * 1024 * 1024) continue;
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream(hex.length() / 2);
                    for (int offset = 0; offset < hex.length(); offset += 2) {
                        int high = Character.digit(hex.charAt(offset), 16), low = Character.digit(hex.charAt(offset + 1), 16);
                        if (high < 0 || low < 0) throw new IllegalArgumentException("提问音频格式异常");
                        bytes.write((high << 4) | low);
                    }
                    audio.add(bytes.toByteArray());
                }
                question.remove("audio");
            }
            if (audio.isEmpty()) { status.accept("没有待收听的提问，可查看提问文字"); publish(); return; }
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(change -> { if (change < 0) { stop(); status.accept("提问播放已中断，请继续讲解"); } }).build();
            if (manager.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) throw new IllegalStateException("音频正在被其他应用使用");
            playing = true; publish(); status.accept("正在收听游客提问，麦克风已暂停");
            next();
        } catch (Exception failure) { stop(); status.accept("提问播放失败，请查看文字后继续讲解"); }
    }

    private void next() {
        releasePlayer();
        byte[] bytes = audio.poll();
        if (bytes == null) { stop(); status.accept("提问收听完毕，点击麦克风继续讲解"); return; }
        try {
            currentFile = File.createTempFile("driver-question-", ".mp3", context.getCacheDir());
            try (FileOutputStream output = new FileOutputStream(currentFile)) { output.write(bytes); }
            player = new MediaPlayer(); player.setAudioAttributes(attributes); player.setDataSource(currentFile.getAbsolutePath());
            player.setOnPreparedListener(MediaPlayer::start);
            player.setOnCompletionListener(completed -> next());
            player.setOnErrorListener((failed, what, extra) -> { stop(); status.accept("提问音频不可用，请查看文字"); return true; });
            player.prepareAsync();
        } catch (Exception failure) { stop(); status.accept("提问音频不可用，请查看文字"); }
    }

    private void releasePlayer() {
        if (player != null) { player.release(); player = null; }
        if (currentFile != null) { currentFile.delete(); currentFile = null; }
    }

    void stop() {
        audio.clear(); releasePlayer(); playing = false;
        if (focus != null) { manager.abandonAudioFocusRequest(focus); focus = null; }
        publish();
    }

    void clear() { questions.clear(); stop(); }
}
