package com.neonalarm

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

class NeonAlarmApp : Application() {
    companion object {
        const val ALARM_CHANNEL = "alarm_channel"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            ALARM_CHANNEL,
            "Alarms",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Alarm notifications"
            enableVibration(true)
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }
}
