package com.pathseeker.driver;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;
import java.io.File;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

final class DriverQuestionPlayer {
    private final SessionStore store;
    private final java.util.function.Consumer<String> status;
    private final LinkedHashMap<String, JSONObject> questions = new LinkedHashMap<>();
    private final ArrayDeque<File> audio = new ArrayDeque<>();
    private final QuestionAudioPreparation preparation;
    private final AudioManager manager;
    private final AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    private AudioFocusRequest focus;
    private MediaPlayer player;
    private File currentFile;
    private boolean playing;
    private int generation;
    private boolean closed;

    DriverQuestionPlayer(Context context, SessionStore store, java.util.function.Consumer<String> status) {
        this.store = store; this.status = status;
        manager = context.getSystemService(AudioManager.class);
        Handler handler = new Handler(Looper.getMainLooper());
        preparation = new QuestionAudioPreparation(context.getCacheDir(), command -> handler.post(command));
    }

    void accept(JSONObject question) {
        String id = question.optString("id");
        if (id.isEmpty()) return;
        questions.put(id, question);
        while (questions.size() > 8) questions.remove(questions.keySet().iterator().next());
        long total = 0;
        for (JSONObject pending : questions.values()) {
            JSONArray sentences = pending.optJSONArray("audio");
            if (sentences == null) continue;
            for (int index = 0; index < sentences.length(); index++) {
                JSONObject sentence = sentences.optJSONObject(index);
                if (sentence != null) total += sentence.optString("hex").length();
            }
        }
        if (total > QuestionAudioPreparation.MAX_HEX_CHARACTERS) question.remove("audio");
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
        if (closed) return;
        publish();
        int token = generation;
        List<String> sentencesToPrepare = new ArrayList<>();
        LinkedHashMap<JSONObject, JSONArray> selected = new LinkedHashMap<>();
        try {
            for (JSONObject question : questions.values()) {
                JSONArray sentences = question.optJSONArray("audio");
                if (sentences == null) continue;
                selected.put(question, sentences);
                for (int index = 0; index < sentences.length(); index++) {
                    JSONObject sentence = sentences.getJSONObject(index);
                    if (!"mp3".equals(sentence.optString("format", "mp3"))) continue;
                    String hex = sentence.optString("hex");
                    if (hex.isEmpty()) continue;
                    sentencesToPrepare.add(hex);
                    if (sentencesToPrepare.size() > QuestionAudioPreparation.MAX_FILES) throw new IllegalArgumentException("提问音频数量异常");
                }
            }
            if (sentencesToPrepare.isEmpty()) { status.accept("没有待收听的提问，可查看提问文字"); return; }
            playing = true; publish(); status.accept("正在准备提问音频，麦克风已暂停");
            preparation.prepare(sentencesToPrepare, new QuestionAudioPreparation.Listener() {
                @Override public void ready(List<File> files) {
                    if (closed || token != generation) { preparation.discard(files); return; }
                    audio.addAll(files);
                    try {
                        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes)
                            .setOnAudioFocusChangeListener(change -> { if (token == generation && change < 0) { stop(); status.accept("提问播放已中断，请继续讲解"); } }).build();
                        if (manager.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) throw new IllegalStateException("音频正在被其他应用使用");
                        selected.forEach((question, sentences) -> { if (question.optJSONArray("audio") == sentences) question.remove("audio"); });
                        publish(); status.accept("正在收听游客提问，麦克风已暂停");
                        next(token);
                    } catch (Exception failure) { stop(); status.accept("提问播放失败，请查看文字后继续讲解"); }
                }
                @Override public void failed(Exception failure) {
                    if (closed || token != generation) return;
                    stop(); status.accept("提问音频不可用，请查看文字后继续讲解");
                }
            });
        } catch (Exception failure) { stop(); status.accept("提问播放失败，请查看文字后继续讲解"); }
    }

    private void next(int token) {
        if (closed || token != generation) return;
        releasePlayer();
        currentFile = audio.poll();
        if (currentFile == null) { stop(); status.accept("提问收听完毕，点击麦克风继续讲解"); return; }
        try {
            player = new MediaPlayer(); player.setAudioAttributes(attributes); player.setDataSource(currentFile.getAbsolutePath());
            player.setOnPreparedListener(prepared -> { if (!closed && token == generation && prepared == player) prepared.start(); });
            player.setOnCompletionListener(completed -> { if (token == generation && completed == player) next(token); });
            player.setOnErrorListener((failed, what, extra) -> { if (token == generation && failed == player) { stop(); status.accept("提问音频不可用，请查看文字"); } return true; });
            player.prepareAsync();
        } catch (Exception failure) { stop(); status.accept("提问音频不可用，请查看文字"); }
    }

    private void releasePlayer() {
        if (player != null) { player.release(); player = null; }
        if (currentFile != null) { preparation.discard(Collections.singletonList(currentFile)); currentFile = null; }
    }

    void stop() {
        generation++; preparation.cancel();
        releasePlayer(); preparation.discard(new ArrayList<>(audio)); audio.clear(); playing = false;
        if (focus != null) { manager.abandonAudioFocusRequest(focus); focus = null; }
        publish();
    }

    void clear() { questions.clear(); stop(); }
    void close() { closed = true; clear(); preparation.close(); }
}
