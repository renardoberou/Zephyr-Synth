plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "io.zephyr.synth"
  compileSdk = 35

  defaultConfig {
    applicationId = "io.zephyr.synth"
    minSdk = 28
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0-native"

    externalNativeBuild {
      cmake {
        cppFlags += listOf("-std=c++20")
      }
    }
  }

  buildFeatures {
    prefab = true
  }

  buildTypes {
    release {
      isMinifyEnabled = false
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  externalNativeBuild {
    cmake {
      path = file("src/main/cpp/CMakeLists.txt")
      version = "3.22.1"
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("com.google.oboe:oboe:1.10.0")
}
