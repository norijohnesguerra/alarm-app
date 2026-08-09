# Neon Alarm - ProGuard rules
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.neonalarm.data.** { *; }
-dontwarn okhttp3.**
-dontwarn retrofit2.**
