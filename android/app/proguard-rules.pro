# The page calls these by name through window.CodAndroid.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
