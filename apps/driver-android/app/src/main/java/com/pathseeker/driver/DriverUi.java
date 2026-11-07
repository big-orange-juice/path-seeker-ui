package com.pathseeker.driver;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.widget.EditText;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ScrollView;
import android.view.ViewGroup;
import java.net.URI;

final class DriverUi {
    static int dp(Activity activity, int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }

    static Button dialogAction(Activity activity, int text, boolean destructive) {
        Button button = new Button(new android.view.ContextThemeWrapper(activity, R.style.DriverTheme), null, 0, R.style.DriverTextButton);
        button.setText(text);
        button.setBackgroundResource(destructive ? R.drawable.bg_danger : R.drawable.bg_soft);
        button.setTextColor(activity.getColorStateList(destructive ? R.color.driver_destructive_text : R.color.driver_action_text));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(activity, 48));
        params.topMargin = dp(activity, 12);
        button.setLayoutParams(params);
        return button;
    }

    static void insets(Activity activity) {
        activity.getWindow().getDecorView().setSystemUiVisibility(
            activity.getWindow().getDecorView().getSystemUiVisibility()
                | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
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
        show(new AlertDialog.Builder(activity).setTitle(R.string.privacy_title).setMessage(R.string.privacy_message)
            .setNegativeButton("暂不开启", null).setPositiveButton("同意并继续", (dialog, which) -> {
                store.preferences().edit().putBoolean("privacyAccepted", true).putBoolean("mapPrivacyAccepted", true).apply();
                accepted.run();
            }).create());
    }

    static ScrollView scroll(Activity activity, View content) {
        ScrollView scroll = new ScrollView(activity);
        scroll.setClipToPadding(false);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(content);
        return scroll;
    }

    static AlertDialog show(AlertDialog dialog) {
        dialog.show();
        android.content.Context context = dialog.getContext();
        float density = context.getResources().getDisplayMetrics().density;
        int screen = context.getResources().getDisplayMetrics().widthPixels;
        if (dialog.getWindow() != null) dialog.getWindow().setLayout(
            Math.min(screen - Math.round(32 * density), Math.round(480 * density)), ViewGroup.LayoutParams.WRAP_CONTENT);
        TextView message = dialog.findViewById(android.R.id.message);
        if (message != null) { message.setTextSize(14); message.setLineSpacing(4 * density, 1); }
        return dialog;
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
        server.setText(store.apiBase()); server.setTextSize(14);
        LinearLayout.LayoutParams field = new LinearLayout.LayoutParams(-1, dp(activity, 54));
        field.topMargin = dp(activity, 8); form.addView(server, field);
        TextView keyLabel = new TextView(activity);
        keyLabel.setText(R.string.amap_key_label);
        LinearLayout.LayoutParams label = new LinearLayout.LayoutParams(-1, -2);
        label.topMargin = dp(activity, 20); form.addView(keyLabel, label);
        EditText key = new EditText(activity);
        key.setSingleLine(true); key.setText(store.preferences().getString("amapKey", BuildConfig.AMAP_KEY)); key.setTextSize(14);
        form.addView(key, new LinearLayout.LayoutParams(field));
        TextView error = new TextView(activity);
        error.setTextColor(activity.getColor(R.color.driver_error)); form.addView(error);
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle(R.string.connection_settings).setView(scroll(activity, form))
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
        show(dialog);
    }

    static void openLogin(Activity activity) {
        activity.startActivity(new Intent(activity, LoginActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
        activity.finish();
    }
}
