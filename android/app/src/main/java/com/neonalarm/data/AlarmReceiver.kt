package com.neonalarm.data

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.neonalarm.AlarmAlertActivity
import com.neonalarm.NeonAlarmApp
import com.neonalarm.R
import java.util.*

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getIntExtra("ALARM_ID", 0)
        val label = intent.getStringExtra("ALARM_LABEL") ?: "Alarm"
        val tagColor = intent.getStringExtra("TAG_COLOR")
        val time = intent.getStringExtra("ALARM_TIME")

        // Bring up the full-screen alert (plays the alarm sound + vibration).
        val alertIntent = Intent(context, AlarmAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", label)
            putExtra("TAG_COLOR", tagColor)
            putExtra("ALARM_TIME", time)
        }
        val fullScreen = PendingIntent.getActivity(
            context, alarmId, alertIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, NeonAlarmApp.ALARM_CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(label)
            .setContentText("Tap to dismiss or snooze")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(fullScreen)
            .setFullScreenIntent(fullScreen, true)
            .setVibrate(longArrayOf(0, 800, 400, 800, 400))
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(alarmId, notification)

        try {
            context.startActivity(alertIntent)
        } catch (_: Exception) {}

        // Snooze/test fires carry IS_SNOOZE/IS_TEST and must not touch the daily schedule.
        if (intent.getBooleanExtra("IS_SNOOZE", false) || intent.getBooleanExtra("IS_TEST", false)) return
        rescheduleDaily(context, alarmId, intent)
    }

    private fun rescheduleDaily(context: Context, alarmId: Int, originalIntent: Intent) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", originalIntent.getStringExtra("ALARM_LABEL"))
            putExtra("TAG_COLOR", originalIntent.getStringExtra("TAG_COLOR"))
            putExtra("ALARM_TIME", originalIntent.getStringExtra("ALARM_TIME"))
            putExtra("DAYS_OF_WEEK", originalIntent.getStringExtra("DAYS_OF_WEEK"))
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, alarmId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val next = nextAlarmTime(
            originalIntent.getIntExtra("HOUR", 7),
            originalIntent.getIntExtra("MINUTE", 0),
            originalIntent.getStringExtra("DAYS_OF_WEEK")
        )
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pendingIntent)
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pendingIntent)
            }
        } catch (_: SecurityException) {
            try { alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pendingIntent) } catch (_: Exception) {}
        }
    }

    // Next occurrence whose weekday is in the alarm's days_of_week (0=Sun..6=Sat).
    private fun nextAlarmTime(hour: Int, minute: Int, daysOfWeek: String?): Long {
        val dowSet = (daysOfWeek ?: "0,1,2,3,4,5,6")
            .split(",").mapNotNull { it.trim().toIntOrNull() }.toSet()
        var cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        for (i in 0..7) {
            val dow = (cal.get(Calendar.DAY_OF_WEEK) - 1 + 7) % 7
            if (dowSet.contains(dow)) {
                if (cal.timeInMillis > System.currentTimeMillis()) return cal.timeInMillis
            }
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }
}
