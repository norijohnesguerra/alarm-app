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
import com.neonalarm.data.Tag
import com.neonalarm.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagsScreen(navController: NavController) {
    var tags by remember { mutableStateOf(listOf<Tag>()) }
    var showCreate by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var memoTag by remember { mutableStateOf<Tag?>(null) }
    var memoContent by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try { tags = ApiClient.api.getTags().body() ?: emptyList() } catch (_: Exception) {}
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TAGS", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, letterSpacing = 2.sp) },
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
                        var name by remember { mutableStateOf("") }
                        var color by remember { mutableStateOf("#00e5ff") }
                        Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("NEW TAG", color = NeonCyan, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("NAME") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = color, onValueChange = { color = it }, label = { Text("COLOR (#hex)") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan), singleLine = true)
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    TextButton(onClick = { showCreate = false }) { Text("Cancel", color = NeonGray) }
                                    Button(onClick = {
                                        scope.launch {
                                            try {
                                                ApiClient.api.createTag(Tag(name = name, color = color))
                                                tags = ApiClient.api.getTags().body() ?: emptyList()
                                                showCreate = false
                                            } catch (_: Exception) {}
                                        }
                                    }, colors = ButtonDefaults.buttonColors(containerColor = NeonCyan.copy(alpha = 0.2f), contentColor = NeonCyan)) { Text("CREATE", fontFamily = FontFamily.Monospace) }
                                }
                            }
                        }
                    }
                }

                if (memoTag != null) {
                    item {
                        Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("MEMO: ${memoTag!!.name}", color = Color(android.graphics.Color.parseColor(memoTag!!.color)), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedTextField(value = memoContent, onValueChange = { memoContent = it }, modifier = Modifier.fillMaxWidth().height(100.dp), shape = RoundedCornerShape(8.dp), colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonCyan, unfocusedBorderColor = NeonBorder, cursorColor = NeonCyan))
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    TextButton(onClick = { memoTag = null }) { Text("Close", color = NeonGray) }
                                    Button(onClick = {
                                        scope.launch {
                                            try {
                                                ApiClient.api.updateMemo(memoTag!!.id, mapOf("content" to memoContent))
                                                memoTag = null
                                            } catch (_: Exception) {}
                                        }
                                    }, colors = ButtonDefaults.buttonColors(containerColor = NeonCyan.copy(alpha = 0.2f), contentColor = NeonCyan)) { Text("SAVE", fontFamily = FontFamily.Monospace) }
                                }
                            }
                        }
                    }
                }

                items(tags) { tag ->
                    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = NeonSurface)) {
                        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(16.dp).clip(CircleShape).background(Color(android.graphics.Color.parseColor(tag.color))))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(tag.name, color = Color.White, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                Text(tag.category, color = NeonDarkGray, fontSize = 11.sp)
                            }
                            TextButton(onClick = {
                                memoTag = tag
                                memoContent = ""
                                scope.launch {
                                    try {
                                        val memo = ApiClient.api.getMemo(tag.id).body()
                                        memoContent = memo?.content ?: ""
                                    } catch (_: Exception) {}
                                }
                            }) { Text("Memo", color = NeonCyan, fontSize = 11.sp) }
                            if (tag.isSystemDefault != 1) {
                                TextButton(onClick = {
                                    scope.launch {
                                        ApiClient.api.deleteTag(tag.id)
                                        tags = ApiClient.api.getTags().body() ?: emptyList()
                                    }
                                }) { Text("Del", color = NeonPink, fontSize = 11.sp) }
                            }
                        }
                    }
                }
            }
        }
    }
}
