package live.openbible.app;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final long MINIMUM_STARTUP_DURATION_MS = 1500L;

    private final Handler startupHandler = new Handler(Looper.getMainLooper());
    private long startupBeganAt;
    private View startupOverlay;
    private WebViewListener startupWebViewListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        startupBeganAt = SystemClock.elapsedRealtime();
        registerPlugin(OpenBibleMediaPlugin.class);
        super.onCreate(savedInstanceState);

        installStartupOverlay();
        observeInitialPageLoad();
    }

    private void installStartupOverlay() {
        ViewGroup content = findViewById(android.R.id.content);
        if (content == null) {
            return;
        }

        startupOverlay = LayoutInflater.from(this).inflate(R.layout.view_startup_overlay, content, false);
        content.addView(
            startupOverlay,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        getWindow().setStatusBarColor(Color.rgb(244, 245, 247));
        getWindow().setNavigationBarColor(Color.rgb(244, 245, 247));
    }

    private void observeInitialPageLoad() {
        if (bridge == null) {
            return;
        }

        WebView webView = bridge.getWebView();
        if (webView != null) {
            webView.setBackgroundColor(Color.rgb(244, 245, 247));
        }

        startupWebViewListener = new WebViewListener() {
            @Override
            public void onPageLoaded(WebView loadedWebView) {
                scheduleStartupOverlayRemoval();
            }
        };
        bridge.addWebViewListener(startupWebViewListener);

        if (webView != null && webView.getUrl() != null && webView.getProgress() == 100) {
            scheduleStartupOverlayRemoval();
        }
    }

    private void scheduleStartupOverlayRemoval() {
        if (startupOverlay == null) {
            return;
        }

        long elapsed = SystemClock.elapsedRealtime() - startupBeganAt;
        long remaining = Math.max(0L, MINIMUM_STARTUP_DURATION_MS - elapsed);
        startupHandler.removeCallbacksAndMessages(null);
        startupHandler.postDelayed(this::hideStartupOverlay, remaining);
    }

    private void hideStartupOverlay() {
        if (startupOverlay == null) {
            return;
        }

        ViewGroup parent = (ViewGroup) startupOverlay.getParent();
        if (parent != null) {
            parent.removeView(startupOverlay);
        }
        startupOverlay = null;

        if (bridge != null && startupWebViewListener != null) {
            bridge.removeWebViewListener(startupWebViewListener);
        }
        startupWebViewListener = null;
    }

    @Override
    public void onDestroy() {
        startupHandler.removeCallbacksAndMessages(null);
        if (bridge != null && startupWebViewListener != null) {
            bridge.removeWebViewListener(startupWebViewListener);
        }
        startupWebViewListener = null;
        startupOverlay = null;
        super.onDestroy();
    }
}
