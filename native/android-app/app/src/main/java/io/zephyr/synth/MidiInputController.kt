package io.zephyr.synth

import android.content.Context
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiManager
import android.media.midi.MidiOutputPort
import android.media.midi.MidiReceiver
import android.os.Handler
import android.os.Looper

class MidiInputController(
    context: Context,
    private val onStatusChanged: (String) -> Unit
) {
    private val appContext = context.applicationContext
    private val midiManager: MidiManager? = appContext.getSystemService(MidiManager::class.java)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val connections = mutableListOf<DeviceConnection>()
    private var started = false

    private val deviceCallback = object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
            refresh()
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
            refresh()
        }

        override fun onDeviceStatusChanged(status: MidiDeviceStatus) {
            refresh()
        }
    }

    fun start() {
        if (started) return
        started = true
        val manager = midiManager
        if (manager == null) {
            onStatusChanged("MIDI unavailable")
            return
        }
        manager.registerDeviceCallback(deviceCallback, mainHandler)
        refresh()
    }

    fun stop() {
        if (!started) return
        started = false
        midiManager?.unregisterDeviceCallback(deviceCallback)
        closeConnections()
        onStatusChanged("MIDI disconnected")
    }

    fun refresh() {
        val manager = midiManager
        if (manager == null) {
            onStatusChanged("MIDI unavailable")
            return
        }

        closeConnections()
        val devices = manager.devices ?: emptyArray()
        if (devices.isEmpty()) {
            onStatusChanged("No MIDI devices")
            return
        }

        devices.forEach { info ->
            attachDevice(manager, info)
        }

        updateStatus()
    }

    private fun attachDevice(manager: MidiManager, info: MidiDeviceInfo) {
        if (info.outputPortCount <= 0) return

        manager.openDevice(info, { device ->
            if (device == null) {
                updateStatus()
                return@openDevice
            }

            val ports = mutableListOf<MidiOutputPort>()
            for (portIndex in 0 until info.outputPortCount) {
                val outputPort = device.openOutputPort(portIndex) ?: continue
                outputPort.connect(createReceiver())
                ports += outputPort
            }

            if (ports.isEmpty()) {
                device.close()
            } else {
                connections += DeviceConnection(device, ports, deviceName(info))
            }
            updateStatus()
        }, mainHandler)
    }

    private fun createReceiver(): MidiReceiver {
        return object : MidiReceiver() {
            override fun onSend(data: ByteArray, offset: Int, count: Int, timestamp: Long) {
                if (count <= 0 || offset < 0 || offset + count > data.size) return
                val bytes = data.copyOfRange(offset, offset + count)
                NativeBridge.sendMidi(bytes, bytes.size)
            }
        }
    }

    private fun updateStatus() {
        if (connections.isEmpty()) {
            onStatusChanged("No MIDI input connected")
            return
        }
        val names = connections.joinToString { it.name }
        onStatusChanged("MIDI ready: $names")
    }

    private fun closeConnections() {
        connections.forEach { connection ->
            connection.outputPorts.forEach { port ->
                try {
                    port.close()
                } catch (_: Exception) {
                }
            }
            try {
                connection.device.close()
            } catch (_: Exception) {
            }
        }
        connections.clear()
    }

    private fun deviceName(info: MidiDeviceInfo): String {
        val props = info.properties
        return props.getString(MidiDeviceInfo.PROPERTY_NAME)
            ?: props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER)
            ?: "MIDI device ${info.id}"
    }

    private data class DeviceConnection(
        val device: MidiDevice,
        val outputPorts: List<MidiOutputPort>,
        val name: String
    )
}
