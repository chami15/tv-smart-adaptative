package com.tvsmartadaptative.launcher

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import androidx.tv.material3.darkColorScheme
import com.tvsmartadaptative.launcher.core.Item
import com.tvsmartadaptative.launcher.core.LayoutSpec
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

private fun hex(value: String, fallback: Color): Color = try {
    Color(android.graphics.Color.parseColor(value))
} catch (e: IllegalArgumentException) {
    fallback
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun HomeScreen(state: HomeState, system: TvSystem) {
    val theme = state.profile.theme
    val bg = hex(theme.background, Color(0xFF0F1218))
    val accent = hex(theme.accent, Color(0xFF5B8CFF))
    val text = hex(theme.text, Color(0xFFE8EBF2))
    val firstFocus = remember { FocusRequester() }

    MaterialTheme(colorScheme = darkColorScheme(primary = accent, onSurface = text, surface = bg, background = bg)) {
        Column(Modifier.fillMaxSize().background(bg).padding(horizontal = 48.dp, vertical = 24.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(state.profile.name, color = text, fontSize = 22.sp, modifier = Modifier.weight(1f))
                if (state.profile.clock.show) Clock(state.profile.clock.format24h, text)
            }
            Spacer(Modifier.height(16.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(20.dp), contentPadding = PaddingValues(bottom = 32.dp)) {
                items(state.rows, key = { it.id }) { row ->
                    Column {
                        Text(row.title, color = text.copy(alpha = 0.85f), fontSize = 16.sp)
                        Spacer(Modifier.height(8.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            items(row.items, key = { keyOf(it) }) { item ->
                                val isFirst = row === state.rows.first() && item === row.items.first()
                                Tile(
                                    item = item,
                                    layout = state.layout,
                                    system = system,
                                    accent = accent,
                                    text = text,
                                    modifier = if (isFirst) Modifier.focusRequester(firstFocus) else Modifier,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    LaunchedEffect(state) {
        try {
            firstFocus.requestFocus()
        } catch (e: IllegalStateException) {
            // a primeira fileira ainda não foi desenhada; o foco vai para o primeiro item tocado
        }
    }
}

private fun keyOf(item: Item): String = when (item) {
    is Item.App -> "app:${item.pkg}"
    is Item.Input -> "input:${item.id}"
    Item.Settings -> "settings"
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun Tile(item: Item, layout: LayoutSpec, system: TvSystem, accent: Color, text: Color, modifier: Modifier) {
    val label = when (item) {
        is Item.App -> item.label
        is Item.Input -> item.label
        Item.Settings -> "Configurações"
    }
    Column(modifier.width(layout.cardWidthDp.dp)) {
        Card(
            onClick = {
                when (item) {
                    is Item.App -> system.openApp(item.pkg)
                    is Item.Input -> system.openInput(item.id)
                    Item.Settings -> system.openSettings()
                }
            },
            modifier = Modifier.size(layout.cardWidthDp.dp, layout.cardHeightDp.dp),
            scale = if (layout.animations) CardDefaults.scale() else CardDefaults.scale(focusedScale = 1f),
        ) {
            Box(Modifier.fillMaxSize().background(accent.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                if (item is Item.App) {
                    val bitmap = rememberArtwork(item.pkg, layout, system)
                    if (bitmap != null) {
                        Image(bitmap.asImageBitmap(), contentDescription = label, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
                    } else {
                        Text(label, color = text, textAlign = TextAlign.Center, maxLines = 2)
                    }
                } else {
                    Text(if (item is Item.Settings) "⚙  $label" else "⎆  $label", color = text, textAlign = TextAlign.Center, maxLines = 2)
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(label, color = text.copy(alpha = 0.8f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun rememberArtwork(pkg: String, layout: LayoutSpec, system: TvSystem): Bitmap? {
    val density = LocalDensity.current
    val w = with(density) { layout.cardWidthDp.dp.roundToPx() }
    val h = with(density) { layout.cardHeightDp.dp.roundToPx() }
    val bitmap by produceState<Bitmap?>(initialValue = null, pkg, w, h) {
        val loaded = withContext(Dispatchers.IO) { system.artwork(pkg, w, h) }
        value = loaded
    }
    return bitmap
}

@Composable
private fun Clock(format24h: Boolean, color: Color) {
    val pattern = if (format24h) "HH:mm" else "h:mm a"
    val now by produceState(initialValue = Date()) {
        while (true) {
            value = Date()
            delay(15_000)
        }
    }
    Text(SimpleDateFormat(pattern, Locale.forLanguageTag("pt-BR")).format(now), color = color, fontSize = 22.sp)
}
