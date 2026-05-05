package com.securechat.app;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private long lastRequestTime = 0;
    private String lastUrl = "";
    private static final long THROTTLE_MS = 1500; // 1.5 seconds

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        this.bridge.getWebView().setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                
                if (scheme != null && (scheme.equals("metamask") || scheme.equals("wc"))) {
                    long currentTime = System.currentTimeMillis();
                    String currentUrl = uri.toString();
                    
                    // Only throttle if it's the EXACT SAME URL within the window
                    // This allows a connection request followed by a signature request to both pass
                    if (!currentUrl.equals(lastUrl) || (currentTime - lastRequestTime > THROTTLE_MS)) {
                        lastRequestTime = currentTime;
                        lastUrl = currentUrl;
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                    }
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
