package com.pathseeker.driver;

import java.util.Locale;

final class DriverLanguages {
    static final String[] CODES = { "zh-CN", "en", "ru", "es", "fr", "ja", "ko", "yue" };
    static final String[] LABELS = { "中文", "English", "Русский", "Español", "Français", "日本語", "한국어", "粤语" };

    private DriverLanguages() {}

    static String normalize(String language) {
        String normalized = language == null ? "" : language.trim().replace('_', '-').toLowerCase(Locale.ROOT);
        if (normalized.equals("zh-hk") || normalized.equals("zh-yue") || normalized.startsWith("yue-")) return "yue";
        String base = normalized.split("-")[0];
        for (String code : CODES) if (code.equals(base)) return code;
        return "zh-CN";
    }

    static String label(String language) {
        String code = normalize(language);
        for (int index = 0; index < CODES.length; index++) if (CODES[index].equals(code)) return LABELS[index];
        return LABELS[0];
    }
}
