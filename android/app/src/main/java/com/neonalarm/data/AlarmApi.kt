package com.neonalarm.data

import retrofit2.Response
import retrofit2.http.*

interface AlarmApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("auth/register")
    suspend fun register(@Body request: LoginRequest): Response<LoginResponse>

    @GET("alarms")
    suspend fun getAlarms(): Response<List<Alarm>>

    @POST("alarms")
    suspend fun createAlarm(@Body request: AlarmCreateRequest): Response<Alarm>

    @PUT("alarms/{id}")
    suspend fun updateAlarm(@Path("id") id: Long, @Body request: AlarmCreateRequest): Response<Alarm>

    @DELETE("alarms/{id}")
    suspend fun deleteAlarm(@Path("id") id: Long): Response<Unit>

    @PATCH("alarms/{id}/toggle")
    suspend fun toggleAlarm(@Path("id") id: Long): Response<Alarm>

    @PATCH("alarms/{id}/lock")
    suspend fun toggleLock(@Path("id") id: Long): Response<Alarm>

    @POST("alarms/generate-schedule")
    suspend fun generateSchedule(@Body body: ScheduleRequest): Response<ScheduleResponse>

    @GET("tags")
    suspend fun getTags(): Response<List<Tag>>

    @POST("tags")
    suspend fun createTag(@Body tag: Tag): Response<Tag>

    @PUT("tags/{id}")
    suspend fun updateTag(@Path("id") id: Long, @Body tag: Tag): Response<Tag>

    @DELETE("tags/{id}")
    suspend fun deleteTag(@Path("id") id: Long): Response<Unit>

    @GET("memos/{tagId}")
    suspend fun getMemo(@Path("tagId") tagId: Long): Response<Memo>

    @PUT("memos/{tagId}")
    suspend fun updateMemo(@Path("tagId") tagId: Long, @Body body: Map<String, String>): Response<Memo>

    @GET("workday/today")
    suspend fun getWorkDayToday(): Response<WorkDayLog>

    @GET("workday/history")
    suspend fun getWorkDayHistory(): Response<List<WorkDayLog>>

    @POST("workday/answer")
    suspend fun answerWorkDay(@Body body: WorkDayAnswer): Response<WorkDayLog>
}
