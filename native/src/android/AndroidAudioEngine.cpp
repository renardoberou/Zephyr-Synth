#include "zephyr/AndroidAudioEngine.h"

#include "zephyr/MidiTranslator.h"
#include "zephyr/ParameterMessage.h"
#include "zephyr/ZephyrEngine.h"

#include <algorithm>
#include <memory>
#include <vector>

#include <oboe/Oboe.h>

namespace zephyr {

class AndroidAudioEngine::Impl : public oboe::AudioStreamDataCallback {
public:
  Impl() = default;

  bool start() {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output);
    builder.setPerformanceMode(oboe::PerformanceMode::LowLatency);
    builder.setSharingMode(oboe::SharingMode::Exclusive);
    builder.setFormat(oboe::AudioFormat::Float);
    builder.setChannelCount(2);
    builder.setSampleRate(48000);
    builder.setDataCallback(this);

    auto result = builder.openManagedStream(stream_);
    if (result != oboe::Result::OK || !stream_) {
      return false;
    }

    engine_.prepare(static_cast<double>(stream_->getSampleRate()), static_cast<std::uint32_t>(stream_->getFramesPerBurst() * 4));
    return stream_->requestStart() == oboe::Result::OK;
  }

  void stop() {
    if (stream_) {
      stream_->requestStop();
      stream_->close();
      stream_.reset();
    }
  }

  bool handleMidiMessage(const std::uint8_t* data, std::size_t size) {
    MidiEvent event {};
    if (!translator_.translate(data, size, 0, frameCounter_, event)) {
      return false;
    }
    return engine_.pushMidiEvent(event);
  }

  bool pushParameterMessage(const ParameterMessage& message) {
    return engine_.pushParameterMessage(message);
  }

  oboe::DataCallbackResult onAudioReady(oboe::AudioStream* /*audioStream*/, void* audioData, int32_t numFrames) override {
    auto* output = static_cast<float*>(audioData);
    if (!output) {
      return oboe::DataCallbackResult::Continue;
    }

    scratchLeft_.resize(static_cast<std::size_t>(numFrames));
    scratchRight_.resize(static_cast<std::size_t>(numFrames));
    engine_.render(scratchLeft_.data(), scratchRight_.data(), static_cast<std::uint32_t>(numFrames));

    for (int32_t i = 0; i < numFrames; ++i) {
      output[(i * 2) + 0] = scratchLeft_[static_cast<std::size_t>(i)];
      output[(i * 2) + 1] = scratchRight_[static_cast<std::size_t>(i)];
    }

    frameCounter_ += static_cast<std::uint64_t>(numFrames);
    return oboe::DataCallbackResult::Continue;
  }

private:
  ZephyrEngine engine_ {};
  MidiTranslator translator_ {};
  std::shared_ptr<oboe::AudioStream> stream_ {};
  std::vector<float> scratchLeft_ {};
  std::vector<float> scratchRight_ {};
  std::uint64_t frameCounter_ { 0 };
};

AndroidAudioEngine::AndroidAudioEngine() : impl_(std::make_unique<Impl>()) {}
AndroidAudioEngine::~AndroidAudioEngine() = default;

bool AndroidAudioEngine::start() {
  return impl_ && impl_->start();
}

void AndroidAudioEngine::stop() {
  if (impl_) impl_->stop();
}

bool AndroidAudioEngine::handleMidiMessage(const std::uint8_t* data, std::size_t size) {
  return impl_ && impl_->handleMidiMessage(data, size);
}

bool AndroidAudioEngine::pushParameterMessage(const ParameterMessage& message) {
  return impl_ && impl_->pushParameterMessage(message);
}

} // namespace zephyr
