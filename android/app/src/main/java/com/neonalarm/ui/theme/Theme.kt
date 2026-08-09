package com.neonalarm.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = NeonCyan,
    secondary = NeonMagenta,
    tertiary = NeonLime,
    background = NeonBg,
    surface = NeonSurface,
    surfaceVariant = NeonBorder,
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onTertiary = Color.Black,
    onBackground = Color.White,
    onSurface = Color.White,
    onSurfaceVariant = NeonGray,
    error = NeonPink,
    outline = NeonBorder,
)

@Composable
fun NeonAlarmTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography(),
        content = content
    )
}
