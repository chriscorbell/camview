package com.chriscorbell.camview

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Process
import android.os.SystemClock

/**
 * Brings the Feed back after anything that kills this app. Android only
 * starts a home screen when none is running, and the tablet's stock launcher
 * always is, so after an update or a crash it would take over the screen.
 * The default home app may start activities from the background.
 */
object StayInFront {
    private var installed = false

    fun install(context: Context) {
        if (installed) return
        installed = true
        val app = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            val relaunch = PendingIntent.getActivity(app, 0, feed(app), PendingIntent.FLAG_IMMUTABLE)
            app.getSystemService(AlarmManager::class.java)
                .set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 1000, relaunch)
            previous?.uncaughtException(thread, error) ?: Process.killProcess(Process.myPid())
        }
    }

    fun feed(context: Context) =
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /** Reopens the Feed right after a self-update replaces this app. */
    class AfterUpdate : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) context.startActivity(feed(context))
        }
    }
}
