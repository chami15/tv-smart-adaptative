package com.tvsmartadaptative.launcher

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Base64
import com.tvsmartadaptative.launcher.core.ProfileResult

/**
 * Recebe um perfil novo do Studio:
 *   am broadcast -a com.tvsmartadaptative.launcher.SET_PROFILE -n com.tvsmartadaptative.launcher/.ProfileReceiver --es profile_b64 <base64>
 * Protegido no manifesto pela permissão DUMP: só o adb/sistema consegue enviar.
 * A resposta (lida pelo Studio na saída do "am broadcast") é "ok" ou a lista de erros.
 */
class ProfileReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION) return
        val b64 = intent.getStringExtra(EXTRA) ?: return reply(false, "perfil ausente")
        if (b64.length > MAX_B64) return reply(false, "perfil grande demais")
        val text = try {
            String(Base64.decode(b64, Base64.DEFAULT), Charsets.UTF_8)
        } catch (e: IllegalArgumentException) {
            return reply(false, "base64 inválido")
        }
        when (val r = ProfileStore(context).save(text)) {
            is ProfileResult.Ok -> reply(true, "ok")
            is ProfileResult.Invalid -> reply(false, r.errors.joinToString(" | "))
        }
    }

    private fun reply(ok: Boolean, message: String) {
        if (isOrderedBroadcast) {
            resultCode = if (ok) Activity.RESULT_OK else Activity.RESULT_CANCELED
            resultData = message
        }
    }

    companion object {
        const val ACTION = "com.tvsmartadaptative.launcher.SET_PROFILE"
        const val EXTRA = "profile_b64"
        private const val MAX_B64 = 96 * 1024
    }
}
