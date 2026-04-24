package io.zephyr.synth

import android.os.Bundle
import android.view.MotionEvent
import android.widget.Button
import android.widget.SeekBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        val startButton: Button = findViewById(R.id.startButton)
        val stopButton: Button = findViewById(R.id.stopButton)
        val macroSeek: SeekBar = findViewById(R.id.macroSeek)
        val cutoffSeek: SeekBar = findViewById(R.id.cutoffSeek)

        startButton.setOnClickListener {
            val started = NativeBridge.startEngine()
            statusText.text = if (started) "Engine running" else "Engine failed to start"
        }

        stopButton.setOnClickListener {
            NativeBridge.stopEngine()
            statusText.text = "Engine stopped"
        }

        macroSeek.progress = 0
        cutoffSeek.progress = 30

        macroSeek.setOnSeekBarChangeListener(simpleSeekListener { progress ->
            NativeBridge.setParameter(ParameterTargets.MACRO1_VALUE, progress / 100f)
        })

        cutoffSeek.setOnSeekBarChangeListener(simpleSeekListener { progress ->
            val hz = 80f + ((progress / 100f) * 8000f)
            NativeBridge.setParameter(ParameterTargets.FILTER_BASE_CUTOFF, hz)
        })

        bindPad(findViewById(R.id.noteCButton), 60)
        bindPad(findViewById(R.id.noteEButton), 64)
        bindPad(findViewById(R.id.noteGButton), 67)
    }

    override fun onDestroy() {
        NativeBridge.stopEngine()
        super.onDestroy()
    }

    private fun bindPad(button: Button, note: Int) {
        button.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> NativeBridge.noteOn(note, 110)
                MotionEvent.ACTION_UP,
                MotionEvent.ACTION_CANCEL -> NativeBridge.noteOff(note)
            }
            false
        }
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
