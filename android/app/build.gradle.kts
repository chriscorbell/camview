import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Each release must carry a higher versionCode than the one installed, or the
// Desk display refuses the update. CI passes its run number; local builds are 1.
val releaseNumber = System.getenv("CAMVIEW_RELEASE")?.toInt() ?: 1

// The Relay's address. This repo is public, so it comes from the environment:
// the release workflow sets CAMVIEW_RELAY_URL from a repository secret. Builds
// without it get a placeholder that reaches nothing.
val relayUrl = System.getenv("CAMVIEW_RELAY_URL") ?: "http://relay.invalid:3147"
val debugRelayUrl = System.getenv("CAMVIEW_DEBUG_RELAY") ?: relayUrl

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
        buildConfigField("String", "RELAY_URL", "\"$relayUrl\"")
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
            buildConfigField("String", "RELAY_URL", "\"$debugRelayUrl\"")
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

// The Relay is plain HTTP on the LAN, so the network security config allows
// cleartext to its host alone; everything else stays HTTPS-only. It's generated
// because the host comes from the environment.
abstract class RelayNetworkSecurityConfig : DefaultTask() {
    @get:Input abstract val relayHost: Property<String>
    @get:OutputDirectory abstract val outputDir: DirectoryProperty

    @TaskAction
    fun write() {
        val file = outputDir.file("xml/network_security_config.xml").get().asFile
        file.parentFile.mkdirs()
        file.writeText(
            """
            |<?xml version="1.0" encoding="utf-8"?>
            |<network-security-config>
            |    <domain-config cleartextTrafficPermitted="true">
            |        <domain includeSubdomains="false">${relayHost.get()}</domain>
            |    </domain-config>
            |</network-security-config>
            |""".trimMargin()
        )
    }
}

androidComponents {
    onVariants { variant ->
        val url = if (variant.buildType == "debug") debugRelayUrl else relayUrl
        val task = tasks.register<RelayNetworkSecurityConfig>(
            "generate${variant.name.replaceFirstChar { it.uppercase() }}RelayNetworkSecurityConfig"
        ) {
            relayHost.set(URI(url).host)
        }
        variant.sources.res?.addGeneratedSourceDirectory(task, RelayNetworkSecurityConfig::outputDir)
    }
}
