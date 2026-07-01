package io.zephyr.synth

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.SeekBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var statusText: TextView
    private lateinit var midiStatusText: TextView
    private lateinit var midiInputController: MidiInputController
    private lateinit var audioManager: AudioManager
    private var focusRequest: AudioFocusRequest? = null

    private var engineRunning = false
    private var resumeAfterFocusLoss = false

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (engineRunning) {
                    resumeAfterFocusLoss = true
                    stopEngine(abandonFocus = false)
                    statusText.text = getString(R.string.status_paused_focus)
                }
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (resumeAfterFocusLoss) {
                    resumeAfterFocusLoss = false
                    startEngine()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        audioManager = getSystemService(AudioManager::class.java)

        statusText = findViewById(R.id.statusText)
        midiStatusText = findViewById(R.id.midiStatusText)
        val startButton: Button = findViewById(R.id.startButton)
        val stopButton: Button = findViewById(R.id.stopButton)
        val refreshMidiButton: Button = findViewById(R.id.refreshMidiButton)
        val macroSeek: SeekBar = findViewById(R.id.macroSeek)
        val cutoffSeek: SeekBar = findViewById(R.id.cutoffSeek)

        midiInputController = MidiInputController(this) { status ->
            runOnUiThread {
                midiStatusText.text = status
            }
        }
        midiInputController.start()

        startButton.setOnClickListener { startEngine() }
        stopButton.setOnClickListener {
            resumeAfterFocusLoss = false
            stopEngine(abandonFocus = true)
        }
        refreshMidiButton.setOnClickListener { midiInputController.refresh() }

        macroSeek.progress = 0
        cutoffSeek.progress = 30

        macroSeek.setOnSeekBarChangeListener(simpleSeekListener { progress ->
            NativeBridge.setParameter(ParameterTargets.MACRO1_VALUE, progress / 100f)
        })

        cutoffSeek.setOnSeekBarChangeListener(simpleSeekListener { progress ->
            val hz = 80f + ((progress / 100f) * 8000f)
            NativeBridge.setParameter(ParameterTargets.FILTER_BASE_CUTOFF, hz)
        })

        // The instrument should be playable the moment it opens.
        startEngine()
    }

    override fun onDestroy() {
        midiInputController.stop()
        stopEngine(abandonFocus = true)
        super.onDestroy()
    }

    private fun startEngine() {
        if (engineRunning) return
        if (!requestAudioFocus()) {
            statusText.text = getString(R.string.status_focus_denied)
            return
        }
        val started = NativeBridge.startEngine()
        engineRunning = started
        statusText.text = getString(
            if (started) R.string.status_running else R.string.status_failed
        )
        if (!started) {
            abandonAudioFocus()
        }
    }

    private fun stopEngine(abandonFocus: Boolean) {
        NativeBridge.stopEngine()
        engineRunning = false
        if (abandonFocus) {
            abandonAudioFocus()
        }
        statusText.text = getString(R.string.status_stopped)
    }

    private fun requestAudioFocus(): Boolean {
        val request = focusRequest ?: AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setOnAudioFocusChangeListener(focusListener)
            .build()
            .also { focusRequest = it }
        return audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonAudioFocus() {
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    }

    private fun simpleSeekListener(onChanged: (Int) -> Unit): SeekBar.OnSeekBarChangeListener {
        return object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                onChanged(progress)
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        }
    }
}
