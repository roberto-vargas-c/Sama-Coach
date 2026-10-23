package app.sama.coach;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Sama for Android: a full-screen WebView around the deployed web app, with what the page needs from
 * the phone: the camera for live alignment checks, the photo/clip pickers, keep-awake and immersive
 * mode during a guided practice, and a shortcut to the cast settings. The page talks to it through
 * window.SamaNative (keepAwake, immersive, openCastSettings).
 */
public class MainActivity extends AppCompatActivity {
    private static final int REQ_CAMERA = 1, REQ_FILE = 2, REQ_LOCATION = 3;
    private WebView web;
    private TextView offline;
    private PermissionRequest pendingPermission;
    private GeolocationPermissions.Callback pendingGeo;
    private String pendingGeoOrigin;
    private ValueCallback<Uri[]> fileCallback;
    private Uri captureUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        offline = new TextView(this);
        offline.setText(R.string.offline);
        offline.setGravity(android.view.Gravity.CENTER);
        offline.setPadding(64, 64, 64, 64);
        offline.setTextSize(16);
        offline.setVisibility(View.GONE);
        offline.setOnClickListener(v -> { offline.setVisibility(View.GONE); web.loadUrl(BuildConfig.SAMA_URL); });
        root.addView(offline, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web, true); // the Firebase auth handler lives on firebaseapp.com
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Google's sign-in page refuses embedded WebViews; presenting as plain mobile Chrome lets the Firebase redirect flow through
        s.setUserAgentString(s.getUserAgentString().replace("; wv", "").replaceAll("Version/\\d+\\.\\d+ ", "") + " SamaApp/1.0");
        web.addJavascriptInterface(new SamaNative(), "SamaNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u.getHost() != null && BuildConfig.SAMA_URL.contains(u.getHost())) return false;   // stay inside the app
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) {}
                return true;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) offline.setVisibility(View.VISIBLE);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                // the page asks for the camera (getUserMedia); grant it once the app itself has the permission
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(request.getResources());
                } else {
                    pendingPermission = request;
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                }
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                // "Studios near you" asks for the position (navigator.geolocation); only the app's own site gets it
                boolean ours = origin != null && Uri.parse(origin).getHost() != null && BuildConfig.SAMA_URL.contains(Uri.parse(origin).getHost().replaceFirst("^www\\.", ""));
                if (!ours) { cb.invoke(origin, false, false); return; }
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) { cb.invoke(origin, true, false); return; }
                pendingGeo = cb; pendingGeoOrigin = origin;
                ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                String acc = String.join(",", params.getAcceptTypes());
                boolean hasImg = acc.contains("image"), hasVid = acc.contains("video");
                boolean image = hasImg && !hasVid, video = hasVid && !hasImg, any = !image && !video;
                List<Intent> extras = new ArrayList<>();
                try {
                    File dir = new File(getCacheDir(), "captures"); dir.mkdirs();
                    if (image || any) {
                        File f = File.createTempFile("photo", ".jpg", dir);
                        Uri u = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f);
                        Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, u);
                        if (params.isCaptureEnabled() && image) { captureUri = u; startActivityForResult(cam, REQ_FILE); return true; }
                        extras.add(cam); captureUri = u;
                    }
                    if (video || any) {
                        Intent vid = new Intent(MediaStore.ACTION_VIDEO_CAPTURE).putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1);
                        if (params.isCaptureEnabled() && video) { captureUri = null; startActivityForResult(vid, REQ_FILE); return true; }
                        extras.add(vid);
                    }
                } catch (IOException ignored) {}
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType(image ? "image/*" : video ? "video/*" : "*/*");
                if (any) pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
                Intent chooser = Intent.createChooser(pick, params.getTitle() != null ? params.getTitle() : "Choose");
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extras.toArray(new Intent[0]));
                try { startActivityForResult(chooser, REQ_FILE); } catch (ActivityNotFoundException e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        if (savedInstanceState != null) web.restoreState(savedInstanceState); else if (!handleLink(getIntent())) web.loadUrl(BuildConfig.SAMA_URL);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack(); else { setEnabled(false); getOnBackPressedDispatcher().onBackPressed(); }
            }
        });
    }

    @Override protected void onSaveInstanceState(@NonNull Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleLink(intent); }

    /** Links that come back into the app: the Google sign-in result from Chrome (samacoach://auth), and email sign-in links to the site. */
    private boolean handleLink(Intent intent) {
        Uri u = intent == null ? null : intent.getData();
        if (u == null) return false;
        if ("samacoach".equals(u.getScheme()) && "auth".equals(u.getHost())) {
            String js = "window.samaNativeAuth && window.samaNativeAuth(" + JSONObject.quote(nz(u.getQueryParameter("id_token"))) + "," + JSONObject.quote(nz(u.getQueryParameter("access_token"))) + ")";
            if (web.getUrl() == null) { web.loadUrl(BuildConfig.SAMA_URL); web.postDelayed(() -> web.evaluateJavascript(js, null), 2500); }
            else web.evaluateJavascript(js, null);
            return true;
        }
        if ("https".equals(u.getScheme()) && u.getHost() != null && BuildConfig.SAMA_URL.contains(u.getHost())) { web.loadUrl(u.toString()); return true; }
        return false;
    }
    private static String nz(String v) { return v == null ? "" : v; }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    @Override public void onRequestPermissionsResult(int code, @NonNull String[] perms, @NonNull int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_CAMERA && pendingPermission != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingPermission.grant(pendingPermission.getResources()); else pendingPermission.deny();
            pendingPermission = null;
        }
        if (code == REQ_LOCATION && pendingGeo != null) {
            pendingGeo.invoke(pendingGeoOrigin, results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED, false);
            pendingGeo = null; pendingGeoOrigin = null;
        }
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != REQ_FILE || fileCallback == null) return;
        Uri[] out = null;
        if (result == RESULT_OK) {
            if (data != null && data.getData() != null) out = new Uri[]{data.getData()};
            else if (captureUri != null) out = new Uri[]{captureUri};
        }
        fileCallback.onReceiveValue(out); fileCallback = null; captureUri = null;
    }

    /** window.SamaNative, called from the page. */
    private class SamaNative {
        /** Open a page in the phone's browser (Google sign-in refuses app web views). */
        @JavascriptInterface public void openAuth(String url) {
            runOnUiThread(() -> { try { if (url != null && url.startsWith("https://")) startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (ActivityNotFoundException ignored) {} });
        }
        @JavascriptInterface public void keepAwake(boolean on) {
            runOnUiThread(() -> { if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        }
        @JavascriptInterface public void immersive(boolean on) {
            runOnUiThread(() -> {
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                if (on) { c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); c.hide(WindowInsetsCompat.Type.systemBars()); }
                else c.show(WindowInsetsCompat.Type.systemBars());
            });
        }
        @JavascriptInterface public boolean openCastSettings() {
            try { Intent i = new Intent(Settings.ACTION_CAST_SETTINGS); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); return true; }
            catch (ActivityNotFoundException e) { return false; }
        }
        @JavascriptInterface public void openUrl(String url) {
            // sign-in pages that refuse embedded WebViews (Google) open in the system browser
            try { if (url != null && url.startsWith("https://")) startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (ActivityNotFoundException ignored) {}
        }
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME + " (" + Build.VERSION.SDK_INT + ")"; }
    }
}
