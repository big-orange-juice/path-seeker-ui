package com.pathseeker.driver;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.net.URLEncoder;
import java.io.UnsupportedEncodingException;
import java.util.EnumMap;

final class RoomInvitation {
    static String url(String appId, String code) {
        if (appId == null || !appId.matches("[0-9]{16}")) throw new IllegalArgumentException("支付宝小程序 AppID 未配置");
        if (code == null || !code.matches("[0-9]{8}")) throw new IllegalArgumentException("房间码无效，请重新打开房间");
        String scheme = "alipays://platformapi/startapp?appId=" + appId
            + "&page=" + encode("pages/translation-room/index")
            + "&query=" + encode("roomCode=" + code + "&autoJoin=1");
        return "https://ds.alipay.com/?scheme=" + encode(scheme);
    }

    static BitMatrix matrix(String appId, String code) throws WriterException {
        EnumMap<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 4);
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        return new QRCodeWriter().encode(url(appId, code), BarcodeFormat.QR_CODE, 720, 720, hints);
    }

    private static String encode(String value) {
        try { return URLEncoder.encode(value, "UTF-8"); }
        catch (UnsupportedEncodingException failure) { throw new AssertionError(failure); }
    }
}
