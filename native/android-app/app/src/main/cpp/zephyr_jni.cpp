#include <jni.h>

#include <cstdint>
#include <memory>
#include <mutex>
#include <vector>

#include "zephyr/AndroidAudioEngine.h"
#include "zephyr/ParameterMessage.h"

namespace {
std::mutex gMutex;
std::unique_ptr<zephyr::AndroidAudioEngine> gEngine;

zephyr::AndroidAudioEngine& ensureEngine() {
  if (!gEngine) {
    gEngine = std::make_unique<zephyr::AndroidAudioEngine>();
  }
  return *gEngine;
}

bool sendMidiBytes(const std::uint8_t* bytes, std::size_t size) {
  std::lock_guard<std::mutex> lock(gMutex);
  return ensureEngine().handleMidiMessage(bytes, size);
}

bool sendMidi(const std::vector<std::uint8_t>& bytes) {
  return sendMidiBytes(bytes.data(), bytes.size());
}
} // namespace

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zephyr_synth_NativeBridge_startEngine(JNIEnv*, jobject) {
  std::lock_guard<std::mutex> lock(gMutex);
  return ensureEngine().start() ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT void JNICALL
Java_io_zephyr_synth_NativeBridge_stopEngine(JNIEnv*, jobject) {
  std::lock_guard<std::mutex> lock(gMutex);
  if (gEngine) {
    gEngine->stop();
  }
}

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zephyr_synth_NativeBridge_noteOn(JNIEnv*, jobject, jint note, jint velocity) {
  return sendMidi({ static_cast<std::uint8_t>(0x90), static_cast<std::uint8_t>(note & 0x7F), static_cast<std::uint8_t>(velocity & 0x7F) }) ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zephyr_synth_NativeBridge_noteOff(JNIEnv*, jobject, jint note) {
  return sendMidi({ static_cast<std::uint8_t>(0x80), static_cast<std::uint8_t>(note & 0x7F), static_cast<std::uint8_t>(0) }) ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zephyr_synth_NativeBridge_sendMidi(JNIEnv* env, jobject, jbyteArray bytes, jint count) {
  if (!bytes) {
    return JNI_FALSE;
  }

  const jsize available = env->GetArrayLength(bytes);
  const jsize safeCount = count < available ? count : available;
  if (safeCount <= 0) {
    return JNI_FALSE;
  }

  std::vector<std::uint8_t> buffer(static_cast<std::size_t>(safeCount));
  env->GetByteArrayRegion(bytes, 0, safeCount, reinterpret_cast<jbyte*>(buffer.data()));
  return sendMidiBytes(buffer.data(), buffer.size()) ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_io_zephyr_synth_NativeBridge_setParameter(JNIEnv*, jobject, jint target, jfloat value) {
  std::lock_guard<std::mutex> lock(gMutex);
  zephyr::ParameterMessage message {};
  message.target = static_cast<zephyr::ParameterTarget>(target);
  message.value = value;
  return ensureEngine().pushParameterMessage(message) ? JNI_TRUE : JNI_FALSE;
}
