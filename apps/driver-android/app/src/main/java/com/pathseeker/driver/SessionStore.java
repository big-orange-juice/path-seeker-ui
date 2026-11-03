package com.pathseeker.driver;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

final class SessionStore {
    static final String DEFAULT_API_BASE = "https://www.omahaaigc.com/path-seeker/api";
    private static final String ALIAS = "pathseeker_driver_session";
    private final SharedPreferences preferences;

    SessionStore(Context context) { preferences = context.getSharedPreferences("driver", Context.MODE_PRIVATE); }
    SharedPreferences preferences() { return preferences; }

    String apiBase() {
        String saved = preferences.getString("apiBase", DEFAULT_API_BASE);
        if ("https://www.omahaaigc.com/api".equals(saved)) {
            preferences.edit().putString("apiBase", DEFAULT_API_BASE).apply();
            return DEFAULT_API_BASE;
        }
        return saved;
    }

    boolean loggedIn() {
        try { return !load().optString("accessToken").isEmpty(); }
        catch (Exception failure) { clear(); return false; }
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }

    synchronized void save(JSONObject session) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":"
            + Base64.encodeToString(cipher.doFinal(session.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!preferences.edit().putString("session", encrypted).commit()) throw new Exception("登录信息保存失败");
    }

    synchronized JSONObject load() throws Exception {
        String encrypted = preferences.getString("session", "");
        if (encrypted.isEmpty()) return new JSONObject();
        String[] parts = encrypted.split(":", 2);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8));
    }

    void clear() {
        preferences.edit().remove("session").remove("roomId").remove("roomCode").remove("lastFix")
            .remove("lastUploadAt").remove("locationStatus").remove("roomQr").remove("roomSnapshot").remove("commentaryText")
            .remove("commentaryStatus").remove("commentaryState").remove("questionText").remove("questionCount")
            .remove("roomStatus").remove("translationWarning").remove("microphoneLevel").remove("questionPlaying")
            .putBoolean("commentaryActive", false).putBoolean("sharing", false).apply();
    }
}
