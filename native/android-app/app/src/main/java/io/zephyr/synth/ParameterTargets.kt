package io.zephyr.synth

/**
 * Mirror of the C++ `zephyr::ParameterTarget` enum in
 * `native/include/zephyr/ParameterMessage.h`.
 *
 * The JNI bridge passes these as raw ints, so ordering here MUST match the
 * C++ declaration order exactly. If a target is added/removed on the C++
 * side, update this table in the same commit.
 */
object ParameterTargets {
    const val MASTER_GAIN = 0
    const val PITCH_BEND_RANGE = 1
    const val VOICE_MIX_1 = 2
    const val VOICE_MIX_2 = 3
    const val VOICE_MIX_3 = 4
    const val VOICE_DETUNE_1 = 5
    const val VOICE_DETUNE_2 = 6
    const val VOICE_DETUNE_3 = 7
    const val ATTACK = 8
    const val DECAY = 9
    const val SUSTAIN = 10
    const val RELEASE = 11
    const val FILTER_BASE_CUTOFF = 12
    const val FILTER_ENVELOPE_AMOUNT = 13
    const val FILTER_PRESSURE_AMOUNT = 14
    const val FILTER_TIMBRE_AMOUNT = 15
    const val FILTER2_BASE_CUTOFF = 16
    const val FILTER2_ENVELOPE_AMOUNT = 17
    const val FILTER2_PRESSURE_AMOUNT = 18
    const val FILTER2_TIMBRE_AMOUNT = 19
    const val FILTER_ROUTING_BLEND = 20
    const val FILTER_ROUTING_MODE = 21
    const val HIGHPASS_CUTOFF = 22
    const val LFO_RATE = 23
    const val LFO_PITCH_AMOUNT = 24
    const val LFO_FILTER_AMOUNT = 25
    const val MACRO1_VALUE = 26
    const val MACRO1_TO_CUTOFF = 27
    const val MACRO1_TO_DRIVE = 28
    const val DRIVE_AMOUNT = 29
}
