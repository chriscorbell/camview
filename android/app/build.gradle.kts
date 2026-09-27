plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Each release must carry a higher versionCode than the one installed, or the
// Desk display refuses the update. CI passes its run number; local builds are 1.
val releaseNumber = System.getenv("CAMVIEW_RELEASE")?.toInt() ?: 1

android {
    namespace = "com.chriscorbell.camview"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.chriscorbell.camview"
        // Android 12 is the first that lets an app update itself without a tap.
        minSdk = 31
        targetSdk = 36
        versionCode = releaseNumber
        versionName = "$releaseNumber"
        buildConfigField("String", "RELAY_URL", "\"http://10.0.0.20:3147\"")
        buildConfigField("String", "RELEASES_URL", "\"https://api.github.com/repos/chriscorbell/camview/releases/latest\"")
    }
    buildFeatures {
        buildConfig = true
    }
    signingConfigs {
        // The release workflow supplies the release key through these variables.
        // Without them, release builds use the machine's debug key.
        System.getenv("CAMVIEW_ANDROID_KEYSTORE")?.let { keystore ->
            create("camviewRelease") {
                storeFile = file(keystore)
                storePassword = System.getenv("CAMVIEW_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("CAMVIEW_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("CAMVIEW_ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            // Installs beside the release app, so testing never breaks self-updates.
            applicationIdSuffix = ".debug"
            System.getenv("CAMVIEW_DEBUG_RELAY")?.let { buildConfigField("String", "RELAY_URL", "\"$it\"") }
        }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig =
                signingConfigs.findByName("camviewRelease") ?: signingConfigs.getByName("debug")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
