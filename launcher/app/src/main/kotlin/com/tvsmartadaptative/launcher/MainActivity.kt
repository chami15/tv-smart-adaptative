package com.tvsmartadaptative.launcher

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember

/** A tela inicial. Recarrega apps e perfil sempre que volta a ficar visível. */
class MainActivity : ComponentActivity() {
    private val resumes = mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Na tela inicial, "voltar" não tem para onde ir: fica aqui.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = Unit
        })
        val system = TvSystem(applicationContext)
        val store = ProfileStore(applicationContext)
        setContent {
            val profileVersion by ProfileEvents.version.collectAsState()
            val resumeCount = resumes.intValue
            val state = remember(profileVersion, resumeCount) { HomeState.build(system, store) }
            HomeScreen(state = state, system = system)
        }
    }

    override fun onResume() {
        super.onResume()
        resumes.intValue++ // apps podem ter sido instalados/removidos enquanto estava fora
    }
}
