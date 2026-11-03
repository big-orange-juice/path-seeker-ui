package com.pathseeker.driver;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.TextView;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class LoginActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private SessionStore store;
    private EditText account;
    private EditText password;
    private CheckBox consent;
    private Button login;
    private TextView feedback;
    private boolean busy;
    private boolean alive = true;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        store = new SessionStore(this);
        if (store.loggedIn()) { enterTrip(); return; }
        setContentView(R.layout.activity_login);
        DriverUi.insets(this);
        account = findViewById(R.id.account);
        password = findViewById(R.id.password);
        consent = findViewById(R.id.consent);
        login = findViewById(R.id.login);
        feedback = findViewById(R.id.feedback);
        account.setText(store.preferences().getString("lastAccount", ""));
        consent.setChecked(store.preferences().getBoolean("mapPrivacyAccepted", false));
        findViewById(R.id.privacy).setOnClickListener(view -> DriverUi.privacy(this, store, () -> consent.setChecked(true)));
        findViewById(R.id.settings).setOnClickListener(view -> { if (!busy) DriverUi.settings(this, store, () -> showFeedback("连接配置已保存")); });
        login.setOnClickListener(view -> login());
        password.setOnEditorActionListener((view, action, event) -> {
            if (action == android.view.inputmethod.EditorInfo.IME_ACTION_DONE) { login(); return true; }
            return false;
        });
    }

    private void login() {
        if (busy) return;
        String identity = account.getText().toString().trim();
        String secret = password.getText().toString();
        if (identity.isEmpty() || secret.isEmpty()) { showFeedback("请输入账号和密码"); return; }
        if (!consent.isChecked()) { DriverUi.privacy(this, store, () -> { consent.setChecked(true); login(); }); return; }
        store.preferences().edit().putBoolean("privacyAccepted", true).putBoolean("mapPrivacyAccepted", true).apply();
        busy = true;
        login.setEnabled(false); login.setText(R.string.login_pending);
        feedback.setVisibility(View.GONE);
        worker.execute(() -> {
            try {
                DriverApi api = new DriverApi(store);
                api.login(identity, secret);
                if (!api.call("/TranslationRooms/host-permission", "GET", null).optBoolean("canHost")) {
                    store.clear(); throw new Exception("当前账号没有车夫权限，请联系管理员授权");
                }
                store.preferences().edit().putString("lastAccount", identity).apply();
                runOnUiThread(() -> { if (alive) { password.setText(""); enterTrip(); } });
            } catch (Exception failure) {
                store.clear();
                runOnUiThread(() -> {
                    if (!alive) return;
                    busy = false; login.setEnabled(true); login.setText(R.string.login_action);
                    showFeedback(failure.getMessage() == null ? "登录失败，请检查网络后重试" : failure.getMessage());
                });
            }
        });
    }

    private void showFeedback(String value) { feedback.setText(value); feedback.setVisibility(View.VISIBLE); }
    private void enterTrip() { startActivity(new Intent(this, MainActivity.class)); finish(); }
    @Override public void onDestroy() { alive = false; worker.shutdown(); super.onDestroy(); }
}
