package com.pathseeker.driver;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

public final class QuestionAudioPreparationTest {
    private static int passed;

    private static final class Fixture implements AutoCloseable {
        final File directory = Files.createTempDirectory("driver-audio-test-").toFile();
        final BlockingQueue<Runnable> callbacks = new LinkedBlockingQueue<>();
        final QuestionAudioPreparation preparation = new QuestionAudioPreparation(directory, callbacks::add);
        final List<List<File>> ready = new ArrayList<>();
        final List<Exception> failures = new ArrayList<>();
        final QuestionAudioPreparation.Listener listener = new QuestionAudioPreparation.Listener() {
            @Override public void ready(List<File> files) { ready.add(files); }
            @Override public void failed(Exception failure) { failures.add(failure); }
        };
        Fixture() throws Exception { }
        Runnable callback() throws Exception {
            Runnable callback = callbacks.poll(5, TimeUnit.SECONDS);
            require(callback != null, "后台任务必须完成并投递回调");
            return callback;
        }
        @Override public void close() throws Exception {
            preparation.close();
            for (List<File> files : ready) preparation.discard(files);
            await(() -> {
                Runnable callback;
                while ((callback = callbacks.poll()) != null) callback.run();
                return directory.listFiles() != null && directory.listFiles().length == 0;
            });
            Files.delete(directory.toPath());
        }
    }

    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    private static void await(BooleanSupplier condition) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.getAsBoolean() && System.nanoTime() < deadline) Thread.sleep(10);
        require(condition.getAsBoolean(), "临时文件必须及时清理");
    }

    private static void decodedFiles() throws Exception {
        try (Fixture fixture = new Fixture()) {
            fixture.preparation.prepare(Arrays.asList("49443300ff", "aAbBcC"), fixture.listener);
            Runnable callback = fixture.callback();
            require(fixture.ready.isEmpty(), "音频准备不应同步调用播放层");
            callback.run();
            List<File> files = fixture.ready.get(0);
            require(files.size() == 2, "保留句子顺序");
            require(Arrays.equals(Files.readAllBytes(files.get(0).toPath()), new byte[] { 73, 68, 51, 0, -1 }), "第一句解码正确");
            require(Arrays.equals(Files.readAllBytes(files.get(1).toPath()), new byte[] { -86, -69, -52 }), "兼容大小写十六进制");
            require(fixture.failures.isEmpty(), "合法音频不报错");
        }
        passed++;
    }

    private static void cancelledBeforeDelivery() throws Exception {
        try (Fixture fixture = new Fixture()) {
            fixture.preparation.prepare(Collections.singletonList("1234"), fixture.listener);
            Runnable callback = fixture.callback();
            fixture.preparation.cancel();
            callback.run();
            require(fixture.ready.isEmpty() && fixture.failures.isEmpty(), "停止后旧任务不能开始播放或更新失败状态");
        }
        passed++;
    }

    private static void replacementAndClose() throws Exception {
        try (Fixture fixture = new Fixture()) {
            fixture.preparation.prepare(Collections.singletonList("1234"), fixture.listener);
            Runnable old = fixture.callback();
            fixture.preparation.prepare(Collections.singletonList("5678"), fixture.listener);
            Runnable current = fixture.callback();
            old.run(); current.run();
            require(fixture.ready.size() == 1, "新任务替换后仅交付一次");
            require(Arrays.equals(Files.readAllBytes(fixture.ready.get(0).get(0).toPath()), new byte[] { 86, 120 }), "不能交付旧句子");
        }
        try (Fixture fixture = new Fixture()) {
            fixture.preparation.prepare(Collections.singletonList("1234"), fixture.listener);
            Runnable callback = fixture.callback();
            fixture.preparation.close(); callback.run();
            fixture.preparation.prepare(Collections.singletonList("5678"), fixture.listener);
            require(fixture.ready.isEmpty() && fixture.failures.isEmpty(), "销毁后不能回调或重新启动");
        }
        passed++;
    }

    private static void malformedAndLimits() throws Exception {
        List<List<String>> inputs = Arrays.asList(Collections.singletonList("123"), Arrays.asList("1234", "xx"),
            Collections.emptyList(), Collections.nCopies(QuestionAudioPreparation.MAX_FILES + 1, "00"),
            Arrays.asList("0".repeat(QuestionAudioPreparation.MAX_HEX_CHARACTERS), "00"));
        for (List<String> input : inputs) {
            try (Fixture fixture = new Fixture()) {
                fixture.preparation.prepare(input, fixture.listener);
                fixture.callback().run();
                require(fixture.ready.isEmpty() && fixture.failures.size() == 1, "畸形或超限输入只能失败一次");
                require(fixture.directory.listFiles().length == 0, "错误后不能留下半成品文件");
                fixture.preparation.prepare(Collections.singletonList("0102"), fixture.listener);
                fixture.callback().run();
                require(fixture.ready.size() == 1, "失败后可重新准备音频");
            }
        }
        passed++;
    }

    private static void discardAndIoFailure() throws Exception {
        try (Fixture fixture = new Fixture()) {
            fixture.preparation.prepare(Collections.singletonList("0102"), fixture.listener);
            fixture.callback().run();
            fixture.preparation.discard(fixture.ready.get(0));
            await(() -> fixture.directory.listFiles().length == 0);
        }
        File regularFile = File.createTempFile("audio-not-directory-", ".tmp");
        BlockingQueue<Runnable> callbacks = new LinkedBlockingQueue<>();
        List<Exception> failures = new ArrayList<>();
        try (QuestionAudioPreparation preparation = new QuestionAudioPreparation(regularFile, callbacks::add)) {
            preparation.prepare(Collections.singletonList("0102"), new QuestionAudioPreparation.Listener() {
                @Override public void ready(List<File> files) { throw new AssertionError("写入失败不能播放"); }
                @Override public void failed(Exception failure) { failures.add(failure); }
            });
            Runnable callback = callbacks.poll(5, TimeUnit.SECONDS);
            require(callback != null, "文件失败也必须有回调"); callback.run();
            require(failures.size() == 1, "文件系统失败可恢复并报告");
        } finally { Files.delete(regularFile.toPath()); }
        passed++;
    }

    private static void cancelDuringWrite() throws Exception {
        try (Fixture fixture = new Fixture()) {
            fixture.preparation.prepare(Collections.singletonList("ab".repeat(2 * 1024 * 1024)), fixture.listener);
            await(() -> fixture.directory.listFiles().length > 0);
            fixture.preparation.cancel();
            await(() -> {
                Runnable callback;
                while ((callback = fixture.callbacks.poll()) != null) callback.run();
                return fixture.directory.listFiles().length == 0;
            });
            require(fixture.ready.isEmpty() && fixture.failures.isEmpty(), "转换途中取消不交付音频或错误");
        }
        passed++;
    }

    public static void main(String[] args) throws Exception {
        decodedFiles(); cancelledBeforeDelivery(); replacementAndClose(); malformedAndLimits(); discardAndIoFailure(); cancelDuringWrite();
        System.out.println("PASS: " + passed + " audio preparation groups (decode, cancel, replace, close, limits, cleanup, IO recovery)");
    }
}
