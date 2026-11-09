package com.pathseeker.driver;

import java.util.Arrays;

public final class DriverLanguagesTest {
    public static void main(String[] args) {
        assert Arrays.equals(DriverLanguages.CODES, new String[] { "zh-CN", "en", "ru", "es", "fr", "ja", "ko", "yue" });
        assert DriverLanguages.CODES.length == DriverLanguages.LABELS.length;
        for (String code : DriverLanguages.CODES) assert code.equals(DriverLanguages.normalize(code));
        assert "ko".equals(DriverLanguages.normalize("KO_kr"));
        assert "yue".equals(DriverLanguages.normalize("zh-HK"));
        assert "yue".equals(DriverLanguages.normalize("yue-HK"));
        assert "zh-CN".equals(DriverLanguages.normalize("zh-TW"));
        assert "zh-CN".equals(DriverLanguages.normalize("de"));
        assert "zh-CN".equals(DriverLanguages.normalize(null));
        assert "粤语".equals(DriverLanguages.label("yue"));
        assert "中文".equals(DriverLanguages.label("de"));
        System.out.println("Driver language tests passed");
    }
}
