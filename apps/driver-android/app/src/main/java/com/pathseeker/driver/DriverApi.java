package com.pathseeker.driver;

import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class DriverApi {
    static final Object AUTH_LOCK = new Object();
    static final class ApiException extends Exception {
        final int status;
        ApiException(int status, String message) { super(message); this.status = status; }
        boolean terminal() { return status == 400 || status == 401 || status == 403 || status == 404; }
    }
    private final SessionStore store;
    DriverApi(SessionStore store) { this.store = store; }

    String accessToken() throws Exception {
        synchronized (AUTH_LOCK) { return store.load().optString("accessToken"); }
    }

    JSONObject login(String account, String password) throws Exception {
        JSONObject result = send("/AppUser/Login", "POST", new JSONObject().put("account", account)
            .put("password", password).put("platform", 2).put("device", android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL)
            .put("langCode", "zh-CN"), "");
        synchronized (AUTH_LOCK) { store.save(result); }
        return result;
    }

    JSONObject call(String path, String method, JSONObject body) throws Exception {
        String token;
        synchronized (AUTH_LOCK) { token = store.load().optString("accessToken"); }
        if (token.isEmpty()) throw new ApiException(401, "请先登录");
        try { return send(path, method, body, token); }
        catch (ApiException failure) {
            if (failure.status != 401) throw failure;
            synchronized (AUTH_LOCK) {
                JSONObject session = store.load();
                if (token.equals(session.optString("accessToken"))) {
                    String refresh = session.optString("refreshToken");
                    if (refresh.isEmpty()) throw failure;
                    JSONObject refreshed = send("/AppUser/RefreshToken", "POST", new JSONObject().put("refreshToken", refresh), "");
                    store.save(refreshed);
                }
                token = store.load().optString("accessToken");
            }
            return send(path, method, body, token);
        }
    }

    private JSONObject send(String path, String method, JSONObject body, String token) throws Exception {
        String base = store.apiBase();
        URI uri = URI.create(base + path);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null)
            throw new Exception("请输入 HTTPS 后台地址，包含 /api");
        HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        if (!token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        try {
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (var output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            int status = connection.getResponseCode();
            var stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null) throw new ApiException(status, "服务返回异常（" + status + "）");
            String raw;
            try (var input = stream; var output = new java.io.ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                raw = output.toString(StandardCharsets.UTF_8.name());
            }
            JSONObject envelope;
            try { envelope = new JSONObject(raw); }
            catch (Exception invalid) { throw new ApiException(status, "服务响应格式异常（" + status + "）"); }
            int code = envelope.optInt("code", -1);
            if (status < 200 || status >= 300 || code != 0)
                throw new ApiException(code == 10002 ? 401 : status >= 200 && status < 300 ? 400 : status, envelope.optString("message", "请求失败"));
            JSONObject data = envelope.optJSONObject("data");
            return data == null ? new JSONObject() : data;
        } finally { connection.disconnect(); }
    }
}
