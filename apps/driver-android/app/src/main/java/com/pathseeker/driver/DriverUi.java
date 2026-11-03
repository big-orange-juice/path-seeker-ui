package com.pathseeker.driver;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.net.URI;

final class DriverUi {
    static int dp(Activity activity, int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }

    static void insets(Activity activity) {
        View root = activity.findViewById(R.id.root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        root.requestApplyInsets();
    }

    static void privacy(Activity activity, SessionStore store, Runnable accepted) {
        new AlertDialog.Builder(activity).setTitle(R.string.privacy_title).setMessage(R.string.privacy_message)
            .setNegativeButton("暂不开启", null).setPositiveButton("同意并继续", (dialog, which) -> {
                store.preferences().edit().putBoolean("privacyAccepted", true).putBoolean("mapPrivacyAccepted", true).apply();
                accepted.run();
            }).show();
    }

    static void settings(Activity activity, SessionStore store, Runnable saved) {
        if (store.preferences().getBoolean("sharing", false) || !store.preferences().getString("roomId", "").isEmpty()) {
            Toast.makeText(activity, "请先结束当前房间再修改连接配置", Toast.LENGTH_LONG).show(); return;
        }
        LinearLayout form = new LinearLayout(activity);
        form.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(activity, 22);
        form.setPadding(padding, padding / 2, padding, padding / 2);
        TextView serverLabel = new TextView(activity);
        serverLabel.setText("后台地址"); form.addView(serverLabel);
        EditText server = new EditText(activity);
        server.setSingleLine(true); server.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        server.setText(store.apiBase()); server.setTextSize(14); form.addView(server);
        TextView keyLabel = new TextView(activity);
        keyLabel.setText(R.string.amap_key_label); form.addView(keyLabel);
        EditText key = new EditText(activity);
        key.setSingleLine(true); key.setText(store.preferences().getString("amapKey", BuildConfig.AMAP_KEY)); key.setTextSize(14); form.addView(key);
        TextView error = new TextView(activity);
        error.setTextColor(activity.getColor(R.color.driver_error)); form.addView(error);
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle(R.string.connection_settings).setView(form)
            .setNegativeButton("取消", null).setPositiveButton("保存", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            try {
                String base = server.getText().toString().trim().replaceAll("/+$", "");
                URI uri = URI.create(base);
                if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null || !uri.getPath().endsWith("/api"))
                    throw new Exception("请输入以 /api 结尾的 HTTPS 后台地址");
                if (!base.equals(store.apiBase())) store.clear();
                store.preferences().edit().putString("apiBase", base).putString("amapKey", key.getText().toString().trim()).apply();
                dialog.dismiss(); saved.run();
            } catch (Exception failure) { error.setText(failure.getMessage()); }
        }));
        dialog.show();
    }

    static void openLogin(Activity activity) {
        activity.startActivity(new Intent(activity, LoginActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
        activity.finish();
    }
}
