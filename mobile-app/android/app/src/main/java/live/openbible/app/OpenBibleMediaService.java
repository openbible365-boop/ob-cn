package live.openbible.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;

public class OpenBibleMediaService extends Service {
    static final String ACTION_UPDATE = "live.openbible.app.media.UPDATE";
    static final String ACTION_STOP = "live.openbible.app.media.STOP";
    private static final String ACTION_CONTROL = "live.openbible.app.media.CONTROL";
    private static final String EXTRA_CONTROL = "control";

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final String EXTRA_ALBUM = "album";
    static final String EXTRA_PLAYING = "playing";
    static final String EXTRA_DURATION = "duration";
    static final String EXTRA_POSITION = "position";
    static final String EXTRA_SPEED = "speed";

    private static final String CHANNEL_ID = "openbible_audio";
    private static final int NOTIFICATION_ID = 2107;

    private MediaSession mediaSession;
    private NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;
    private String title = "OpenBible";
    private String text = "语音圣经";
    private String album = "OpenBible · 语音圣经";
    private boolean playing = false;
    private long durationMs = 0;
    private long positionMs = 0;
    private float speed = 1f;
    private String scrollingVerse = "";
    private long verseScrollStartedAt = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = getSystemService(NotificationManager.class);
        createNotificationChannel();
        mediaSession = new MediaSession(this, "OpenBibleAudio");
        PowerManager powerManager = getSystemService(PowerManager.class);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OpenBible:AudioPlayback");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { sendControl("play", -1); }
            @Override public void onPause() { sendControl("pause", -1); }
            @Override public void onStop() { sendControl("stop", -1); }
            @Override public void onSeekTo(long pos) { sendControl("seekTo", pos); }
            @Override public void onRewind() { sendControl("seekBackward", -1); }
            @Override public void onFastForward() { sendControl("seekForward", -1); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopMediaSession();
            return START_NOT_STICKY;
        }
        if (ACTION_CONTROL.equals(action)) {
            handleControl(intent.getStringExtra(EXTRA_CONTROL));
            return START_STICKY;
        }
        if (ACTION_UPDATE.equals(action)) {
            title = intent.getStringExtra(EXTRA_TITLE);
            String nextText = intent.getStringExtra(EXTRA_TEXT);
            if (nextText == null) nextText = "";
            if (!nextText.equals(scrollingVerse)) {
                scrollingVerse = nextText;
                verseScrollStartedAt = SystemClock.elapsedRealtime();
            }
            text = nextText;
            album = intent.getStringExtra(EXTRA_ALBUM);
            playing = intent.getBooleanExtra(EXTRA_PLAYING, false);
            durationMs = Math.max(0, intent.getLongExtra(EXTRA_DURATION, 0));
            positionMs = Math.max(0, intent.getLongExtra(EXTRA_POSITION, 0));
            speed = (float) intent.getDoubleExtra(EXTRA_SPEED, 1.0);
            updateSession();
            updateWakeLock();
            startForeground(NOTIFICATION_ID, buildNotification());
        }
        return START_STICKY;
    }

    private void handleControl(String control) {
        if ("play".equals(control)) mediaSession.getController().getTransportControls().play();
        else if ("pause".equals(control)) mediaSession.getController().getTransportControls().pause();
        else if ("rewind".equals(control)) mediaSession.getController().getTransportControls().rewind();
        else if ("forward".equals(control)) mediaSession.getController().getTransportControls().fastForward();
    }

    private void sendControl(String action, long seekPositionMs) {
        OpenBibleMediaPlugin.dispatchControl(action, seekPositionMs);
    }

    private void updateSession() {
        String visibleVerse = scrollingVerseText();
        Bitmap artwork = createPlainArtwork();
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, visibleVerse)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, visibleVerse)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs)
            .putBitmap(MediaMetadata.METADATA_KEY_ART, artwork);
        mediaSession.setMetadata(metadata.build());

        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SEEK_TO
            | PlaybackState.ACTION_REWIND
            | PlaybackState.ACTION_FAST_FORWARD
            | PlaybackState.ACTION_STOP;
        int state = playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        mediaSession.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, positionMs, playing ? speed : 0f, SystemClock.elapsedRealtime())
            .build());
        mediaSession.setActive(true);
    }

    private void updateWakeLock() {
        if (wakeLock == null) return;
        if (playing && !wakeLock.isHeld()) wakeLock.acquire();
        else if (!playing && wakeLock.isHeld()) wakeLock.release();
    }

    private Notification buildNotification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        String visibleVerse = scrollingVerseText();
        Bitmap artwork = createPlainArtwork();
        int playPauseIcon = playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseControl = playing ? "pause" : "play";

        return builder
            .setSmallIcon(R.drawable.ic_stat_openbible)
            .setLargeIcon(artwork)
            .setContentTitle(title)
            .setContentText(visibleVerse)
            .setSubText(album)
            .setColor(Color.rgb(255, 215, 105))
            .setColorized(true)
            .setContentIntent(openAppIntent())
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_rew, "后退30秒", controlIntent("rewind", 11)).build())
            .addAction(new Notification.Action.Builder(playPauseIcon, playing ? "暂停" : "播放", controlIntent(playPauseControl, 12)).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_ff, "前进30秒", controlIntent("forward", 13)).build())
            .setStyle(new Notification.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .build();
    }

    private Bitmap createPlainArtwork() {
        Bitmap artwork = Bitmap.createBitmap(8, 8, Bitmap.Config.ARGB_8888);
        artwork.eraseColor(Color.rgb(255, 215, 105));
        return artwork;
    }

    private String scrollingVerseText() {
        String value = text == null ? "" : text.trim();
        final int windowSize = 25;
        if (value.length() <= windowSize) return value;

        String spacer = "　　　";
        String loop = value + spacer;
        long elapsed = Math.max(0, SystemClock.elapsedRealtime() - verseScrollStartedAt);
        int offset = (int) ((elapsed / 900L) % loop.length());
        String doubled = loop + loop;
        return doubled.substring(offset, offset + windowSize);
    }

    private PendingIntent openAppIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 10, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent controlIntent(String control, int requestCode) {
        Intent intent = new Intent(this, OpenBibleMediaService.class);
        intent.setAction(ACTION_CONTROL);
        intent.putExtra(EXTRA_CONTROL, control);
        return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "语音圣经播放",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("在锁屏和通知中心显示语音圣经播放控制");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setSound(null, null);
        notificationManager.createNotificationChannel(channel);
    }

    private void stopMediaSession() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
