package com.neonalarm.ui

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun NeonAlarmNavGraph() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "login") {
        composable("login") { LoginScreen(navController) }
        composable("dashboard") { DashboardScreen(navController) }
        composable("alarms") { AlarmsScreen(navController) }
        composable("tags") { TagsScreen(navController) }
        composable("workday") { WorkDayScreen(navController) }
    }
}
