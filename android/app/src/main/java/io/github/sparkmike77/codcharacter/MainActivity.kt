package io.github.sparkmike77.codcharacter

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.util.Log
import android.view.WindowInsets
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * The player app (src/index.html and friends, copied into assets/www by scripts/build-android.js) in
 * a WebView, plus the native parts a page can't do for itself. The page reaches those through
 * window.CodAndroid; android/web/android-main.js wraps them into the same window.codApi the
 * Electron app's preload provides, so the sheet's own code runs unchanged.
 *
 * Every bridge call is asynchronous: the page passes an id, and the result comes back through
 * window.__codAndroid.resolve(id, json). Unprompted events (a GMScreen found or lost) arrive through
 * window.__codAndroid.emit(name, json).
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var discovery: GmDiscovery
    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newCachedThreadPool()

    /** A file picker the page is waiting on: which call, and (for Save As) what to write. */
    private class PendingDocument(val id: String, val content: String?)
    private var pendingDocument: PendingDocument? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // chrome://inspect on the computer the phone is plugged into, for debug builds.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        discovery = GmDiscovery(this) { event, data -> emit(event, data) }

        web = WebView(this).apply {
            setBackgroundColor(getColor(R.color.background))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true // the page keeps its chronicles and GM pairings in localStorage
                allowFileAccess = false
                allowContentAccess = false
                textZoom = 100
                // The page sets its own viewport (the device's width, android-main.js) and has a
                // phone layout; pinch zoom stays available on top of that.
                useWideViewPort = true
                builtInZoomControls = true
                displayZoomControls = false
            }
            addJavascriptInterface(Bridge(), "CodAndroid")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    if (request.url.host != APP_HOST) return null
                    return serveAsset(request.url.path ?: "/")
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.host == APP_HOST) return false
                    openExternally(request.url) // a link out of the app goes to the browser
                    return true
                }
            }
            // Debug builds copy the page's console to logcat (tag CodPage), errors from the very
            // first load included - before chrome://inspect can attach.
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    if (BuildConfig.DEBUG) {
                        Log.d("CodPage", "${message.messageLevel()} ${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                    }
                    return true
                }
            }
        }
        // Android 15+ draws apps edge to edge; keep the page clear of the status / navigation bars,
        // the camera cutout, and the on-screen keyboard. The padding goes on a container: a WebView
        // draws its page ignoring its own padding.
        val root = FrameLayout(this).apply {
            setBackgroundColor(getColor(R.color.ink))
            addView(web)
        }
        root.setOnApplyWindowInsetsListener { view, insets ->
            val bars = insets.getInsets(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime(),
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsets.CONSUMED
        }
        setContentView(root)

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl("https://$APP_HOST/index.html")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        discovery.stop()
        io.shutdownNow()
        web.destroy()
        super.onDestroy()
    }

    // ── Serving the page ──────────────────────────────────────────────────────────────────────

    /**
     * The page is served from https://APP_HOST/ (out of assets/www) rather than file://, because ES
     * modules, the import map and fetch() of the avatar models all need a real origin, and a secure
     * one at that (crypto.randomUUID). The host is the one Android reserves for exactly this.
     */
    private fun serveAsset(path: String): WebResourceResponse {
        val relative = path.trimStart('/').ifEmpty { "index.html" }
        if (relative.contains("..")) return notFound()
        val type = mimeType(relative)
        return try {
            val stream = assets.open("www/$relative")
            WebResourceResponse(type, if (type.startsWith("text/") || type.endsWith("javascript") || type.endsWith("json")) "utf-8" else null, stream)
        } catch (e: FileNotFoundException) {
            notFound()
        }
    }

    private fun notFound() =
        WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    private fun mimeType(path: String) = when (path.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "glb" -> "model/gltf-binary"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "svg" -> "image/svg+xml"
        "woff2" -> "font/woff2"
        "md", "txt" -> "text/plain"
        else -> "application/octet-stream"
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            // nothing on the device handles it
        }
    }

    // ── Talking to the page ───────────────────────────────────────────────────────────────────

    private fun resolve(id: String, result: JSONObject) =
        runJs("window.__codAndroid && window.__codAndroid.resolve(${JSONObject.quote(id)}, ${JSONObject.quote(result.toString())})")

    private fun emit(event: String, data: JSONObject) =
        runJs("window.__codAndroid && window.__codAndroid.emit(${JSONObject.quote(event)}, ${JSONObject.quote(data.toString())})")

    private fun runJs(script: String) {
        main.post { web.evaluateJavascript(script, null) }
    }

    private fun error(message: String?) = JSONObject().put("error", message ?: "Unknown error")

    /** Back closes whatever popup is open in the page; with none open it leaves the app. */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("window.__codAndroid ? window.__codAndroid.back() : false") { handled ->
            @Suppress("DEPRECATION")
            if (handled != "true") super.onBackPressed()
        }
    }

    /** window.CodAndroid. Called on a WebView thread, so anything touching views posts to main. */
    inner class Bridge {
        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun call(id: String, method: String, argsJson: String) {
            val args = try { JSONObject(argsJson) } catch (e: Exception) { JSONObject() }
            when (method) {
                "http" -> io.execute { resolve(id, http(args)) }
                "openDocument" -> main.post { openDocument(id) }
                "createDocument" -> main.post { createDocument(id, args) }
                "writeDocument" -> io.execute { resolve(id, writeDocument(args)) }
                "startDiscovery" -> main.post { discovery.start(); resolve(id, JSONObject()) }
                "stopDiscovery" -> main.post { discovery.stop(); resolve(id, JSONObject()) }
                else -> resolve(id, error("Unknown method $method"))
            }
        }
    }

    // ── GMScreen requests ─────────────────────────────────────────────────────────────────────

    /**
     * One HTTP request to a GMScreen. Done natively rather than with fetch() from the page: the page's
     * origin is https, so plain-http calls to the GM's computer would be blocked as mixed content,
     * and GMScreen doesn't send CORS headers. Returns {status, body} or {status: 0, error}.
     */
    private fun http(args: JSONObject): JSONObject {
        val host = args.optString("host")
        val port = args.optInt("port")
        val path = args.optString("path", "/")
        val timeout = args.optInt("timeoutMs", 5000)
        return try {
            val connection = URL("http", host, port, path).openConnection() as HttpURLConnection
            connection.connectTimeout = timeout
            connection.readTimeout = timeout
            connection.requestMethod = args.optString("method", "GET")
            val headers = args.optJSONObject("headers") ?: JSONObject()
            headers.keys().forEach { name ->
                if (!name.equals("Content-Length", ignoreCase = true)) connection.setRequestProperty(name, headers.getString(name))
            }
            val body = if (args.isNull("body")) null else args.optString("body")
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status >= 400) connection.errorStream else connection.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            connection.disconnect()
            JSONObject().put("status", status).put("body", text)
        } catch (e: Exception) {
            JSONObject().put("status", 0).put("error", e.message ?: e.javaClass.simpleName)
        }
    }

    // ── Character / markdown files (Android's document picker; works on ChromeOS too) ─────────

    private fun openDocument(id: String) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*" // .codchar and .md have no registered type, so filter by nothing
        }
        startPicker(id, null, intent, REQUEST_OPEN)
    }

    private fun createDocument(id: String, args: JSONObject) {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            // Not application/json: some providers would then append .json to "Name.codchar".
            type = "application/octet-stream"
            putExtra(Intent.EXTRA_TITLE, args.optString("name", "character.codchar"))
        }
        startPicker(id, args.optString("content"), intent, REQUEST_CREATE)
    }

    private fun startPicker(id: String, content: String?, intent: Intent, request: Int) {
        pendingDocument?.let { resolve(it.id, JSONObject().put("canceled", true)) }
        pendingDocument = PendingDocument(id, content)
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, request)
        } catch (e: ActivityNotFoundException) {
            pendingDocument = null
            resolve(id, error("No file picker is available on this device."))
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        val pending = pendingDocument ?: return
        pendingDocument = null
        val uri = data?.data
        if (resultCode != RESULT_OK || uri == null) {
            resolve(pending.id, JSONObject().put("canceled", true))
            return
        }
        // Keep access across restarts, so Save can write back to the same file later.
        try {
            contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
            )
        } catch (e: SecurityException) {
            // some providers only grant read; Save then falls back to Save As
        }
        io.execute {
            val result = try {
                if (requestCode == REQUEST_CREATE) {
                    write(uri, pending.content ?: "")
                    JSONObject().put("uri", uri.toString()).put("name", displayName(uri))
                } else {
                    val text = contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
                        ?: throw FileNotFoundException("Couldn't read that file.")
                    JSONObject().put("uri", uri.toString()).put("name", displayName(uri)).put("content", text)
                }
            } catch (e: Exception) {
                error(e.message)
            }
            resolve(pending.id, result)
        }
    }

    private fun writeDocument(args: JSONObject): JSONObject = try {
        val uri = Uri.parse(args.getString("uri"))
        write(uri, args.optString("content"))
        JSONObject().put("uri", uri.toString()).put("name", displayName(uri))
    } catch (e: Exception) {
        error(e.message)
    }

    private fun write(uri: Uri, content: String) {
        val stream = contentResolver.openOutputStream(uri, "wt") ?: throw FileNotFoundException("Couldn't write that file.")
        stream.use { it.write(content.toByteArray(Charsets.UTF_8)) }
    }

    private fun displayName(uri: Uri): String {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0)?.let { return it }
        }
        return uri.lastPathSegment ?: "file"
    }

    companion object {
        /** Android's reserved host for serving an app's own content to its WebView. */
        const val APP_HOST = "appassets.androidplatform.net"
        private const val REQUEST_OPEN = 1
        private const val REQUEST_CREATE = 2
    }
}
