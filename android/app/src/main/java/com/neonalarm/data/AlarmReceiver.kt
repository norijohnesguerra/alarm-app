package com.neonalarm.data

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.neonalarm.NeonAlarmApp
import com.neonalarm.R
import java.util.*

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getIntExtra("ALARM_ID", 0)
        val label = intent.getStringExtra("ALARM_LABEL") ?: "Alarm"
        val tagColor = intent.getStringExtra("TAG_COLOR")

        val notification = NotificationCompat.Builder(context, NeonAlarmApp.ALARM_CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Neon Alarm")
            .setContentText(label)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 500, 200, 500))
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(alarmId, notification)

        rescheduleDaily(context, alarmId, intent)
    }

    private fun rescheduleDaily(context: Context, alarmId: Int, originalIntent: Intent) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", originalIntent.getStringExtra("ALARM_LABEL"))
            putExtra("TAG_COLOR", originalIntent.getStringExtra("TAG_COLOR"))
            putExtra("DAYS_OF_WEEK", originalIntent.getStringExtra("DAYS_OF_WEEK"))
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, alarmId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val cal = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, originalIntent.getIntExtra("HOUR", 7))
            set(Calendar.MINUTE, originalIntent.getIntExtra("MINUTE", 0))
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pendingIntent)
    }
}
