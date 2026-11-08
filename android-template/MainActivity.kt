package id.ujian_kita.app

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "id.ujian_kita/kiosk"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startLockTask" -> {
                    try {
                        startLockTask()
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("LOCK_TASK_ERROR", e.message, null)
                    }
                }
                "stopLockTask" -> {
                    try {
                        stopLockTask()
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("STOP_LOCK_ERROR", e.message, null)
                    }
                }
                "isPinned" -> {
                    try {
                        val am = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
                        val isPinned = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && am != null) {
                            am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
                        } else {
                            false
                        }
                        result.success(isPinned)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "getStats" -> {
                    try {
                        val stats = getDeviceStatistics()
                        result.success(stats)
                    } catch (e: Exception) {
                        result.error("STATS_ERROR", e.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun getDeviceStatistics(): Map<String, Any> {
        val map = mutableMapOf<String, Any>()

        // 1. Battery Info & Temperature
        try {
            val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            if (batteryIntent != null) {
                val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                val pct = if (level >= 0 && scale > 0) (level * 100) / scale else -1
                map["batteryLevel"] = pct

                val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                        status == BatteryManager.BATTERY_STATUS_FULL
                map["isCharging"] = isCharging

                val rawTemp = batteryIntent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)
                val tempC = rawTemp / 10.0
                map["temperature"] = tempC
            } else {
                map["batteryLevel"] = -1
                map["isCharging"] = false
                map["temperature"] = 0.0
            }
        } catch (_: Exception) {
            map["batteryLevel"] = -1
            map["isCharging"] = false
            map["temperature"] = 0.0
        }

        // 2. Network Info
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            if (cm != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val network = cm.activeNetwork
                    val caps = cm.getNetworkCapabilities(network)
                    if (caps != null) {
                        when {
                            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> map["network"] = "Wi-Fi"
                            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> map["network"] = "Data Seluler"
                            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> map["network"] = "Ethernet"
                            else -> map["network"] = "Terhubung"
                        }
                    } else {
                        map["network"] = "Terputus"
                    }
                } else {
                    @Suppress("DEPRECATION")
                    val netInfo = cm.activeNetworkInfo
                    @Suppress("DEPRECATION")
                    if (netInfo != null && netInfo.isConnected) {
                        map["network"] = if (netInfo.type == ConnectivityManager.TYPE_WIFI) "Wi-Fi" else "Data Seluler"
                    } else {
                        map["network"] = "Terputus"
                    }
                }
            } else {
                map["network"] = "Tidak diketahui"
            }
        } catch (_: Exception) {
            map["network"] = "Tidak diketahui"
        }

        // 3. Pinning State
        try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val isPinned = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && am != null) {
                am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
            } else {
                false
            }
            map["isPinned"] = isPinned
        } catch (_: Exception) {
            map["isPinned"] = false
        }

        return map
    }
}
