@file:OptIn(ExperimentalMaterial3Api::class)

package com.neonalarm.ui

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.neonalarm.data.*
import com.neonalarm.ui.theme.*
import kotlinx.coroutines.launch
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlarmsScreen(navController: NavController) {
    var alarms by remember { mutableStateOf(listOf<Alarm>()) }
    var tags by remember { mutableStateOf(listOf<Tag>()) }
    var showCreate by remember { mutableStateOf(false) }
    var editAlarm by remember { mutableStateOf<Alarm?>(null) }
    var scheduleAlarm by remember { mutableStateOf<Alarm?>(null) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        try {
            alarms = ApiClient.api.getAlarms().body() ?: emptyList()
            tags = ApiClient.api.getTags().body() ?: emptyList()
            resyncAlarms(context, alarms)
        } catch (_: Exception) {}
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ALARMS", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp) },
                navigationIcon = { IconButton(onClick = { navController.popBackStack() }) { Icon(Icons.Default.ArrowBack, "Back", tint = NeonCyan) } },
                actions = { IconButton(onClick = { showCreate = !showCreate }) { Icon(Icons.Default.Add, "Add", tint = NeonCyan) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NeonSurface)
            )
        },
        containerColor = NeonBg
    ) { padding ->
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("LOADING...", color = NeonCyan, fontFamily = FontFamily.Monospace)
            }
        } else {
            LazyColumn(
                modifier = Modifier.padding(padding).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (showCreate) {
                    item {
                        CreateAlarmForm(tags = tags, onDismiss = { showCreate = false }, onSave = { req ->
                            scope.launch {
                                try {
                                    ApiClient.api.createAlarm(req)
                                    alarms = ApiClient.api.getAlarms().body() ?: emptyList()
                                    resyncAlarms(context, alarms)
                                    showCreate = false
                                } catch (_: Exception) {}
                            }
                        })
                    }
                }

                if (scheduleAlarm != null) {
                    item {
                        WorkScheduleDialog(
                            alarm = scheduleAlarm!!,
                            onDismiss = { scheduleAlarm = null },
                            onGenerate = { schedule ->
                                scope.launch {
                                    try {
                                        ApiClient.api.generateSchedule(ScheduleRequest(scheduleAlarm!!.id, schedule))
                                        alarms = ApiClient.api.getAlarms().body() ?: emptyList()
                                        scheduleAlarm = null
                                    } catch (_: Exception) {}
                                }
                            }
                        )
                    }
                }

                val parents = alarms.filter { it.parentAlarmId == null }
                val getChildren: (Long) -> List<Alarm> = { pid -> alarms.filter { it.parentAlarmId == pid } }

                items(parents) { alarm ->
                    val children = getChildren(alarm.id)
                    val isWorkTag = alarm.tagCategory == "work"

                    AlarmCard(alarm = alarm, isParent = true, childCount = children.size,
                        onToggle = {
                            scope.launch {
                                if (alarm.isActive == 1) cancelAlarm(context, alarm.id)
                                ApiClient.api.toggleAlarm(alarm.id)
                                alarms = ApiClient.api.getAlarms().body() ?: emptyList()
                                resyncAlarms(context, alarms)
                            }
                        },
                        onDelete = {
                            scope.launch {
                                cancelAlarm(context, alarm.id)
                                ApiClient.api.deleteAlarm(alarm.id)
                                alarms = ApiClient.api.getAlarms().body() ?: emptyList()
                                resyncAlarms(context, alarms)
                            }
                        },
                        onSchedule = { if (isWorkTag) scheduleAlarm = alarm },
                        onEdit = { editAlarm = alarm },
                        showScheduleButton = isWorkTag
                    )

                    if (children.isNotEmpty()) {
                        Column(modifier = Modifier.padding(start = 24.dp, top = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            children.forEach { child ->
                                ChildAlarmCard(alarm = child,
                                    onToggle = {
                                        scope.launch {
                                            ApiClient.api.toggleAlarm(child.id)
                                            alarms = ApiClient.api.getAlarms().body() ?: emptyList()
                                        }
                                    },
                                    onToggleLock = {
                                        scope.launch {
                                            ApiClient.api.toggleLock(child.id)
                                            alarms = ApiClient.api.getAlarms().body() ?: emptyList()
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AlarmCard(alarm: Alarm, isParent: Boolean, childCount: Int, onToggle: () -> Unit, onDelete: () -> Unit, onSchedule: () -> Unit, onEdit: () -> Unit, showScheduleButton: Boolean) {
    val days = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
    val activeDays = alarm.daysOfWeek.split(",").map { days[it.trim().toInt()] }.joinToString(", ")

    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(alarm.time, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                Text(alarm.label.ifEmpty { alarm.tagName ?: "No label" }, color = NeonGray, fontSize = 13.sp)
                Text(activeDays, color = NeonDarkGray, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                if (childCount > 0) {
                    Text("PARENT · $childCount children", color = NeonLime, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Switch(
                    checked = alarm.isActive == 1,
                    onCheckedChange = { onToggle() },
                    colors = SwitchDefaults.colors(checkedThumbColor = NeonCyan, checkedTrackColor = NeonCyan.copy(alpha = 0.3f))
                )
                Row {
                    if (showScheduleButton) {
                        TextButton(onClick = onSchedule) { Text("+Sched", color = NeonLime, fontSize = 10.sp) }
                    }
                    TextButton(onClick = onEdit) { Text("Edit", color = NeonCyan, fontSize = 11.sp) }
                    TextButton(onClick = onDelete) { Text("Del", color = NeonPink, fontSize = 11.sp) }
                }
            }
        }
    }
}

@Composable
fun ChildAlarmCard(alarm: Alarm, onToggle: () -> Unit, onToggleLock: () -> Unit) {
    Card(shape = RoundedCornerShape(8.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface.copy(alpha = 0.7f))) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(alarm.time, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.width(60.dp))
            Text(alarm.label, color = NeonGray, fontSize = 12.sp, modifier = Modifier.weight(1f))
            TextButton(onClick = onToggleLock) {
                Text(
                    text = if (alarm.isLocked == 1) "Linked" else "Free",
                    color = if (alarm.isLocked == 1) NeonCyan else NeonDarkGray,
                    fontSize = 10.sp
                )
            }
            Switch(
                checked = alarm.isActive == 1,
                onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(checkedThumbColor = NeonCyan, checkedTrackColor = NeonCyan.copy(alpha = 0.3f))
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkScheduleDialog(alarm: Alarm, onDismiss: () -> Unit, onGenerate: (WorkSchedule) -> Unit) {
    var startTime by remember { mutableStateOf("08:30") }
    var endTime by remember { mutableStateOf("17:00") }
    var hasLunch by remember { mutableStateOf(true) }
    var lunchStart by remember { mutableStateOf("12:00") }
    var lunchEnd by remember { mutableStateOf("13:00") }
    var hasMorningBreak by remember { mutableStateOf(false) }
    var morningBreakStart by remember { mutableStateOf("10:15") }
    var morningBreakEnd by remember { mutableStateOf("10:30") }
    var hasAfternoonBreak by remember { mutableStateOf(false) }
    var afternoonBreakStart by remember { mutableStateOf("15:00") }
    var afternoonBreakEnd by remember { mutableStateOf("15:15") }
    var reminderBefore by remember { mutableStateOf("30") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = NeonSurface,
        title = { Text("WORK SCHEDULE", color = NeonLime, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text("Generate from: ${alarm.time} ${alarm.label}", color = NeonGray, fontSize = 12.sp)

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = startTime, onValueChange = { startTime = it }, label = { Text("START", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                    OutlinedTextField(value = endTime, onValueChange = { endTime = it }, label = { Text("END", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                }

                OutlinedTextField(value = reminderBefore, onValueChange = { reminderBefore = it }, label = { Text("REMINDER BEFORE START (min)", fontSize = 10.sp) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)

                HorizontalDivider(color = NeonBorder)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("LUNCH BREAK", color = NeonGray, fontSize = 11.sp, modifier = Modifier.weight(1f))
                    Switch(checked = hasLunch, onCheckedChange = { hasLunch = it }, colors = SwitchDefaults.colors(checkedThumbColor = NeonLime, checkedTrackColor = NeonLime.copy(alpha = 0.3f)))
                }
                if (hasLunch) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = lunchStart, onValueChange = { lunchStart = it }, label = { Text("START", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                        OutlinedTextField(value = lunchEnd, onValueChange = { lunchEnd = it }, label = { Text("END", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                    }
                }

                HorizontalDivider(color = NeonBorder)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("MORNING BREAK", color = NeonGray, fontSize = 11.sp, modifier = Modifier.weight(1f))
                    Switch(checked = hasMorningBreak, onCheckedChange = { hasMorningBreak = it }, colors = SwitchDefaults.colors(checkedThumbColor = NeonOrange, checkedTrackColor = NeonOrange.copy(alpha = 0.3f)))
                }
                if (hasMorningBreak) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = morningBreakStart, onValueChange = { morningBreakStart = it }, label = { Text("START", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                        OutlinedTextField(value = morningBreakEnd, onValueChange = { morningBreakEnd = it }, label = { Text("END", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                    }
                }

                HorizontalDivider(color = NeonBorder)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("AFTERNOON BREAK", color = NeonGray, fontSize = 11.sp, modifier = Modifier.weight(1f))
                    Switch(checked = hasAfternoonBreak, onCheckedChange = { hasAfternoonBreak = it }, colors = SwitchDefaults.colors(checkedThumbColor = NeonPink, checkedTrackColor = NeonPink.copy(alpha = 0.3f)))
                }
                if (hasAfternoonBreak) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = afternoonBreakStart, onValueChange = { afternoonBreakStart = it }, label = { Text("START", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                        OutlinedTextField(value = afternoonBreakEnd, onValueChange = { afternoonBreakEnd = it }, label = { Text("END", fontSize = 10.sp) }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                onGenerate(WorkSchedule(
                    start_time = startTime, end_time = endTime,
                    has_lunch = hasLunch, lunch_start = lunchStart, lunch_end = lunchEnd,
                    has_morning_break = hasMorningBreak, morning_break_start = morningBreakStart, morning_break_end = morningBreakEnd,
                    has_afternoon_break = hasAfternoonBreak, afternoon_break_start = afternoonBreakStart, afternoon_break_end = afternoonBreakEnd,
                    reminders_before_start = reminderBefore.toIntOrNull() ?: 30
                ))
            }, colors = ButtonDefaults.buttonColors(containerColor = NeonLime.copy(alpha = 0.2f), contentColor = NeonLime)) {
                Text("GENERATE", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = NeonGray) } }
    )
}

@Composable
fun CreateAlarmForm(tags: List<Tag>, onDismiss: () -> Unit, onSave: (AlarmCreateRequest) -> Unit) {
    var time by remember { mutableStateOf("07:00") }
    var label by remember { mutableStateOf("") }
    var selectedTag by remember { mutableStateOf<Tag?>(null) }
    var expanded by remember { mutableStateOf(false) }

    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface.copy(alpha = 0.8f))) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("NEW ALARM", color = NeonCyan, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(value = time, onValueChange = { time = it }, label = { Text("TIME (HH:MM)", fontFamily = FontFamily.Monospace, fontSize = 11.sp) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("LABEL", fontFamily = FontFamily.Monospace, fontSize = 11.sp) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
            Spacer(modifier = Modifier.height(8.dp))

            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                OutlinedTextField(value = selectedTag?.name ?: "No tag", onValueChange = {}, readOnly = true, label = { Text("TAG", fontFamily = FontFamily.Monospace, fontSize = 11.sp) }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan))
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    DropdownMenuItem(text = { Text("No tag") }, onClick = { selectedTag = null; expanded = false })
                    tags.forEach { tag -> DropdownMenuItem(text = { Text(tag.name) }, onClick = { selectedTag = tag; expanded = false }) }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Cancel", color = NeonGray) }
                Button(onClick = { onSave(AlarmCreateRequest(time = time, label = label, tag_id = selectedTag?.id)) }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = NeonCyan.copy(alpha = 0.2f), contentColor = NeonCyan)) { Text("CREATE", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

fun scheduleAlarm(context: Context, alarm: Alarm) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val t = alarm.time.replace(":", "")
    val hour = t.take(2).toIntOrNull() ?: 7
    val minute = t.drop(2).toIntOrNull() ?: 0
    val cal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
    }
    val intent = Intent(context, AlarmReceiver::class.java).apply {
        putExtra("ALARM_ID", alarm.id.toInt())
        putExtra("ALARM_LABEL", alarm.label.ifEmpty { alarm.tagName ?: "Alarm" })
        putExtra("TAG_COLOR", alarm.tagColor)
        putExtra("ALARM_TIME", alarm.time)
        putExtra("DAYS_OF_WEEK", alarm.daysOfWeek)
        putExtra("HOUR", hour)
        putExtra("MINUTE", minute)
    }
    val pendingIntent = PendingIntent.getBroadcast(context, alarm.id.toInt(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    try {
        val exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
        if (exactAllowed) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pendingIntent)
        } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pendingIntent)
        }
    } catch (_: SecurityException) {
        try { alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pendingIntent) } catch (_: Exception) {}
    }
}

fun cancelAlarm(context: Context, alarmId: Long) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, AlarmReceiver::class.java)
    val pendingIntent = PendingIntent.getBroadcast(
        context, alarmId.toInt(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    alarmManager.cancel(pendingIntent)
    pendingIntent.cancel()
}

// Schedule every active alarm so AlarmManager fires them on schedule.
fun resyncAlarms(context: Context, alarms: List<Alarm>) {
    for (alarm in alarms) {
        if (alarm.isActive == 1) {
            try { scheduleAlarm(context, alarm) } catch (_: Exception) {}
        }
    }
}
