package live.openbible.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;

@CapacitorPlugin(
    name = "OpenBibleMedia",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class OpenBibleMediaPlugin extends Plugin {
    private static WeakReference<OpenBibleMediaPlugin> currentPlugin = new WeakReference<>(null);

    @Override
    public void load() {
        currentPlugin = new WeakReference<>(this);
    }

    @Override
    protected void handleOnDestroy() {
        if (currentPlugin.get() == this) currentPlugin.clear();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent intent = new Intent(getContext(), OpenBibleMediaService.class);
        intent.setAction(OpenBibleMediaService.ACTION_UPDATE);
        intent.putExtra(OpenBibleMediaService.EXTRA_TITLE, call.getString("title", "OpenBible"));
        intent.putExtra(OpenBibleMediaService.EXTRA_TEXT, call.getString("text", "语音圣经"));
        intent.putExtra(OpenBibleMediaService.EXTRA_ALBUM, call.getString("album", "OpenBible · 语音圣经"));
        intent.putExtra(OpenBibleMediaService.EXTRA_PLAYING, call.getBoolean("playing", false));
        intent.putExtra(OpenBibleMediaService.EXTRA_DURATION, call.getLong("durationMs", 0L));
        intent.putExtra(OpenBibleMediaService.EXTRA_POSITION, call.getLong("positionMs", 0L));
        intent.putExtra(OpenBibleMediaService.EXTRA_SPEED, call.getDouble("speed", 1.0));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), OpenBibleMediaService.class);
        intent.setAction(OpenBibleMediaService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    static void dispatchControl(String action, long positionMs) {
        OpenBibleMediaPlugin plugin = currentPlugin.get();
        if (plugin == null || plugin.getActivity() == null) return;
        plugin.getActivity().runOnUiThread(() -> {
            JSObject event = new JSObject();
            event.put("action", action);
            if (positionMs >= 0) event.put("positionMs", positionMs);
            plugin.notifyListeners("control", event);
        });
    }
}
