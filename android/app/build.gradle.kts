import java.util.Properties

plugins {
    id("com.android.application")
}

fun props(file: File) = Properties().apply { if (file.exists()) file.inputStream().use { load(it) } }

val version = props(rootProject.file("version.properties"))
// Release signing key, kept outside the repo (see android/README.md). Without it only the debug
// build can be made - which is fine for sideloading onto test devices.
val signingDir = File(System.getProperty("user.home"), ".cod-android")
val signing = props(File(signingDir, "keystore.properties"))

android {
    namespace = "io.github.sparkmike77.codcharacter"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.sparkmike77.codcharacter"
        minSdk = 29
        targetSdk = 36
        versionCode = version.getProperty("versionCode").toInt()
        versionName = version.getProperty("versionName")
    }

    signingConfigs {
        create("release") {
            if (signing.isNotEmpty()) {
                storeFile = File(signingDir, signing.getProperty("storeFile"))
                storePassword = signing.getProperty("password")
                keyAlias = signing.getProperty("keyAlias")
                keyPassword = signing.getProperty("password")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (signing.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    // The web page's .glb avatar models are already compressed.
    androidResources {
        noCompress += listOf("glb")
    }
}
