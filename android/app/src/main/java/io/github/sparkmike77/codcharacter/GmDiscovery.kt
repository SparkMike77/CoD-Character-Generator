package io.github.sparkmike77.codcharacter

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import org.json.JSONObject
import java.net.Inet4Address

/**
 * Finds GMScreens on the local network: they advertise "_gmscreen._tcp" over mDNS with TXT records
 * id and name (gmscreen/src/gm-server.js). Reports each as "gm-up" {id, name, host, port} and, when
 * it goes away, "gm-down" {id} - the same events the desktop app's Bonjour browser produces, which
 * android/web/shims/bonjour.js turns back into that browser's shape.
 */
class GmDiscovery(context: Context, private val report: (String, JSONObject) -> Unit) {
    private val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
    private var multicastLock: WifiManager.MulticastLock? = null
    private var listener: NsdManager.DiscoveryListener? = null

    /** service name -> GMScreen id, so a lost service (reported by name only) can be reported by id. */
    private val idsByName = mutableMapOf<String, String>()

    // Before Android 14, NsdManager resolves one service at a time (a second resolve fails with
    // FAILURE_ALREADY_ACTIVE), so found services queue up.
    private val resolveQueue = ArrayDeque<NsdServiceInfo>()
    private var resolving = false

    fun start() {
        if (listener != null) return
        // Many devices drop multicast packets (and so mDNS answers) to save power without this.
        multicastLock = wifi.createMulticastLock("cod-gmscreen").apply {
            setReferenceCounted(false)
            acquire()
        }
        val l = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) { stop() }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}

            override fun onServiceFound(service: NsdServiceInfo) = enqueue(service)

            override fun onServiceLost(service: NsdServiceInfo) {
                synchronized(this@GmDiscovery) { idsByName.remove(service.serviceName) }
                    ?.let { report("gm-down", JSONObject().put("id", it)) }
            }
        }
        listener = l
        nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, l)
    }

    fun stop() {
        listener?.let { runCatching { nsd.stopServiceDiscovery(it) } }
        listener = null
        multicastLock?.let { if (it.isHeld) it.release() }
        multicastLock = null
        synchronized(this) {
            resolveQueue.clear()
            idsByName.clear()
        }
    }

    @Synchronized
    private fun enqueue(service: NsdServiceInfo) {
        resolveQueue.addLast(service)
        resolveNext()
    }

    @Synchronized
    private fun resolveNext() {
        if (resolving || listener == null) return
        val next = resolveQueue.removeFirstOrNull() ?: return
        resolving = true
        @Suppress("DEPRECATION")
        nsd.resolveService(next, object : NsdManager.ResolveListener {
            override fun onResolveFailed(service: NsdServiceInfo, errorCode: Int) = done()

            override fun onServiceResolved(service: NsdServiceInfo) {
                reportResolved(service)
                done()
            }
        })
    }

    @Synchronized
    private fun done() {
        resolving = false
        resolveNext()
    }

    private fun reportResolved(service: NsdServiceInfo) {
        val txt = service.attributes
        val id = txt["id"]?.let { String(it, Charsets.UTF_8) } ?: return
        val name = txt["name"]?.let { String(it, Charsets.UTF_8) } ?: service.serviceName
        val host = ipv4Of(service) ?: return
        synchronized(this) { idsByName[service.serviceName] = id }
        report(
            "gm-up",
            JSONObject().put("id", id).put("name", name).put("host", host).put("port", service.port),
        )
    }

    /** An IPv4 address, as the desktop app prefers: the GM's link-local IPv6 isn't reliably reachable. */
    private fun ipv4Of(service: NsdServiceInfo): String? {
        val addresses = if (Build.VERSION.SDK_INT >= 34) service.hostAddresses else listOfNotNull(@Suppress("DEPRECATION") service.host)
        return (addresses.firstOrNull { it is Inet4Address } ?: addresses.firstOrNull())?.hostAddress
    }

    companion object {
        private const val SERVICE_TYPE = "_gmscreen._tcp"
    }
}
