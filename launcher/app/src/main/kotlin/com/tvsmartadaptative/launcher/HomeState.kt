package com.tvsmartadaptative.launcher

import com.tvsmartadaptative.launcher.core.AdaptiveLayout
import com.tvsmartadaptative.launcher.core.LayoutSpec
import com.tvsmartadaptative.launcher.core.Profile
import com.tvsmartadaptative.launcher.core.ProfileOrigin
import com.tvsmartadaptative.launcher.core.ResolvedRow
import com.tvsmartadaptative.launcher.core.RowResolver

data class HomeState(
    val profile: Profile,
    val origin: ProfileOrigin,
    val layout: LayoutSpec,
    val rows: List<ResolvedRow>,
) {
    companion object {
        fun build(system: TvSystem, store: ProfileStore): HomeState {
            val selected = store.load()
            val layout = AdaptiveLayout.compute(system.traits(), selected.profile)
            val rows = RowResolver.resolve(
                profile = selected.profile,
                apps = system.installedApps(),
                inputs = system.inputs(),
                ownPackage = BuildConfigPackage.NAME,
                maxItemsPerRow = layout.maxItemsPerRow,
            )
            return HomeState(selected.profile, selected.origin, layout, rows)
        }
    }
}

object BuildConfigPackage {
    const val NAME = "com.tvsmartadaptative.launcher"
}
