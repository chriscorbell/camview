package com.chriscorbell.camview

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.animation.PathInterpolator
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.window.OnBackInvokedDispatcher

/** The Desk display: the Feed, full screen, all day. */
class MainActivity : Activity(), FeedPlayer.Listener {
    private val ui = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("camview", Context.MODE_PRIVATE) }
    private val easeOut = PathInterpolator(0.2f, 0.8f, 0.2f, 1f)

    private lateinit var video: AspectFrame
    private lateinit var dim: View
    private lateinit var status: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var muteButton: ImageButton
    private lateinit var player: FeedPlayer
    private lateinit var updater: Updater
    private var wifiLock: WifiManager.WifiLock? = null
    private var state = FeedState.CONNECTING

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.setDecorFitsSystemWindows(false)

        player = FeedPlayer("${BuildConfig.RELAY_URL}$FEED_PATH", this)
        player.muted = !prefs.getBoolean(PREF_SOUND, false)
        updater = Updater(applicationContext)

        val surface = SurfaceView(this).apply {
            holder.addCallback(object : SurfaceHolder.Callback {
                override fun surfaceCreated(holder: SurfaceHolder) = player.attach(holder.surface)
                override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) = Unit
                override fun surfaceDestroyed(holder: SurfaceHolder) = player.detach()
            })
        }
        video = AspectFrame(this).apply { addView(surface, FrameLayout.LayoutParams(MATCH, MATCH)) }
        dim = View(this).apply {
            setBackgroundColor(Color.BLACK)
            alpha = 0f
        }
        statusText = TextView(this).apply {
            setTextColor(FOREGROUND)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            letterSpacing = 0.01f
        }
        val dot = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(FOREGROUND)
            }
            ObjectAnimator.ofFloat(this, View.ALPHA, 1f, 0.3f).apply {
                duration = 700
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
                start()
            }
        }
        status = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.pill)
            setPadding(dp(14), dp(9), dp(16), dp(9))
            addView(dot, LinearLayout.LayoutParams(dp(6), dp(6)).apply { marginEnd = dp(9) })
            addView(statusText)
            alpha = 0f
        }
        muteButton = ImageButton(this).apply {
            setBackgroundResource(R.drawable.round_button)
            scaleType = android.widget.ImageView.ScaleType.CENTER
            alpha = 0f
            isEnabled = false
            setOnClickListener { setSound(player.muted) }
        }

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(video, FrameLayout.LayoutParams(MATCH, MATCH, Gravity.CENTER))
            addView(dim, FrameLayout.LayoutParams(MATCH, MATCH))
            addView(status, FrameLayout.LayoutParams(WRAP, WRAP, Gravity.CENTER))
            addView(muteButton, FrameLayout.LayoutParams(dp(56), dp(56), Gravity.BOTTOM or Gravity.END).apply {
                setMargins(dp(24), dp(24), dp(24), dp(24))
            })
            setOnClickListener { wake() }
        }
        setContentView(root)
        renderMute()
        showState(FeedState.CONNECTING)

        // A home screen has nowhere to go back to.
        if (Build.VERSION.SDK_INT >= 33) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {}
        }
    }

    override fun onStart() {
        super.onStart()
        hideSystemBars()
        val wifi = applicationContext.getSystemService(WifiManager::class.java)
        wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "camview").apply { acquire() }
        player.start()
        updater.start()
    }

    override fun onStop() {
        updater.stop()
        player.stop()
        wifiLock?.release()
        wifiLock = null
        super.onStop()
    }

    override fun onDestroy() {
        player.release()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onState(state: FeedState) {
        ui.post { showState(state) }
    }

    override fun onVideoSize(width: Int, height: Int) {
        ui.post { video.setAspect(width, height) }
    }

    private fun showState(next: FeedState) {
        state = next
        val live = next == FeedState.LIVE
        if (!live) statusText.setText(if (next == FeedState.CONNECTING) R.string.connecting else R.string.reconnecting)
        // The label waits a beat, so quick blips never flash it.
        status.animate().cancel()
        status.animate().alpha(if (live) 0f else 1f).setStartDelay(if (live) 0 else 450)
            .setDuration(220).setInterpolator(easeOut).start()
        // While reconnecting, the last frame stays up, dimmed, so it never passes for live.
        dim.animate().cancel()
        dim.animate().alpha(if (next == FeedState.RECONNECTING) 0.6f else 0f)
            .setDuration(if (live) 500 else 0).setInterpolator(easeOut).start()
    }

    private fun setSound(on: Boolean) {
        prefs.edit().putBoolean(PREF_SOUND, on).apply()
        player.muted = !on
        renderMute()
        wake()
    }

    private fun renderMute() {
        muteButton.setImageResource(if (player.muted) R.drawable.ic_sound_off else R.drawable.ic_sound_on)
        muteButton.contentDescription = getString(if (player.muted) R.string.unmute else R.string.mute)
    }

    private val sleep = Runnable {
        muteButton.isEnabled = false
        muteButton.animate().alpha(0f).translationY(dp(6).toFloat()).setDuration(240).setInterpolator(easeOut).start()
    }

    /** Controls show on a tap and fade out when left alone. */
    private fun wake() {
        muteButton.isEnabled = true
        muteButton.animate().alpha(1f).translationY(0f).setDuration(160).setInterpolator(easeOut).start()
        ui.removeCallbacks(sleep)
        ui.postDelayed(sleep, 3000)
    }

    private fun hideSystemBars() {
        window.insetsController?.apply {
            hide(WindowInsets.Type.systemBars())
            systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    /** Letterboxes its child to the video's aspect ratio, centered. */
    private class AspectFrame(context: Context) : FrameLayout(context) {
        private var aspect = 16f / 9f

        fun setAspect(width: Int, height: Int) {
            if (width <= 0 || height <= 0) return
            aspect = width.toFloat() / height
            requestLayout()
        }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val width = MeasureSpec.getSize(widthMeasureSpec)
            val height = MeasureSpec.getSize(heightMeasureSpec)
            val (w, h) = if (width / aspect <= height) width to (width / aspect).toInt() else (height * aspect).toInt() to height
            super.onMeasure(MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY))
        }
    }

    private companion object {
        const val FEED_PATH = "/api/stream.mp4?src=desk"
        const val PREF_SOUND = "sound"
        const val MATCH = FrameLayout.LayoutParams.MATCH_PARENT
        const val WRAP = FrameLayout.LayoutParams.WRAP_CONTENT
        val FOREGROUND = Color.argb(235, 255, 255, 255)
    }
}
