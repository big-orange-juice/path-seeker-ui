package com.pathseeker.driver;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicInteger;

final class QuestionAudioPreparation implements AutoCloseable {
    static final int MAX_FILES = 64;
    static final int MAX_HEX_CHARACTERS = 8 * 1024 * 1024;
    interface Listener {
        void ready(List<File> files);
        void failed(Exception failure);
    }

    private final File directory;
    private final Executor callbacks;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(command -> new Thread(command, "driver-question-audio"));
    private final AtomicInteger generation = new AtomicInteger();
    private volatile boolean closed;
    private Future<?> pending;

    QuestionAudioPreparation(File directory, Executor callbacks) {
        this.directory = directory;
        this.callbacks = callbacks;
    }

    void prepare(List<String> sentences, Listener listener) {
        cancel();
        if (closed) return;
        int token = generation.get();
        List<String> input = new ArrayList<>(sentences);
        pending = worker.submit(() -> {
            List<File> files = new ArrayList<>();
            try {
                if (input.isEmpty() || input.size() > MAX_FILES) throw new IOException("提问音频数量异常");
                long characters = 0;
                for (String hex : input) {
                    if (hex == null || hex.isEmpty() || hex.length() % 2 != 0) throw new IOException("提问音频格式异常");
                    characters += hex.length();
                    if (characters > MAX_HEX_CHARACTERS) throw new IOException("提问音频过大");
                }
                for (String hex : input) {
                    checkCurrent(token);
                    File file = File.createTempFile("driver-question-", ".mp3", directory);
                    files.add(file);
                    try (FileOutputStream output = new FileOutputStream(file)) {
                        byte[] buffer = new byte[8192];
                        int used = 0;
                        for (int offset = 0; offset < hex.length(); offset += 2) {
                            int high = Character.digit(hex.charAt(offset), 16);
                            int low = Character.digit(hex.charAt(offset + 1), 16);
                            if (high < 0 || low < 0) throw new IOException("提问音频格式异常");
                            buffer[used++] = (byte) ((high << 4) | low);
                            if (used == buffer.length) {
                                checkCurrent(token);
                                output.write(buffer);
                                used = 0;
                            }
                        }
                        checkCurrent(token);
                        if (used > 0) output.write(buffer, 0, used);
                    }
                }
                checkCurrent(token);
                callbacks.execute(() -> {
                    if (current(token)) listener.ready(Collections.unmodifiableList(files));
                    else discard(files);
                });
            } catch (Exception failure) {
                delete(files);
                if (current(token)) callbacks.execute(() -> { if (current(token)) listener.failed(failure); });
            }
        });
    }

    private boolean current(int token) { return !closed && generation.get() == token; }

    private void checkCurrent(int token) throws InterruptedException {
        if (!current(token) || Thread.currentThread().isInterrupted()) throw new InterruptedException("已取消音频准备");
    }

    void cancel() {
        generation.incrementAndGet();
        if (pending != null) { pending.cancel(true); pending = null; }
    }

    void discard(List<File> files) {
        if (files.isEmpty()) return;
        List<File> snapshot = new ArrayList<>(files);
        try { worker.execute(() -> delete(snapshot)); }
        catch (RejectedExecutionException stopped) { delete(snapshot); }
    }

    private static void delete(List<File> files) {
        for (File file : files) if (file != null) file.delete();
    }

    @Override public void close() {
        closed = true;
        cancel();
        worker.shutdown();
    }
}
