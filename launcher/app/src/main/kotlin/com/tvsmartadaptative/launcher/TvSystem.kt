package com.tvsmartadaptative.launcher

import android.app.ActivityManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.media.tv.TvContract
import android.media.tv.TvInputInfo as AndroidTvInputInfo
import android.media.tv.TvInputManager
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.core.graphics.drawable.toBitmap
import com.tvsmartadaptative.launcher.core.DeviceTraits
import com.tvsmartadaptative.launcher.core.InstalledApp
import com.tvsmartadaptative.launcher.core.TvInputInfo

/** Tudo o que o launcher lê do sistema da TV (somente leitura). */
class TvSystem(private val context: Context) {
    private val pm: PackageManager = context.packageManager
    private val resolved = HashMap<String, ResolveInfo>()

    fun traits(): DeviceTraits {
        val metrics = context.resources.displayMetrics
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mem = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        return DeviceTraits(
            widthPx = metrics.widthPixels,
            heightPx = metrics.heightPixels,
            densityDpi = metrics.densityDpi,
            totalRamMb = (mem.totalMem / (1024 * 1024)).toInt(),
            apiLevel = Build.VERSION.SDK_INT,
            isLowRamDevice = am.isLowRamDevice,
        )
    }

    /** Apps que aparecem na tela inicial (preferindo a versão para TV). */
    fun installedApps(): List<InstalledApp> {
        resolved.clear()
        fun query(category: String) =
            pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(category), 0)
        for (ri in query(Intent.CATEGORY_LAUNCHER)) resolved[ri.activityInfo.packageName] = ri
        for (ri in query(Intent.CATEGORY_LEANBACK_LAUNCHER)) resolved[ri.activityInfo.packageName] = ri
        return resolved.values.map { InstalledApp(it.activityInfo.packageName, it.loadLabel(pm).toString()) }
    }

    /** Banner de TV (16:9) se existir; senão o ícone. Pode ser lento: chamar fora da thread de tela. */
    fun artwork(pkg: String, widthPx: Int, heightPx: Int): Bitmap? = try {
        val ri = resolved[pkg]
        val drawable = ri?.activityInfo?.loadBanner(pm) ?: ri?.activityInfo?.applicationInfo?.loadBanner(pm) ?: ri?.loadIcon(pm)
        drawable?.toBitmap(widthPx, heightPx)
    } catch (e: Exception) {
        null
    }

    /** Entradas HDMI/AV e sintonizador declarados pela própria TV. */
    fun inputs(): List<TvInputInfo> {
        val tim = context.getSystemService(Context.TV_INPUT_SERVICE) as? TvInputManager ?: return emptyList()
        return try {
            tim.tvInputList
                .filter { it.type != AndroidTvInputInfo.TYPE_OTHER || it.isPassthroughInput }
                .map { TvInputInfo(it.id, it.loadLabel(context).toString()) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun openApp(pkg: String) {
        val intent = pm.getLeanbackLaunchIntentForPackage(pkg) ?: pm.getLaunchIntentForPackage(pkg)
        start(intent)
    }

    fun openInput(id: String) {
        val tim = context.getSystemService(Context.TV_INPUT_SERVICE) as? TvInputManager
        val info = try { tim?.getTvInputInfo(id) } catch (e: Exception) { null }
        val uri = if (info?.isPassthroughInput == true) TvContract.buildChannelUriForPassthroughInput(id)
        else TvContract.buildChannelsUriForInput(id)
        start(Intent(Intent.ACTION_VIEW, uri))
    }

    fun openSettings() = start(Intent(Settings.ACTION_SETTINGS))

    private fun start(intent: Intent?) {
        if (intent == null) return toast()
        try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            toast()
        } catch (e: SecurityException) {
            toast()
        }
    }

    private fun toast() = Toast.makeText(context, R.string.cannot_open, Toast.LENGTH_SHORT).show()
}
