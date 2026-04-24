plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "io.zephyr.synth"
  compileSdk = 36

  defaultConfig {
    applicationId = "io.zephyr.synth"
    minSdk = 28
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0-native"
  }
}

dependencies {
  implementation("com.google.oboe:oboe:1.10.0")
}
