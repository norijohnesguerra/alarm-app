package com.neonalarm.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.neonalarm.data.ApiClient
import com.neonalarm.data.LoginRequest
import com.neonalarm.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(navController: NavController) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isRegister by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(NeonBg)
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "NEON ALARM",
                fontSize = 32.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = NeonCyan,
                letterSpacing = 4.sp
            )
            Text(
                text = "DYNAMIC ALARM MANAGEMENT",
                fontSize = 11.sp,
                color = NeonDarkGray,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 2.sp,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(48.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = NeonSurface)
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Text(
                        text = if (isRegister) "CREATE ACCOUNT" else "SIGN IN",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = Color.White,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    if (error.isNotEmpty()) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0x22FF4444)),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = error,
                                color = NeonPink,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("EMAIL", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = NeonCyan,
                            unfocusedBorderColor = NeonBorder,
                            focusedLabelColor = NeonCyan,
                            cursorColor = NeonCyan
                        ),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("PASSWORD", fontFamily = FontFamily.Monospace, fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = NeonCyan,
                            unfocusedBorderColor = NeonBorder,
                            focusedLabelColor = NeonCyan,
                            cursorColor = NeonCyan
                        ),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            loading = true
                            error = ""
                            scope.launch {
                                try {
                                    val response = if (isRegister) {
                                        ApiClient.api.register(LoginRequest(email, password))
                                    } else {
                                        ApiClient.api.login(LoginRequest(email, password))
                                    }
                                    if (response.isSuccessful) {
                                        ApiClient.authToken = response.body()?.token
                                        navController.navigate("dashboard") {
                                            popUpTo("login") { inclusive = true }
                                        }
                                    } else {
                                        error = "Invalid credentials"
                                    }
                                } catch (e: Exception) {
                                    error = "Connection failed: ${e.message}"
                                }
                                loading = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !loading && email.isNotEmpty() && password.isNotEmpty(),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NeonCyan.copy(alpha = 0.2f),
                            contentColor = NeonCyan
                        )
                    ) {
                        Text(
                            text = if (loading) "..." else if (isRegister) "REGISTER" else "LOGIN",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 2.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    TextButton(
                        onClick = { isRegister = !isRegister },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = if (isRegister) "Already have an account? Sign in" else "Don't have an account? Register",
                            color = NeonDarkGray,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}
