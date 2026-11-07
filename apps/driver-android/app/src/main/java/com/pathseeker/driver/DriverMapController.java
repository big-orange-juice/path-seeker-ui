package com.pathseeker.driver;

import android.app.Activity;
import android.os.Bundle;
import android.widget.FrameLayout;
import com.amap.api.maps.AMap;
import com.amap.api.maps.CameraUpdateFactory;
import com.amap.api.maps.MapView;
import com.amap.api.maps.MapsInitializer;
import com.amap.api.maps.model.BitmapDescriptorFactory;
import com.amap.api.maps.model.Circle;
import com.amap.api.maps.model.CircleOptions;
import com.amap.api.maps.model.LatLng;
import com.amap.api.maps.model.Marker;
import com.amap.api.maps.model.MarkerOptions;
import com.amap.api.maps.model.CameraPosition;
import com.amap.api.maps.model.BitmapDescriptor;
import org.json.JSONObject;

final class DriverMapController {
    private final MapView view;
    private final AMap map;
    private Marker marker;
    private Circle accuracy;
    private LatLng latest;
    private boolean follow = true;
    private final BitmapDescriptor arrow;
    private final int accent;

    DriverMapController(Activity activity, FrameLayout host, SessionStore store, Bundle saved) throws Exception {
        MapsInitializer.updatePrivacyShow(activity, true, true);
        MapsInitializer.updatePrivacyAgree(activity, true);
        MapsInitializer.setApiKey(store.preferences().getString("amapKey", BuildConfig.AMAP_KEY));
        accent = activity.getColor(R.color.driver_teal);
        view = new MapView(activity);
        host.addView(view, new FrameLayout.LayoutParams(-1, -1));
        view.onCreate(saved);
        map = view.getMap();
        map.getUiSettings().setZoomControlsEnabled(false);
        map.getUiSettings().setScaleControlsEnabled(true);
        map.getUiSettings().setCompassEnabled(true);
        map.getUiSettings().setLogoBottomMargin(DriverUi.dp(activity, 12));
        map.getUiSettings().setLogoLeftMargin(DriverUi.dp(activity, 12));
        arrow = arrow(activity);
        map.moveCamera(CameraUpdateFactory.newCameraPosition(new CameraPosition(new LatLng(39.94, 116.38), 16, 45, 0)));
        host.post(() -> map.setPointToCenter(host.getWidth() / 2, Math.round(host.getHeight() * 0.53f)));
        map.setOnMapTouchListener(event -> { if (event.getActionMasked() == android.view.MotionEvent.ACTION_DOWN) follow = false; });
    }

    void update(JSONObject fix) {
        if (fix == null) return;
        LatLng position = new LatLng(fix.optDouble("latitude"), fix.optDouble("longitude"));
        if (latest != null && latest.equals(position)) {
            if (accuracy != null) accuracy.setRadius(fix.optDouble("accuracy", 10));
            return;
        }
        boolean first = latest == null;
        latest = position;
        if (marker == null) {
            marker = map.addMarker(new MarkerOptions().position(position).title("车夫当前位置")
                .icon(arrow).anchor(0.5f, 0.5f));
            accuracy = map.addCircle(new CircleOptions().center(position).radius(fix.optDouble("accuracy", 10))
                .fillColor((accent & 0x00FFFFFF) | 0x16000000).strokeColor((accent & 0x00FFFFFF) | 0x77000000).strokeWidth(1));
        } else {
            marker.setPosition(position); accuracy.setCenter(position); accuracy.setRadius(fix.optDouble("accuracy", 10));
        }
        if (follow || first) map.animateCamera(CameraUpdateFactory.newCameraPosition(new CameraPosition(position, first ? 17 : map.getCameraPosition().zoom, 45, map.getCameraPosition().bearing)));
    }

    void recenter() { follow = true; if (latest != null) map.animateCamera(CameraUpdateFactory.newCameraPosition(new CameraPosition(latest, 17, 45, 0))); }
    private static BitmapDescriptor arrow(Activity activity) {
        int size = DriverUi.dp(activity, 48);
        android.graphics.Bitmap bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
        canvas.scale(size / 48f, size / 48f);
        android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        paint.setColor(android.graphics.Color.WHITE); canvas.drawCircle(24, 24, 23, paint);
        android.graphics.Path path = new android.graphics.Path();
        path.moveTo(24, 7); path.lineTo(39, 37); path.lineTo(24, 30); path.lineTo(9, 37); path.close();
        paint.setColor(activity.getColor(R.color.driver_teal)); canvas.drawPath(path, paint);
        return BitmapDescriptorFactory.fromBitmap(bitmap);
    }
    void clear() {
        if (marker != null) { marker.remove(); marker = null; }
        if (accuracy != null) { accuracy.remove(); accuracy = null; }
        latest = null; follow = true;
    }
    void resume() { view.onResume(); }
    void pause() { view.onPause(); }
    void save(Bundle state) { view.onSaveInstanceState(state); }
    void destroy() { view.onDestroy(); arrow.recycle(); }
}
