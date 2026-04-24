package io.zephyr.synth

object NativeBridge {
    init {
        System.loadLibrary("zephyr_jni")
    }

    external fun startEngine(): Boolean
    external fun stopEngine()
    external fun noteOn(note: Int, velocity: Int): Boolean
    external fun noteOff(note: Int): Boolean
    external fun setParameter(target: Int, value: Float): Boolean
}
