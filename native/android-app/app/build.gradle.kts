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

  externalNativeBuild {
    cmake {
      path = file("src/main/cpp/CMakeLists.txt")
      version = "3.22.1"
    }
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  implementation("androidx.core:core-ktx:1.17.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("com.google.android.material:material:1.13.0")
  implementation("com.google.oboe:oboe:1.10.0")
}
