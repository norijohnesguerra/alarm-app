package com.neonalarm.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.neonalarm.data.ApiClient
import com.neonalarm.data.WorkDayAnswer
import com.neonalarm.data.WorkDayLog
import com.neonalarm.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkDayScreen(navController: NavController) {
    var today by remember { mutableStateOf<WorkDayLog?>(null) }
    var history by remember { mutableStateOf(listOf<WorkDayLog>()) }
    var loading by remember { mutableStateOf(true) }
    var submitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            today = ApiClient.api.getWorkDayToday().body()
            history = ApiClient.api.getWorkDayHistory().body() ?: emptyList()
        } catch (_: Exception) {}
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("WORK DAY", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp) },
                navigationIcon = { IconButton(onClick = { navController.popBackStack() }) { Icon(Icons.Default.ArrowBack, "Back", tint = NeonCyan) } },
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
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    val dateFormat = SimpleDateFormat("EEEE, MMMM d, yyyy", Locale.US)
                    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text("TODAY", color = NeonDarkGray, fontSize = 10.sp, fontFamily = FontFamily.Monospace, letterSpacing = 2.sp)
                            Text(dateFormat.format(Date()), color = NeonGray, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(16.dp))

                            when (today?.isWorkDay) {
                                1 -> {
                                    Card(colors = CardDefaults.cardColors(containerColor = NeonLime.copy(alpha = 0.1f)), shape = RoundedCornerShape(8.dp)) {
                                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.CheckCircle, null, tint = NeonLime)
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Column {
                                                Text("WORK DAY", color = NeonLime, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                                Text("Alarms active", color = NeonLime.copy(alpha = 0.7f), fontSize = 12.sp)
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    TextButton(onClick = {
                                        scope.launch {
                                            submitting = true
                                            ApiClient.api.answerWorkDay(WorkDayAnswer(0))
                                            today = ApiClient.api.getWorkDayToday().body()
                                            history = ApiClient.api.getWorkDayHistory().body() ?: emptyList()
                                            submitting = false
                                        }
                                    }) { Text("Change answer", color = NeonGray) }
                                }
                                0 -> {
                                    Card(colors = CardDefaults.cardColors(containerColor = NeonOrange.copy(alpha = 0.1f)), shape = RoundedCornerShape(8.dp)) {
                                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Cancel, null, tint = NeonOrange)
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Column {
                                                Text("DAY OFF", color = NeonOrange, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                                Text("Work alarms rescheduled", color = NeonOrange.copy(alpha = 0.7f), fontSize = 12.sp)
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    TextButton(onClick = {
                                        scope.launch {
                                            submitting = true
                                            ApiClient.api.answerWorkDay(WorkDayAnswer(1))
                                            today = ApiClient.api.getWorkDayToday().body()
                                            history = ApiClient.api.getWorkDayHistory().body() ?: emptyList()
                                            submitting = false
                                        }
                                    }) { Text("Change answer", color = NeonGray) }
                                }
                                else -> {
                                    Text("Do you have work today?", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                                        Button(
                                            onClick = {
                                                scope.launch {
                                                    submitting = true
                                                    ApiClient.api.answerWorkDay(WorkDayAnswer(1))
                                                    today = ApiClient.api.getWorkDayToday().body()
                                                    history = ApiClient.api.getWorkDayHistory().body() ?: emptyList()
                                                    submitting = false
                                                }
                                            },
                                            modifier = Modifier.weight(1f),
                                            enabled = !submitting,
                                            colors = ButtonDefaults.buttonColors(containerColor = NeonLime.copy(alpha = 0.2f), contentColor = NeonLime)
                                        ) { Text("YES, WORK", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold) }
                                        Button(
                                            onClick = {
                                                scope.launch {
                                                    submitting = true
                                                    ApiClient.api.answerWorkDay(WorkDayAnswer(0))
                                                    today = ApiClient.api.getWorkDayToday().body()
                                                    history = ApiClient.api.getWorkDayHistory().body() ?: emptyList()
                                                    submitting = false
                                                }
                                            },
                                            modifier = Modifier.weight(1f),
                                            enabled = !submitting,
                                            colors = ButtonDefaults.buttonColors(containerColor = NeonOrange.copy(alpha = 0.2f), contentColor = NeonOrange)
                                        ) { Text("DAY OFF", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold) }
                                    }
                                }
                            }
                        }
                    }
                }

                item { Spacer(modifier = Modifier.height(8.dp)) }
                item { Text("HISTORY", color = NeonDarkGray, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp) }

                if (history.isEmpty()) {
                    item { Text("No history yet", color = NeonDarkGray, fontSize = 13.sp) }
                } else {
                    items(history) { log ->
                        Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                            Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(if (log.isWorkDay == 1) NeonLime else NeonOrange))
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(log.date, color = Color.White, fontSize = 13.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                                Text(
                                    text = if (log.isWorkDay == 1) "WORK" else "OFF",
                                    color = if (log.isWorkDay == 1) NeonLime else NeonOrange,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
