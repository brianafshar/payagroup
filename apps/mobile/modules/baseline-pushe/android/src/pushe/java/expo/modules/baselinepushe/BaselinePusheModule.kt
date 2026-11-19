package expo.modules.baselinepushe

import android.os.Handler
import android.os.Looper
import co.pushe.plus.Pushe
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The few Pushe calls the app needs: its device id (once registered) to register the phone with our API. */
class BaselinePusheModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BaselinePushe")

    Function("isRegistered") { Pushe.isRegistered() }

    /** Resolves with Pushe's device id after registration, or null after `timeoutMs`. */
    AsyncFunction("getDeviceId") { timeoutMs: Int, promise: Promise ->
      if (Pushe.isRegistered()) {
        promise.resolve(Pushe.getDeviceId())
        return@AsyncFunction
      }
      var done = false
      val main = Handler(Looper.getMainLooper())
      main.postDelayed({
        if (!done) {
          done = true
          promise.resolve(if (Pushe.isRegistered()) Pushe.getDeviceId() else null)
        }
      }, timeoutMs.toLong())
      Pushe.setRegistrationCompleteListener {
        main.post {
          if (!done) {
            done = true
            promise.resolve(Pushe.getDeviceId())
          }
        }
      }
    }
  }
}
