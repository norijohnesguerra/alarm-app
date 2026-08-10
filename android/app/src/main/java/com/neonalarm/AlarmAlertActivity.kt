package com.neonalarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.neonalarm.data.AlarmReceiver
import java.util.*

class AlarmAlertActivity : ComponentActivity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val alarmId = intent.getIntExtra("ALARM_ID", 0)
        val label = intent.getStringExtra("ALARM_LABEL") ?: "Alarm"
        val tagColor = intent.getStringExtra("TAG_COLOR") ?: "#00e5ff"
        val time = intent.getStringExtra("ALARM_TIME") ?: ""

        startAlarmSound()
        startVibration()

        setContent {
            MaterialTheme {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF0A0A0F))
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "NEON ALARM",
                            fontSize = 14.sp,
                            letterSpacing = 4.sp,
                            fontFamily = FontFamily.Monospace,
                            color = Color(0xFF00e5ff)
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        if (time.isNotEmpty()) {
                            Text(
                                text = time,
                                fontSize = 56.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = label,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = Color(0xFF00e5ff)
                        )
                        Spacer(modifier = Modifier.height(64.dp))
                        Button(
                            onClick = { snooze(alarmId, label, tagColor, time) },
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF00e5ff).copy(alpha = 0.2f),
                                contentColor = Color(0xFF00e5ff)
                            )
                        ) {
                            Text("SNOOZE 10 MIN", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { dismiss() },
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFFF4081).copy(alpha = 0.2f),
                                contentColor = Color(0xFFFF4081)
                            )
                        ) {
                            Text("DISMISS", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                        }
                        Spacer(modifier = Modifier.height(20.dp))
                        Text(
                            text = tagColor,
                            color = Color(0xFF666680),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }
    }

    private fun startAlarmSound() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            mediaPlayer = MediaPlayer().apply {
                setDataSource(this@AlarmAlertActivity, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {}
    }

    private fun startVibration() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 800, 400, 800, 400), 0))
        } catch (_: Exception) {}
    }

    private fun snooze(alarmId: Int, label: String, tagColor: String?, time: String?) {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, AlarmReceiver::class.java).apply {
            putExtra("ALARM_ID", alarmId)
            putExtra("ALARM_LABEL", label)
            putExtra("TAG_COLOR", tagColor)
            putExtra("ALARM_TIME", time)
            putExtra("IS_SNOOZE", true)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            this, alarmId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 10 * 60 * 1000L,
                    pendingIntent
                )
            } else {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 10 * 60 * 1000L,
                    pendingIntent
                )
            }
        } catch (_: SecurityException) {
            try {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 10 * 60 * 1000L,
                    pendingIntent
                )
            } catch (_: Exception) {}
        }
        dismiss()
    }

    private fun dismiss() {
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancelAll()
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        try { mediaPlayer?.stop(); mediaPlayer?.release() } catch (_: Exception) {}
        mediaPlayer = null
        try { vibrator?.cancel() } catch (_: Exception) {}
        vibrator = null
    }
}
