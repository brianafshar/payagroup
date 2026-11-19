package expo.modules.baselinepushe

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Built without Pushe (no PUSHE_MANIFEST_TOKEN): same API, never registered. */
class BaselinePusheModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BaselinePushe")
    Function("isRegistered") { false }
    AsyncFunction("getDeviceId") { _: Int -> null as String? }
  }
}
