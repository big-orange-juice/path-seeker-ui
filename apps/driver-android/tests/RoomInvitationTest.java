package com.pathseeker.driver;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.common.HybridBinarizer;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public final class RoomInvitationTest {
    public static void main(String[] arguments) throws Exception {
        String appId = "2021007110628321";
        for (String code : new String[] { "12345678", "87654321", "00000001", "99999999" }) {
            String expected = RoomInvitation.url(appId, code);
            URI bridge = URI.create(expected);
            assert bridge.getHost().equals("ds.alipay.com");
            URI scheme = URI.create(parameters(bridge.getRawQuery()).get("scheme"));
            assert scheme.getScheme().equals("alipays");
            assert scheme.getHost().equals("platformapi");
            assert scheme.getPath().equals("/startapp");
            Map<String, String> target = parameters(scheme.getRawQuery());
            assert target.get("appId").equals(appId);
            assert target.get("page").equals("pages/translation-room/index");
            assert parameters(target.get("query")).equals(Map.of("roomCode", code, "autoJoin", "1",
                "routeCode", "OUT-610000000000000001-20261030102158"));
            BitMatrix matrix = RoomInvitation.matrix(appId, code);
            int width = matrix.getWidth(), height = matrix.getHeight();
            int[] pixels = new int[width * height];
            for (int row = 0; row < height; row++) for (int column = 0; column < width; column++)
                pixels[row * width + column] = matrix.get(column, row) ? 0xff000000 : 0xffffffff;
            if (arguments.length > 0) {
                java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB);
                image.setRGB(0, 0, width, height, pixels, 0, width);
                javax.imageio.ImageIO.write(image, "png", new java.io.File(arguments[0], "room-" + code + ".png"));
            }
            String decoded;
            try { decoded = new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(
                new RGBLuminanceSource(width, height, pixels))), Map.of(DecodeHintType.PURE_BARCODE, true)).getText(); }
            catch (com.google.zxing.ReaderException failure) { throw new AssertionError("房间二维码解码失败: " + code, failure); }
            assert decoded.equals(expected) : "二维码往返解码必须保留完整房间参数";
            assert !matrix.get(0, 0) : "二维码必须保留白色静区";
        }
        for (String invalid : new String[] { null, "", "1234567", "123456789", "12a45678", " 12345678" }) {
            try { RoomInvitation.url(appId, invalid); throw new AssertionError("应拒绝无效房间码"); }
            catch (IllegalArgumentException expected) { }
        }
        try { RoomInvitation.url("other", "12345678"); throw new AssertionError("应拒绝无效 AppID"); }
        catch (IllegalArgumentException expected) { }
        System.out.println("RoomInvitation: 二维码往返解码、双层参数编码、字符串房间码及无效配置检查通过");
    }

    private static Map<String, String> parameters(String query) {
        Map<String, String> result = new HashMap<>();
        for (String part : query.split("&")) {
            String[] pair = part.split("=", 2);
            result.put(URLDecoder.decode(pair[0], StandardCharsets.UTF_8), URLDecoder.decode(pair[1], StandardCharsets.UTF_8));
        }
        return result;
    }
}
