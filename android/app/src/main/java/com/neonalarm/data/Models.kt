package com.neonalarm.data

import com.google.gson.annotations.SerializedName
import androidx.room.*

data class Alarm(
    val id: Long = 0,
    @SerializedName("user_id") val userId: Long = 0,
    val time: String,
    @SerializedName("days_of_week") val daysOfWeek: String = "1,2,3,4,5",
    @SerializedName("tag_id") val tagId: Long? = null,
    @SerializedName("is_active") val isActive: Int = 1,
    val label: String = "",
    @SerializedName("snooze_minutes") val snoozeMinutes: Int = 5,
    @SerializedName("parent_alarm_id") val parentAlarmId: Long? = null,
    @SerializedName("is_locked") val isLocked: Int = 1,
    @SerializedName("created_at") val createdAt: String = "",
    @SerializedName("updated_at") val updatedAt: String = "",
    @SerializedName("tag_name") val tagName: String? = null,
    @SerializedName("tag_color") val tagColor: String? = null,
    @SerializedName("tag_categories") val tagCategory: String? = null,
    @SerializedName("parent_time") val parentTime: String? = null,
    @SerializedName("parent_label") val parentLabel: String? = null
)

data class Tag(
    val id: Long = 0,
    @SerializedName("user_id") val userId: Long = 0,
    val name: String,
    val color: String = "#00e5ff",
    @SerializedName("categories") val category: String = "custom",
    @SerializedName("is_system_default") val isSystemDefault: Int = 0
)

data class Memo(
    val id: Long = 0,
    @SerializedName("tag_id") val tagId: Long,
    val content: String = "",
    @SerializedName("updated_at") val updatedAt: String = ""
)

data class WorkDayLog(
    val id: Long = 0,
    @SerializedName("user_id") val userId: Long = 0,
    val date: String,
    @SerializedName("is_work_day") val isWorkDay: Int? = null,
    @SerializedName("answered_at") val answeredAt: String = ""
)

data class LoginRequest(val email: String, val password: String)
data class LoginResponse(val token: String, val user: User)
data class User(val id: Long, val email: String)

data class AlarmCreateRequest(
    val time: String,
    val days_of_week: String = "1,2,3,4,5",
    val tag_id: Long? = null,
    val label: String = "",
    val is_active: Int = 1,
    val snooze_minutes: Int = 5,
    val parent_alarm_id: Long? = null,
    val is_locked: Int = 1
)

data class WorkDayAnswer(val is_work_day: Int)

data class WorkSchedule(
    val start_time: String = "09:00",
    val end_time: String = "17:00",
    val has_lunch: Boolean = true,
    val lunch_start: String = "12:00",
    val lunch_end: String = "13:00",
    val has_morning_break: Boolean = false,
    val morning_break_start: String = "10:15",
    val morning_break_end: String = "10:30",
    val has_afternoon_break: Boolean = false,
    val afternoon_break_start: String = "15:00",
    val afternoon_break_end: String = "15:15",
    val reminders_before_start: Int = 30
)

data class ScheduleRequest(val parent_alarm_id: Long, val schedule: WorkSchedule)
data class ScheduleResponse(val parent: Alarm, val children: List<Alarm>)
