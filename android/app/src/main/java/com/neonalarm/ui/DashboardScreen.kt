package com.neonalarm.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.neonalarm.BuildConfig
import com.neonalarm.data.*
import com.neonalarm.ui.theme.*
import kotlinx.coroutines.launch
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(navController: NavController) {
    var alarms by remember { mutableStateOf(listOf<Alarm>()) }
    var workToday by remember { mutableStateOf<WorkDayLog?>(null) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(Unit) {
        try {
            alarms = ApiClient.api.getAlarms().body() ?: emptyList()
            workToday = ApiClient.api.getWorkDayToday().body()
        } catch (_: Exception) {}
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("DASHBOARD", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                },
                actions = {
                    if (BuildConfig.DEBUG) {
                        IconButton(onClick = {
                            val now = Calendar.getInstance()
                            val intent = Intent(context, AlarmReceiver::class.java).apply {
                                putExtra("ALARM_ID", -1)
                                putExtra("ALARM_LABEL", "TEST ALARM")
                                putExtra("ALARM_TIME", String.format(Locale.US, "%02d%02d", now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE)))
                                putExtra("HOUR", now.get(Calendar.HOUR_OF_DAY))
                                putExtra("MINUTE", now.get(Calendar.MINUTE))
                                putExtra("IS_TEST", true)
                            }
                            context.sendBroadcast(intent)
                        }) { Icon(Icons.Default.NotificationsActive, "Test alarm", tint = NeonCyan) }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NeonSurface)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = NeonSurface) {
                NavigationBarItem(selected = true, onClick = {}, icon = { Icon(Icons.Default.Home, null) }, label = { Text("Home", fontSize = 10.sp) }, colors = NavigationBarItemDefaults.colors(selectedIconColor = NeonCyan, selectedTextColor = NeonCyan, indicatorColor = NeonCyan.copy(alpha = 0.1f)))
                NavigationBarItem(selected = false, onClick = { navController.navigate("alarms") }, icon = { Icon(Icons.Default.Alarm, null) }, label = { Text("Alarms", fontSize = 10.sp) }, colors = NavigationBarItemDefaults.colors(selectedIconColor = NeonCyan, selectedTextColor = NeonCyan, indicatorColor = NeonCyan.copy(alpha = 0.1f)))
                NavigationBarItem(selected = false, onClick = { navController.navigate("tags") }, icon = { Icon(Icons.Default.Label, null) }, label = { Text("Tags", fontSize = 10.sp) }, colors = NavigationBarItemDefaults.colors(selectedIconColor = NeonCyan, selectedTextColor = NeonCyan, indicatorColor = NeonCyan.copy(alpha = 0.1f)))
                NavigationBarItem(selected = false, onClick = { navController.navigate("workday") }, icon = { Icon(Icons.Default.CalendarMonth, null) }, label = { Text("Work", fontSize = 10.sp) }, colors = NavigationBarItemDefaults.colors(selectedIconColor = NeonCyan, selectedTextColor = NeonCyan, indicatorColor = NeonCyan.copy(alpha = 0.1f)))
            }
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
                    Text("OVERVIEW", color = NeonDarkGray, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                        Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("ACTIVE", color = NeonDarkGray, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                Text("${alarms.count { it.isActive == 1 }}", color = NeonCyan, fontSize = 28.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                            }
                        }
                        Card(modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("WORK TODAY", color = NeonDarkGray, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                Text(
                                    text = when (workToday?.isWorkDay) { 1 -> "YES"; 0 -> "OFF"; else -> "?" },
                                    color = when (workToday?.isWorkDay) { 1 -> NeonLime; 0 -> NeonOrange; else -> NeonDarkGray },
                                    fontSize = 28.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }

                item { Spacer(modifier = Modifier.height(8.dp)) }
                item {
                    Text("TODAY'S ALARMS", color = NeonDarkGray, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 2.sp)
                }

                val todayAlarms = alarms.filter { it.daysOfWeek.split(",").contains(java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_WEEK).minus(1).toString()) }
                if (todayAlarms.isEmpty()) {
                    item { Text("No alarms today", color = NeonDarkGray, fontSize = 13.sp) }
                } else {
                    items(todayAlarms) { alarm ->
                        Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                            Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(alarm.time, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(alarm.label.ifEmpty { alarm.tagName ?: "Alarm" }, color = NeonGray, fontSize = 13.sp)
                                Spacer(modifier = Modifier.weight(1f))
                                if (alarm.tagColor != null) {
                                    Box(modifier = Modifier.size(12.dp).background(Color(android.graphics.Color.parseColor(alarm.tagColor)), RoundedCornerShape(6.dp)))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
