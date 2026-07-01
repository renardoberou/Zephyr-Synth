package io.zephyr.synth

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View

/**
 * Multitouch performance keyboard.
 *
 * Two octaves (C3..C5). Each pointer is tracked independently and can glide
 * across keys (note-off on the key it leaves, note-on on the key it enters).
 * Vertical position inside a key maps to velocity. Notes are reference
 * counted so two fingers on the same key release cleanly.
 *
 * All sound goes through [NativeBridge]; this view is a pure control surface.
 */
class ZephyrKeyboardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private companion object {
        const val FIRST_NOTE = 48 // C3
        const val KEY_COUNT = 25  // ..C5 inclusive
        const val NO_NOTE = -1
        val WHITE_SEMITONES = intArrayOf(0, 2, 4, 5, 7, 9, 11)
    }

    private data class Key(val note: Int, val rect: RectF, val isBlack: Boolean)

    private val whiteKeys = mutableListOf<Key>()
    private val blackKeys = mutableListOf<Key>()

    /** pointerId -> note currently held by that pointer (or NO_NOTE). */
    private val pointerNotes = HashMap<Int, Int>()

    /** note -> number of pointers holding it. */
    private val holdCounts = HashMap<Int, Int>()

    private val whitePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#1A1512")
    }
    private val blackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#060404")
    }
    private val activePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#E8A33D")
    }
    private val edgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f
        color = Color.parseColor("#402A15")
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        color = Color.parseColor("#8A5A2B")
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        rebuildKeys(w.toFloat(), h.toFloat())
    }

    private fun rebuildKeys(w: Float, h: Float) {
        whiteKeys.clear()
        blackKeys.clear()
        if (w <= 0f || h <= 0f) return

        val whiteNotes = (0 until KEY_COUNT)
            .map { FIRST_NOTE + it }
            .filter { (it % 12) in WHITE_SEMITONES }
        val whiteWidth = w / whiteNotes.size

        whiteNotes.forEachIndexed { index, note ->
            val left = index * whiteWidth
            whiteKeys += Key(note, RectF(left + 1f, 0f, left + whiteWidth - 1f, h - 2f), isBlack = false)
        }

        val blackWidth = whiteWidth * 0.62f
        val blackHeight = h * 0.58f
        for (i in 0 until KEY_COUNT) {
            val note = FIRST_NOTE + i
            if ((note % 12) in intArrayOf(1, 3, 6, 8, 10)) {
                // Centered on the boundary to the right of the white key below it.
                val whiteIndexLeft = whiteKeys.indexOfLast { it.note < note }
                val centerX = (whiteIndexLeft + 1) * whiteWidth
                blackKeys += Key(
                    note,
                    RectF(centerX - blackWidth / 2f, 0f, centerX + blackWidth / 2f, blackHeight),
                    isBlack = true
                )
            }
        }

        labelPaint.textSize = (whiteWidth * 0.32f).coerceIn(14f, 30f)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val corner = 8f
        for (key in whiteKeys) {
            val paint = if (isHeld(key.note)) activePaint else whitePaint
            canvas.drawRoundRect(key.rect, corner, corner, paint)
            canvas.drawRoundRect(key.rect, corner, corner, edgePaint)
            if (key.note % 12 == 0) {
                canvas.drawText(
                    "C${key.note / 12 - 1}",
                    key.rect.centerX(),
                    key.rect.bottom - labelPaint.textSize * 0.6f,
                    labelPaint
                )
            }
        }
        for (key in blackKeys) {
            val paint = if (isHeld(key.note)) activePaint else blackPaint
            canvas.drawRoundRect(key.rect, corner, corner, paint)
            canvas.drawRoundRect(key.rect, corner, corner, edgePaint)
        }
    }

    private fun isHeld(note: Int): Boolean = (holdCounts[note] ?: 0) > 0

    private fun hitTest(x: Float, y: Float): Key? {
        // Black keys sit on top, so test them first.
        blackKeys.firstOrNull { it.rect.contains(x, y) }?.let { return it }
        return whiteKeys.firstOrNull { it.rect.contains(x, y) }
    }

    private fun velocityFor(key: Key, y: Float): Int {
        val rel = ((y - key.rect.top) / key.rect.height()).coerceIn(0f, 1f)
        return (64 + rel * 63f).toInt().coerceIn(1, 127)
    }

    private fun pressNote(note: Int, velocity: Int) {
        val count = holdCounts[note] ?: 0
        holdCounts[note] = count + 1
        if (count == 0) {
            NativeBridge.noteOn(note, velocity)
            performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        }
    }

    private fun releaseNote(note: Int) {
        if (note == NO_NOTE) return
        val count = holdCounts[note] ?: 0
        if (count <= 1) {
            holdCounts.remove(note)
            NativeBridge.noteOff(note)
        } else {
            holdCounts[note] = count - 1
        }
    }

    private fun pointerDown(pointerId: Int, x: Float, y: Float) {
        val key = hitTest(x, y)
        if (key != null) {
            pointerNotes[pointerId] = key.note
            pressNote(key.note, velocityFor(key, y))
        } else {
            pointerNotes[pointerId] = NO_NOTE
        }
    }

    private fun pointerMove(pointerId: Int, x: Float, y: Float) {
        val previous = pointerNotes[pointerId] ?: return
        val key = hitTest(x, y)
        val next = key?.note ?: NO_NOTE
        if (next == previous) return
        releaseNote(previous)
        pointerNotes[pointerId] = next
        if (key != null) {
            pressNote(key.note, velocityFor(key, y))
        }
    }

    private fun pointerUp(pointerId: Int) {
        val note = pointerNotes.remove(pointerId) ?: return
        releaseNote(note)
    }

    private fun releaseAll() {
        for ((_, note) in pointerNotes) {
            releaseNote(note)
        }
        pointerNotes.clear()
        holdCounts.keys.toList().forEach { note ->
            holdCounts.remove(note)
            NativeBridge.noteOff(note)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                pointerDown(event.getPointerId(0), event.getX(0), event.getY(0))
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                val index = event.actionIndex
                pointerDown(event.getPointerId(index), event.getX(index), event.getY(index))
            }
            MotionEvent.ACTION_MOVE -> {
                for (index in 0 until event.pointerCount) {
                    pointerMove(event.getPointerId(index), event.getX(index), event.getY(index))
                }
            }
            MotionEvent.ACTION_POINTER_UP -> {
                pointerUp(event.getPointerId(event.actionIndex))
            }
            MotionEvent.ACTION_UP -> {
                pointerUp(event.getPointerId(0))
                performClick()
            }
            MotionEvent.ACTION_CANCEL -> {
                releaseAll()
            }
            else -> return super.onTouchEvent(event)
        }
        invalidate()
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    override fun onDetachedFromWindow() {
        releaseAll()
        super.onDetachedFromWindow()
    }
}
