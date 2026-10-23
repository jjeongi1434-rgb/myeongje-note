package kr.myeongje.board;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** 명제 탐구 노트 교사 보드를 전자칠판 전체화면으로 띄우는 앱. */
public class MainActivity extends Activity {

    /** 교사 보드(전자칠판 모드) 주소 */
    private static final String TAG = "MyeongjeBoard";
    private static final String BOARD_URL =
            "https://jjeongi1434-rgb.github.io/myeongje-note/index.html?board=mj2026";
    /** 보드 주소와 같은 폴더인지 판단하기 위한 기준 (폰트·외부 스크립트 오류와 구분) */
    private static final String BOARD_ORIGIN = BOARD_URL.substring(0, BOARD_URL.lastIndexOf('/') + 1);
    /** 오류 화면의 "다시 시도" 버튼이 쓰는 내부 주소 */
    private static final String RETRY_URL = "myeongje://retry";

    private WebView web;
    private FrameLayout root;
    private WebChromeClient chrome;
    private boolean boardShown = false;   // 보드 본문이 한 번이라도 떴는가
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1d2433"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1d2433"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " MyeongjeBoardApp/1.0");
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (RETRY_URL.equals(url)) { v.loadUrl(BOARD_URL); return true; }
                return false;
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return shouldOverrideUrlLoading(v, req.getUrl().toString());
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                if (isBoardPage(url)) boardShown = true;
                Log.i(TAG, "loaded: " + url + " title=" + v.getTitle());
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                Log.i(TAG, "error: " + (req != null ? req.getUrl() : null) + " main="
                        + (req != null && req.isForMainFrame()));
                if (req != null && !req.isForMainFrame()) return;
                showOffline();
            }
            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView v, int code, String desc, String url) {
                if (isBoardPage(url)) showOffline();
            }
            @Override
            public void onReceivedSslError(WebView v, SslErrorHandler handler, SslError err) {
                handler.cancel();   // 안전하지 않은 연결은 진행하지 않는다
                Log.i(TAG, "ssl error: " + (err != null ? err.getUrl() : null) + " shown=" + boardShown);
                // 보드가 이미 떠 있으면 글꼴 같은 외부 자료 오류이므로 화면을 바꾸지 않는다
                if (boardShown) return;
                showError("보안 연결에 실패했어요",
                        "학교 인터넷의 보안 필터(SSL 검사) 때문일 수 있어요.<br>"
                        + "같은 주소가 크롬에서는 열린다면, 전자칠판에 학교 보안 인증서를 설치하거나<br>"
                        + "크롬에서 <b>board.html</b> 주소를 열어 사용해 주세요.");
            }
        });

        chrome = new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                if (customView != null) { cb.onCustomViewHidden(); return; }
                customView = view;
                customCallback = cb;
                root.addView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }
            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                root.removeView(customView);
                customView = null;
                web.setVisibility(View.VISIBLE);
                if (customCallback != null) { customCallback.onCustomViewHidden(); customCallback = null; }
            }
        };
        web.setWebChromeClient(chrome);

        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        web.loadUrl(BOARD_URL);
    }

    /** 이 주소가 보드 본문(같은 폴더)인가? */
    private boolean isBoardPage(String url) {
        return url != null && url.startsWith(BOARD_ORIGIN);
    }

    /** 인터넷이 끊겼을 때 보여 주는 안내 화면 */
    private void showOffline() {
        showError("인터넷에 연결되지 않았어요",
                "전자칠판의 Wi-Fi나 랜선 연결을 확인한 뒤<br>아래 버튼을 눌러 주세요.");
    }

    /** 오류 안내 화면 */
    private void showError(String title, String body) {
        String html = "<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#1d2433;"
                + "color:#fff;font-family:sans-serif;text-align:center;padding:24px}"
                + "h1{font-size:26px;margin:0 0 10px}p{color:#aab3c6;font-size:17px;line-height:1.6}"
                + "a{display:inline-block;margin-top:18px;background:#7c8ee8;color:#141a26;text-decoration:none;"
                + "border-radius:12px;padding:14px 24px;font-size:18px;font-weight:700}</style></head><body><div>"
                + "<h1>" + title + "</h1>"
                + "<p>" + body + "</p>"
                + "<a href='" + RETRY_URL + "'>다시 시도</a></div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    /** 상태바·내비게이션바를 숨긴 전체화면 유지 */
    @SuppressWarnings("deprecation")
    private void goImmersive() {
        root.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) goImmersive();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (customView != null) { chrome.onHideCustomView(); return true; }
            if (web.canGoBack()) { web.goBack(); return true; }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        goImmersive();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
