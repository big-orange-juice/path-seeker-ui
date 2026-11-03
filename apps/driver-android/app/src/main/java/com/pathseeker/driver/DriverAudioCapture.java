package com.pathseeker.driver;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import java.util.Arrays;

final class DriverAudioCapture {
    interface Listener {
        void frame(byte[] pcm, int level);
        void failed(String message);
    }
    private final AudioRecord recorder;
    private final Listener listener;
    private Thread thread;
    private volatile boolean stopped;

    DriverAudioCapture(Context context, Listener listener) {
        this.listener = listener;
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            throw new SecurityException("请允许麦克风权限");
        int minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minimum <= 0) throw new IllegalStateException("当前设备不支持 16 kHz 录音");
        recorder = new AudioRecord.Builder().setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            .setAudioFormat(new AudioFormat.Builder().setSampleRate(16000).setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
            .setBufferSizeInBytes(Math.max(minimum * 2, 6400)).build();
        if (recorder.getState() != AudioRecord.STATE_INITIALIZED) { recorder.release(); throw new IllegalStateException("无法打开麦克风，请检查设备或权限"); }
    }

    void start() {
        try {
            recorder.startRecording();
            if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("麦克风未能启动");
        } catch (RuntimeException failure) { recorder.release(); throw failure; }
        thread = new Thread(this::capture, "driver-microphone");
        thread.start();
    }

    private void capture() {
        byte[] buffer = new byte[3200];
        try {
            while (!stopped) {
                int count = recorder.read(buffer, 0, buffer.length, AudioRecord.READ_BLOCKING);
                if (stopped) break;
                if (count <= 0 || count % 2 != 0) throw new IllegalStateException("麦克风被中断，请重新开始讲解");
                if (android.os.Build.VERSION.SDK_INT >= 29 && recorder.getActiveRecordingConfiguration() != null
                    && recorder.getActiveRecordingConfiguration().isClientSilenced())
                    throw new IllegalStateException("麦克风被系统或其他应用暂停，请返回 APP 重新开始讲解");
                long energy = 0;
                for (int offset = 0; offset < count; offset += 2) {
                    int sample = (short) ((buffer[offset] & 255) | (buffer[offset + 1] << 8));
                    energy += (long) sample * sample;
                }
                int level = Math.min(100, (int) (Math.sqrt(energy / (count / 2.0)) / 80));
                listener.frame(Arrays.copyOf(buffer, count), level);
            }
        } catch (Exception failure) { if (!stopped) listener.failed(failure.getMessage() == null ? "录音中断，请重新开启麦克风" : failure.getMessage()); }
        finally { recorder.release(); }
    }

    void stop() {
        stopped = true;
        try { recorder.stop(); } catch (RuntimeException ignored) { }
        if (thread != null && thread != Thread.currentThread()) {
            try { thread.join(1000); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
        }
    }
}
