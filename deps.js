(function (a) { a.QueryParamDeviceIdRequestSigner = function (a) { this.deviceType = a.deviceType; this.deviceSerial = a.deviceSerialNumber }; a.QueryParamDeviceIdRequestSigner.prototype.signRequest = function (a) { return a + "?x-amz-device-type=" + this.deviceType + "&x-amz-device-serial=" + this.deviceSerial } })(window.tcomm = window.tcomm || {});
(function (a) { a.FrogLog = {}; a.FrogLog.log = function (a, d) { console.log(b.apply(this, arguments)) }; var b = function (a, b) { var f = "[" + a + "] " + b; if (2 < arguments.length) { for (var k = " - ", h = 2; h < arguments.length; h++)k += arguments[h], 0 === h % 2 ? k += ": " : h < arguments.length - 1 && (k += ", "); f += k } return f } })(window.tcomm = window.tcomm || {});
(function (a) { a.QueryParamTokenRequestSigner = function (a) { this.accessToken = a }; a.QueryParamTokenRequestSigner.prototype.signRequest = function (a) { return a + "?x-amz-access-token=" + this.accessToken } })(window.tcomm = window.tcomm || {});
(function (a) {
a.Channels = {
    INVALID_CHANNEL_ID: -1, CHANNEL_FOR_HEARTBEAT: 101, CHANNEL_FOR_SINGLE_METRICS: 105, CHANNEL_FOR_BATCHED_METRICS: 106, CHANNEL_FOR_SYSTEM_MESSAGES: 120, RMR_TEST_CHANNEL: 200, RMR_THREADING_TEST_CHANNEL: 201, RMR_N_TIMES_TEST_CHANNEL: 202, GMD_CHANNEL: 463, CHANNEL_FOR_S2DM: 480, CHANNEL_FOR_S2DM_ACK: 481, GW_HANDSHAKE_CHANNEL: 865, GW_CHANNEL: 866, GW_CTL_CHANNEL: 867, CHANNEL_FOR_DEGS: 1026, RAW_MESSAGE_CHANNEL_FOR_DEGS: 1026, DEE_WEBSITE_MESSAGING: 46201, CHANNEL_FOR_LOOPBACK: 1048568, DROP_DATA_TEST_CHANNEL: 1048569,
    HEARTBEAT_TEST_CHANNEL: 1048570, GATEWAY_TRANSPARENT_TEST_CHANNEL: 1048571, DEMO_SEND_MESSAGE_TEST_CHANNEL: 1048572, GATEWAY_ECHO_TEST_CHANNEL: 1048573, CHANNEL_FOR_ECHO_2_CHANNEL_TEST: 1048574, CHANNEL_FOR_ECHO_TEST: 1048575, REQUEST_RESPONSE_CHANNEL_ID_START: 1048577
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.CommunicationManager = {}; a.CommunicationManager.initializeWithConfig = function (a) { this.initialize(a.requestSigner, a.domain, a.realm, a.shouldEnableGateway, { heartbeatIntervalMillis: a.heartbeatIntervalMillis }) }; a.CommunicationManager.initialize = function (b, c, k, h, l) {
    if (!0 === this.isInitialized) a.FrogLog.log("CommunicationManager", "aborting CommunicationManager initialization routine - already initialized"); else if (c = c || "prod", k = k || "USAmazon", h = h || !1, l = l || {}, a.FrogLog.log("CommunicationManager",
        "initializing with config", "domain", c, "realm", k, "shouldEnableGateway", h, "heartbeatConfig", JSON.stringify(l)), this.requestSigner = b, this.identityResolver = new a.IdentityResolver(c, k), this.msgRouter = new a.MessageRouter, this.responseRouter = new a.ResponseRouter(this.msgRouter), this.heartbeatManager = new a.HeartbeatManager(this.msgRouter, l), this.activeProtocolSockets = {}, this.isInitialized = !0, h) if (b = a.GatewayFloodProtector.calculateBackOffMs(), 0 === b) this.enableGateway(); else throw "Gateway service connection throttled! Please wait for " +
            b + " ms before trying again.";
}; a.CommunicationManager.acquireConnection = function (d, f, k) {
    c(this, "Could not de-register message handler! CommunicationManager was  not initialized!"); var h = {}; if (d instanceof a.ServiceIdentity && k) {
        d = this.identityResolver.getEndpointForServiceName(d.serviceName); if (!d) throw "Could not find endpoint for identity!"; if (f && !d.securePort) throw "Could not find an endpoint with the desired security level!"; if (d.directConnection === a.ServiceEndpoint.DirectConnection.NOT_ALLOWED) throw "Could not find an endpoint that allows direct connections!";
        h = b(this, d, f)
    } else if (d instanceof a.DeviceIdentity || !k && d instanceof a.ServiceIdentity) this.rawGatewayProtocolSocket && this.rawGatewayProtocolSocket.isOpenOrOpening() || this.enableGateway(), h = d instanceof a.ServiceIdentity ? new a.GatewayProtocolSocket(this.rawGatewayProtocolSocket, d, this.gwProtocolHandler) : new a.DeviceGatewayProtocolSocket(this.rawGatewayProtocolSocket, d, this.gwProtocolHandler, this.controlProtocolHandler, this.msgRouter, this.responseRouter); else throw "Cannot create connection for unrecognized identity type!";
    return new a.Connection(h, this.responseRouter)
}; a.CommunicationManager.registerMessageHandler = function (a, b) { c(this, "Could not register message handler! CommunicationManager was not initialized!"); this.msgRouter.addRoute(a, b) }; a.CommunicationManager.deregisterMessageHandler = function (a) { c(this, "Could not de-register message handler! CommunicationManager was not initialized!"); this.msgRouter.removeRoutes(a) }; a.CommunicationManager.enableGateway = function () {
    c(this, "Could not enable Gateway! CommunicationManager not initialized!");
    this.rawGatewayProtocolSocket && this.rawGatewayProtocolSocket.isOpen() && a.FrogLog.log("CommunicationManager", "enableGateway was called but the Gateway socket is already enabled"); 
    var d = this.identityResolver.getEndpointForServiceName("DPGwService"); if ("undefined" === typeof d) throw "No Gateway service endpoint found! Could not enable Gateway!"; this.rawGatewayProtocolSocket = b(this, d, !0); this.gwProtocolHandler = new a.GatewayProtocolHandler(a.HexCodec); this.controlProtocolHandler = new a.GatewayControlProtocolHandler(a.HexCodec);
    this.routedGatewayProtocolSocket = new a.GatewayProtocolSocket(this.rawGatewayProtocolSocket, a.IdentityFactory.getServiceIdentityFromName("DPGwService"), this.gwProtocolHandler, this.msgRouter, this.responseRouter); var f = this; this.routedGatewayProtocolSocket.addOpenListener(function () { a.GatewayFloodProtector.gatewayConnectionOpened(); f.onGatewayConnectionOpened() }); this.routedGatewayProtocolSocket.addCloseListener(function (b) { a.GatewayFloodProtector.gatewayConnectionClosed(b); f.onGatewayConnectionClosed(b) });
    this.echoMessageHandler = new a.EchoMessageHandler(this, this.msgRouter)
}; a.CommunicationManager.isGatewayEnabled = function () { return this.routedGatewayProtocolSocket.isOpen() }; a.CommunicationManager.onGatewayConnectionOpened = function () { }; a.CommunicationManager.onGatewayConnectionClosed = function () { }; a.CommunicationManager.shutdown = function () { this.isInitialized = !1; for (url in this.activeProtocolSockets) { var b = this.activeProtocolSockets[url]; b instanceof a.ProtocolSocket && b.close() } }; var b = function (b, c, k) {
    var h =
        c.asUri(k); b.requestSigner && (h = b.requestSigner.signRequest(h)); k = b.activeProtocolSockets[h]; if (k instanceof a.ProtocolSocket) return k; var l = new a.ProtocolSocket(h, new a.TuningHandler, b.msgRouter, b.responseRouter, c); b.heartbeatManager.manageHeartbeatForSocket(l); l.addOpenListener(function () { b.activeProtocolSockets[h] = l }); l.addCloseListener(function () { delete b.activeProtocolSockets[h] }); l.open(); return l
}, c = function (a, b) { if (!a.isInitialized) throw b; }
})(window.tcomm = window.tcomm || {});
(function (a) { a.MessageProtocols = [{ protocolName: "A:H", parameters: { "AlphaProtocolHandler.receiveWindowSize": "16", "AlphaProtocolHandler.maxFragmentSize": "16000" } }]; a.ProtocolImpls = { "A:H": "AlphaProtocolHandler" } })(window.tcomm = window.tcomm || {});
(function (a) {
    function b(a) { if ("string" === typeof a) return strToAb(a); if (a instanceof ArrayBuffer) return a; throw "Message must either be a string or an arraybuffer!"; } a.Connection = function (a, b) { this.protocolSocket = a; this.responseRouter = b }; a.Connection.prototype.addOpenListener = function (a) { this.protocolSocket.addOpenListener(a) }; a.Connection.prototype.addCloseListener = function (a) { this.protocolSocket.addCloseListener(a) }; a.Connection.prototype.getState = function () { return this.protocolSocket.state }; a.Connection.prototype.isOpen =
        function () { return this.protocolSocket.isOpen() }; a.Connection.prototype.sendMessage = function (a, d) { try { a = b(a), this.protocolSocket.sendMessage(a, d) } catch (f) { throw "Connection could not send outgoing message: " + f; } }; a.Connection.prototype.sendRequest = function (a, d, f, k) { try { msg = b(a + " " + d + " HTTP/1.1\r\n\r\n" + f), channel = this.responseRouter.registerResponseHandler(k), this.protocolSocket.sendRequest(msg, channel) } catch (h) { throw "Connection could not send outgoing request: " + h; } }; a.Connection.prototype.release =
            function () { this.protocolSocket = {} }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.DeviceToDeviceCommunicationManager = {}; a.DeviceToDeviceCommunicationManager.initialize = function (a, c) { this.appName = c; this.commManager = a }; a.DeviceToDeviceCommunicationManager.notifyRemoteDeviceForD2DCommunication = function (b, c, d, f, k) {
    connection = this.commManager.acquireConnection(a.IdentityFactory.getServiceIdentityFromName("D2DNotificationService"), !0, !1); connection.sendRequest("POST", "/makeD2DConnectionRequest", '{"sourceApplication": "' + this.appName + '", "targetDevice":   {"deviceType": "' +
        b + '", "deviceSerial": "' + c + '"}, "targetApplication": "' + d + '", "extra": "' + f + '"}', k); connection.release()
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.EchoMessage = {}; a.EchoMessage.Header = { PING_HEADER: "PIN", PONG_HEADER: "PON", LENGTH: 3 }; a.EchoMessageHandler = function (b, c) { this.communicationManager = b; this.channel = a.Channels.GATEWAY_ECHO_TEST_CHANNEL; var d = this; c.addRoute(this.channel, function (a, b) { d.onMessage(a, b) }) }; a.EchoMessageHandler.prototype.onMessage = function (b, c) {
    var d = c.getPayloadAsBuffer(), f = !1; if (d.byteLength > a.EchoMessage.Header.LENGTH) {
        for (var f = a.EchoMessage.Header.LENGTH, k = new Uint8Array(d, 0, f), h = [], l = 0; l < f; l++)h.push(String.fromCharCode(k[l]));
        f = h.join("") === a.EchoMessage.Header.PING_HEADER
    } if (f) {
        a.FrogLog.log("EchoMessageHandler", "received a PING message"); for (var f = this.communicationManager.acquireConnection(b, !0, !1), k = new ArrayBuffer(d.byteLength), h = a.EchoMessage.Header.PONG_HEADER, l = new Uint8Array(k, 0, h.length), e = 0; e < h.length; e++)l[e] = h.charCodeAt(e); for (var h = a.EchoMessage.Header.LENGTH, l = new Uint8Array(k, a.EchoMessage.Header.LENGTH, d.byteLength - h), e = new Uint8Array(d, h), g = 0; g < d.byteLength - h; g++)l[g] = e[g]; a.FrogLog.log("EchoMessageHandler",
            "sending PONG message", "this.channel", this.channel); f.sendMessage(k, this.channel)
    } else a.FrogLog.log("EchoMessageHandler", "received a non-PING message - ignoring")
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.GatewayFloodProtector = { COOKIE_TIMESTAMP: "gw-timestamp", COOKIE_PENALTY: "gw-penalty", COOKIE_LIFETIME_DAYS: 1, RESET_MULTIPLIER: 3, EXPONENTIAL_FACTOR: 2, FUDGE_FACTOR: 0.1, PENALTY_FLOOR_MS: 1E4, PENALTY_CEILING_MS: 36E5 }; a.GatewayFloodProtector.calculateBackOffMs = function () {
    var c = 0, d = getCookie(a.GatewayFloodProtector.COOKIE_TIMESTAMP), f = getCookie(a.GatewayFloodProtector.COOKIE_PENALTY); a.FrogLog.log("GatewayFloodProtector", "calculateBackOffMs", "timestamp", d, "penalty", f); if (null != d && "" != d && null !=
        f && "" != f) { var d = new Date(d), f = parseInt(f), d = d.getTime(), k = (new Date).getTime(); k > d + a.GatewayFloodProtector.RESET_MULTIPLIER * f ? b() : (c = Math.max(d - k, 0), a.FrogLog.log("GatewayFloodProtector", "must wait before next legal connection attempt", "backOffMs", c)) } return c
}; a.GatewayFloodProtector.gatewayConnectionOpened = function () {
    var b = getCookie(a.GatewayFloodProtector.COOKIE_TIMESTAMP), d = getCookie(a.GatewayFloodProtector.COOKIE_PENALTY); a.FrogLog.log("GatewayFloodProtector", "gatewayConnectionOpened", "oldTimestamp",
        b, "oldPenalty", d); if (null != b && "" != b && null != d && "" != d) {
            b = new Date(b); d = parseInt(d); b = new Date(b.getTime() + d); a.FrogLog.log("GatewayFloodProtector", "calculateNewTimestamp", "result.toUTCString()", b.toUTCString()); var f = d, d = a.GatewayFloodProtector.EXPONENTIAL_FACTOR * f, f = a.GatewayFloodProtector.FUDGE_FACTOR * Math.random() * f, d = Math.max(Math.floor(d + f), a.GatewayFloodProtector.PENALTY_FLOOR_MS), d = Math.min(d, a.GatewayFloodProtector.PENALTY_CEILING_MS); a.FrogLog.log("GatewayFloodProtector", "calculateNewPenalty",
                "result", d)
        } else b = new Date, d = a.GatewayFloodProtector.PENALTY_FLOOR_MS; setCookie(a.GatewayFloodProtector.COOKIE_TIMESTAMP, b.toUTCString(), a.GatewayFloodProtector.COOKIE_LIFETIME_DAYS); setCookie(a.GatewayFloodProtector.COOKIE_PENALTY, d, a.GatewayFloodProtector.COOKIE_LIFETIME_DAYS); a.FrogLog.log("GatewayFloodProtector", "wrote cookies", "newTimestamp.toUTCString()", b.toUTCString(), "newPenalty", d)
}; a.GatewayFloodProtector.gatewayConnectionClosed = function (c) {
null !== c && c.code === a.CloseStatusCodes.SERVER_EXISTING_CONNECTION_NOT_OLD ?
    a.FrogLog.log("GatewayFloodProtector", "The gateway service suggests this device must throttle its connections") : b()
}; var b = function () { clearCookie(a.GatewayFloodProtector.COOKIE_TIMESTAMP); clearCookie(a.GatewayFloodProtector.COOKIE_PENALTY); a.FrogLog.log("GatewayFloodProtector", "cleared timestamp and penalty cookies") }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.GatewayHandshakeHandler = function (b) { this.protocolHandler = new a.GatewayHandshakeProtocolHandler(a.HexCodec); this.msgRouter = b }; a.GatewayHandshakeHandler.prototype.initHandshake = function (b, c, d) {
    if (this.msgRouter instanceof a.MessageRouter) {
        var f = this; this.msgRouter.addRoute(a.Channels.GW_HANDSHAKE_CHANNEL, function (b, c) {
            var l = !1; try { l = f.protocolHandler.decodeAcknowledgeMessage(c.getPayloadAsBuffer()) == a.GatewayHandshakeProtocol.OverallStatusCodes.OK } catch (e) {
                a.FrogLog.log("GatewayHandshakeHandler",
                    "a decoding error occurred", "err", e)
            } d(l); f.msgRouter.removeRoutes(a.Channels.GW_HANDSHAKE_CHANNEL)
        }); c = this.protocolHandler.encodeInitiateMessage(c); b.sendMessage(c, a.Channels.GW_HANDSHAKE_CHANNEL)
    }
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.TuningHandler = function () { this.tuningProtocol = new a.TuningProtocolHandler(a.HexCodec) }; a.TuningHandler.prototype.initTuningHandshake = function (b, c) {
    for (var d = a.MessageProtocols, f = [], k = 0; k < d.length; k++)f.push(d[k].protocolName); var d = this.tuningProtocol.encodeMessage(f.join()), h = this, l = !1; b.addMessageListener(function (e) {
        if (!l) {
            try { var d = h.tuningProtocol.decodeMessage(e) } catch (f) { a.FrogLog.log("TuningHandler", "a tuning response error occurred", "err.message", f.message), c(!1) } e = d.protocolName;
            for (var d = a.MessageProtocols, k = 0; k < d.length; k++)if (d[k].protocolName === e) { var u = d[k]; break } u || (a.FrogLog.log("TuningHandler", "server selected unsupported TComm protocol"), c(!1)); e = a[a.ProtocolImpls[u.protocolName]]; "undefined" === typeof e && (a.FrogLog.log("TuningHandler", "no client-side handler implementation for the selected protocol"), c(!1)); d = h.tuningProtocol.encodeMessage(JSON.stringify(u)); b.sendMessage(d); c(!0, new e(u.parameters, a.HexCodec)); l = !0
        }
    }); a.FrogLog.log("TuningHandler", "sending tuning message",
        "tuningMsg", abToStr(d)); b.sendMessage(d)
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.HeartbeatManager = function (b, c) { this.heartbeatIntervalMillis = c.heartbeatIntervalMillis || 18E4; this.heartbeatCommunicator = new a.HeartbeatCommunicator(b, c); this.activeProtocolSockets = {}; this.pendingHeartbeatIds = {}; var k = this; this.heartbeatCommunicator.onHeartbeatReceived = function (a) { k.onHeartbeatResponse(a) }; this.heartbeatCommunicator.onHeartbeatTimedOut = function (a) { k.onHeartbeatTimeout(a) } }; a.HeartbeatManager.prototype.onHeartbeatResponse = function (d) {
    a.FrogLog.log("HeartbeatManager", "got heartbeat response for socket",
        "socketId", d); d = this.activeProtocolSockets[d]; d instanceof a.ProtocolSocket && (c(this, d), b(this, d))
}; a.HeartbeatManager.prototype.onHeartbeatTimeout = function (b) { a.FrogLog.log("HeartbeatManager", "socket timed out - closing immediately", "socketId", b); b = this.activeProtocolSockets[b]; b instanceof a.ProtocolSocket && b.close(a.CloseStatusCodes.HEARTBEAT_FAILURE) }; a.HeartbeatManager.prototype.manageHeartbeatForSocket = function (d) {
    if (!(d instanceof a.ProtocolSocket)) throw TypeError("protocolSocket must be an instance of tcomm.ProtocolSocket");
    var f = this; d.addOpenListener(function () { a.FrogLog.log("HeartbeatManager", "socket opened - starting heartbeat for socket", "protocolSocket.id", d.id); f.activeProtocolSockets[d.id] = d; b(f, d) }); d.addCloseListener(function () { a.FrogLog.log("HeartbeatManager", "socket closed - stopping heartbeat for socket", "protocolSocket.id", d.id); c(f, d); delete f.activeProtocolSockets[d.id] })
}; var b = function (a, b) {
    var c = setTimeout(function () { a.heartbeatCommunicator.sendPing(b) }, a.heartbeatIntervalMillis); a.pendingHeartbeatIds[b.id] =
        c
}, c = function (a, b) { var c = a.pendingHeartbeatIds[b.id]; c && clearTimeout(c); delete a.pendingHeartbeatIds[b.id] }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.Heartbeat = {}; a.Heartbeat.Header = { PING_HEADER: "PIN", PONG_HEADER: "PON", LENGTH: 3 }; a.Heartbeat.HeartbeatRecord = function (a, b) { this.timeoutId = a; this.retryCount = b }; a.HeartbeatCommunicator = function (b, c) { this.timeoutMillis = c.timeoutMillis || 3E3; this.maxRetries = c.maxRetries || 2; this.pendingHeartbeats = {}; this.heartbeatChannel = a.Channels.CHANNEL_FOR_HEARTBEAT; this.msgRouter = b; var k = this; this.msgRouter.addRoute(this.heartbeatChannel, function (a, b) { k.onPongMessageBuffer(b.getPayloadAsBuffer()) }) }; a.HeartbeatCommunicator.prototype.sendPing =
    function (c) {
        if (!(c instanceof a.ProtocolSocket)) throw new TypeError("Unable to send heartbeat. Protocol socket was not the expected type."); try { for (var f, k = a.Heartbeat.Header.PING_HEADER, h = c.purpose, l = c.id, e = Date.now(), g = h.length, n = new ArrayBuffer(k.length + 4 + 8 + 4 + 2 * g), w = 0, u = new Uint8Array(n, w, k.length), q = 0; q < k.length; q++)u[q] = k.charCodeAt(q); w += k.length; b(n, l, w, 4); w += 4; b(n, e, w, 8); w += 8; b(n, g, w, 4); for (var y = new DataView(n, w + 4), k = 0; k < h.length; k++)y.setUint16(2 * k, h.charCodeAt(k)); f = n } catch (m) {
            a.FrogLog.log("HeartbeatCommunicator",
                "unable to send heartbeat - could not write message buffer", "err", m); return
        } this.pendingHeartbeats[c.id] = new a.Heartbeat.HeartbeatRecord("", this.maxRetries); this.sendPingMessageBuffer(c, f)
    }; a.HeartbeatCommunicator.prototype.shutdown = function () { this.msgRouter.removeRoutes(a) }; a.HeartbeatCommunicator.prototype.onHeartbeatComplete = function () { }; a.HeartbeatCommunicator.prototype.onHeartbeatTimedOut = function () { }; a.HeartbeatCommunicator.prototype.sendPingMessageBuffer = function (b, c) {
        b.sendMessage(c, this.heartbeatChannel);
        var k = this.pendingHeartbeats[b.id], h = this, l = setTimeout(function () { a.FrogLog.log("HeartbeatCommunicator", "heartbeat timed out for socket", "protocolSocket.id", b.id); 0 < k.retryCount ? (a.FrogLog.log("HeartbeatCommunicator", "........retrying"), k.retryCount-- , h.sendPingMessageBuffer(b, c)) : (a.FrogLog.log("HeartbeatCommunicator", "no more retries - notifying listener"), h.onHeartbeatTimedOut(b.id)) }, this.timeoutMillis); k.timeoutId = l
    }; a.HeartbeatCommunicator.prototype.onPongMessageBuffer = function (b) {
        var f, k; try {
            for (var h =
                0, l, e = a.Heartbeat.Header.LENGTH, g = new Uint8Array(b, h, e), n = [], w = 0; w < e; w++)n.push(String.fromCharCode(g[w])); l = n.join(""); var h = h + l.length, u = c(b, h, 4), h = h + 4; c(b, h, 8); var h = h + 8, q = c(b, h, 4), h = h + 4, e = [], y = new DataView(b, h, 2 * q); for (b = 0; b < q; b++)e.push(String.fromCharCode(y.getUint16(2 * b))); e.join(""); f = l; k = u
        } catch (m) { a.FrogLog.log("HeartbeatCommunicator", "unable to handle heartbeat response - error reading incoming buffer", "err", m); return } f !== a.Heartbeat.Header.PONG_HEADER ? a.FrogLog.log("HeartbeatCommunicator",
            "could not handle heartbeat response - unexpected header") : (f = k, this.pendingHeartbeats[f] ? (clearTimeout(this.pendingHeartbeats[f].timeoutId), delete this.pendingHeartbeats[f], this.onHeartbeatReceived(f)) : a.FrogLog.log("HeartbeatCommunicator", "received stale heartbeat for socket - ignoring", "socketId", f))
    }; var b = function (a, b, c, h) { a = new Uint8Array(a, c, h); for (c = 0; c < h; c++)a[c] = b >> 8 * (h - 1 - c) & 255 }, c = function (a, b, c) { a = new Uint8Array(a, b, c); for (var h = b = 0; h < c; h++)b = (b << 8) + a[h]; return b }
})(window.tcomm = window.tcomm ||
{});

(function (a) {
a.IRConfig = {}; a.IRConfig.initializeDefaultServiceEndpoints = function () {
a.ServiceNameToEndpointMap = {
    DPDemoService: {
        alpha: { USAmazon: new a.ServiceEndpoint("dp-demo-alpha.integ.amazon.com", 80, 443, a.ServiceEndpoint.DirectConnection.ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 6E4) }, test: { USAmazon: new a.ServiceEndpoint("dp-demo.integ.amazon.com", 80, 443, a.ServiceEndpoint.DirectConnection.ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 6E4) },
        master: { USAmazon: new a.ServiceEndpoint("dp-demo-preprod.integ.amazon.com", 80, 443, a.ServiceEndpoint.DirectConnection.ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 6E4) }, prod: { USAmazon: new a.ServiceEndpoint("dp-demo.amazon.com", null, 443, a.ServiceEndpoint.DirectConnection.ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4) }
    }, 
    DPGwService: {
        alpha: {
            USAmazon: new a.ServiceEndpoint("dp-gw-alpha.integ.amazon.com", 80, 443,
                a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 6E4)
        }, 
        test: {
            USAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.com", 80, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 6E4), GBAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.co.uk", 80, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED,
                6E4), DEAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.de", 80, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 6E4), JPAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.co.jp", 80, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 6E4), INAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.in", 80, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED,
                    a.ServiceEndpoint.ClearText.ALLOWED, 6E4), FRAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.fr", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), ITAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.it", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), NLAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.nl", null, 443,
                        a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), CAAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.ca", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), MXAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.com.mx", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED,
                            6E4), BRAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.com.br", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), CNAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.cn", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), AUAmazon: new a.ServiceEndpoint("dp-gw.integ.amazon.com.au", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED,
                                a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4)
        }, master: {
            USAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.com", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), GBAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.co.uk", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4),
            DEAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.de", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), JPAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.co.jp", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), INAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.in", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED,
                a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), FRAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.fr", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), ITAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.it", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), NLAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.nl",
                    null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), CAAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.ca", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), MXAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.com.mx", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED,
                        a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), BRAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.com.br", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), CNAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.cn", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), AUAmazon: new a.ServiceEndpoint("dp-gw-preprod.amazon.com.au",
                            null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4)
        }, prod: {
            USAmazon: new a.ServiceEndpoint("dp-gw-na-js.amazon.com", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            GBAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.co.uk", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            DEAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.de", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            JPAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.co.jp", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            INAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.in", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            FRAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.fr", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            ITAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.it", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            NLAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.nl", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            CAAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.ca", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            MXAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.com.mx", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            BRAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.com.br", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            CNAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.cn", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4), 
            AUAmazon: new a.ServiceEndpoint("dp-gw-na.amazon.com.au", null, 443, a.ServiceEndpoint.DirectConnection.REQUIRED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4)
        }
    }, DPDiscoveryService: {
        alpha: { USAmazon: new a.ServiceEndpoint("localhost", 80, 443, a.ServiceEndpoint.DirectConnection.ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 1E4) }, test: { USAmazon: new a.ServiceEndpoint("dp-discovery.integ.amazon.com", 80, 443, a.ServiceEndpoint.DirectConnection.ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 1E4) },
        master: { USAmazon: new a.ServiceEndpoint("dp-discovery-preprod.amazon.com", 80, 443, a.ServiceEndpoint.DirectConnection.NOT_ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.ALLOWED, 1E4) }, prod: { USAmazon: new a.ServiceEndpoint("dp-discovery-na.amazon.com", null, 443, a.ServiceEndpoint.DirectConnection.NOT_ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 1E4) }
    }, D2DNotificationService: {
        alpha: {
            USAmazon: new a.ServiceEndpoint("dp-d2d-notif.integ.amazon.com",
                8308, 443, a.ServiceEndpoint.DirectConnection.NOT_ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4)
        }, test: { USAmazon: new a.ServiceEndpoint("dp-d2d-notif.integ.amazon.com", 8308, 443, a.ServiceEndpoint.DirectConnection.NOT_ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4) }, master: {
            USAmazon: new a.ServiceEndpoint("dp-d2d-notif-preprod.amazon.com", null, 443, a.ServiceEndpoint.DirectConnection.NOT_ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED,
                a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4)
        }, prod: { USAmazon: new a.ServiceEndpoint("dp-d2d-notif-backend.amazon.com", null, 443, a.ServiceEndpoint.DirectConnection.NOT_ALLOWED, a.ServiceEndpoint.DataCompression.NOT_NEEDED, a.ServiceEndpoint.ClearText.NOT_ALLOWED, 6E4) }
    }
}
}
})(window.tcomm = window.tcomm || {});
(function (a) {
    var b = /^urn:tcomm-endpoint:device(:deviceAccountId:([^:]*))?(:customerId:([^:]*))?(:deviceType:([^:]*))?(:deviceSerialNumber:([^:]*))?$/; a.DeviceIdentity = function (a, b, c, h) { if (!c || !h) throw "Device identity requires valid type and serial number strings."; a && b && (this.deviceAccountId = a, this.customerId = b); this.deviceType = c; this.deviceSerialNumber = h }; a.DeviceIdentity.prototype.asUrn = function () {
        var a = ["urn:tcomm-endpoint:device"]; c(a, "deviceAccountId", this.deviceAccountId); c(a, "customerId", this.customerId);
        c(a, "deviceType", this.deviceType); c(a, "deviceSerialNumber", this.deviceSerialNumber); return a.join(":")
    }; var c = function (a, b, c) { "undefined" !== typeof c && null !== c && (a.push(b), a.push(c)) }; a.DeviceIdentity.getFromUrn = function (c) { c = b.exec(c); return null === c ? null : new a.DeviceIdentity(c[1] ? c[2] : null, c[3] ? c[4] : null, c[5] ? c[6] : null, c[7] ? c[8] : null) }
})(window.tcomm = window.tcomm || {});
(function (a) { a.IdentityFactory = {}; a.IdentityFactory.getDeviceIdentity = function (b, c, d, f) { return new a.DeviceIdentity(f || "", d || "", b, c) }; a.IdentityFactory.getServiceIdentityFromName = function (b) { return new a.ServiceIdentity(b) }; a.IdentityFactory.getFromUrn = function (b) { var c = a.ServiceIdentity.getFromUrn(b); c || (c = a.DeviceIdentity.getFromUrn(b)); if (!c) throw "Could not parse identity from urn"; return c } })(window.tcomm = window.tcomm || {});
(function (a) { a.IdentityResolver = function (b, c) { this.domain = b; this.realm = c; a.IRConfig.initializeDefaultServiceEndpoints() }; a.IdentityResolver.prototype.getEndpointForServiceName = function (b) { return (b = (b = a.ServiceNameToEndpointMap[b]) ? b[this.domain] : void 0) ? b[this.realm] : void 0 } })(window.tcomm = window.tcomm || {});
(function (a) {
a.ServiceEndpoint = function (a, c, d, f, k, h, l) { this.hostname = a; this.directConnection = f; this.dataCompression = k; this.clearText = h; this.timeout = l; this.port = c; this.securePort = d }; a.ServiceEndpoint.prototype.asUri = function (a) { var c = "", d = ""; a ? (c = "wss://", d = this.securePort) : (c = "ws://", d = this.port); return c + this.hostname + ":" + d + "/" }; a.ServiceEndpoint.DirectConnection = { REQUIRED: "required", ALLOWED: "allowed", NOT_ALLOWED: "not allowed" }; a.ServiceEndpoint.ClearText = { ALLOWED: "allowed", NOT_ALLOWED: "not allowed" };
    a.ServiceEndpoint.DataCompression = { NEEDED: "needed", NOT_NEEDED: "not-needed" }
})(window.tcomm = window.tcomm || {});
(function (a) {
    var b = /^urn:tcomm-endpoint:service(:serviceName:([^:]*))?(:domain:([^:]*))?(:realm:([^:]*))?(:hostname:([^:]*))?(:port:([^:]*))?$/; a.ServiceIdentity = function (a, b, c, h, l) { if (!a) throw "Service identity requires valid name."; if (!(h && l || !h && !l)) throw "Service identity requires either a hostname AND a port, or neither."; this.serviceName = a; this.domain = b; this.realm = c; this.hostname = h; this.port = l }; a.ServiceIdentity.prototype.asUrn = function () {
        var a = ["urn:tcomm-endpoint:service", "serviceName", this.serviceName];
        c(a, "domain", this.domain); c(a, "realm", this.realm); c(a, "hostname", this.hostname); c(a, "port", this.port); return a.join(":")
    }; var c = function (a, b, c) { "undefined" !== typeof c && null !== c && (a.push(b), a.push(c)) }; a.ServiceIdentity.getFromUrn = function (c) { c = b.exec(c); return null === c ? null : new a.ServiceIdentity(c[1] ? c[2] : null, c[3] ? c[4] : null, c[5] ? c[6] : null, c[7] ? c[8] : null, c[9] ? c[10] : null) }
})(window.tcomm = window.tcomm || {});
(function (a) { a.Message = function (a, c, d) { this.channel = c; this.type = d; this.payloadBuf = a }; a.Message.prototype.getPayloadAsString = function () { return abToStr(this.payloadBuf) }; a.Message.prototype.getPayloadAsBuffer = function () { return this.payloadBuf }; a.GatewayMessage = function (b, c, d, f, k) { a.Message.call(this, b, c, d); this.originId = f; this.destId = k }; a.GatewayMessage.prototype = Object.create(a.Message.prototype) })(window.tcomm = window.tcomm || {});
(function (a) { a.MessageRouter = function () { this.messageRoutes = {} }; a.MessageRouter.prototype.addRoute = function (a, c) { var d = this.messageRoutes[a]; "undefined" === typeof d && (d = [], this.messageRoutes[a] = d); d.push(c) }; a.MessageRouter.prototype.removeRoutes = function (a) { this.messageRoutes[a] = [] }; a.MessageRouter.prototype.routeMessage = function (a, c) { var d = this.messageRoutes[c.channel]; if ("undefined" !== typeof d) for (var f = 0; f < d.length; f++)d[f](a, c) } })(window.tcomm = window.tcomm || {});
(function (a) {
a.AlphaProtocolHandler = function (a, c) { this.codec = c; this.footer = "FABE"; this.MESSAGE_MESSAGE_TYPE = "MSG"; this.REQUEST_MESSAGE_TYPE = "RQS"; this.RESPONSE_MESSAGE_TYPE = "RSP"; this.TYPE_LENGTH = 3; this.moreFlag = !1; this.seq = 1; this.DEFAULT_MAX_FRAGMENT_SIZE = 16E3; this.DEFAULT_RECEIVE_WINDOW_SIZE = 16; this.maxFragmentSize = a.maxFragmentSize || this.DEFAULT_MAX_FRAGMENT_SIZE; this.receiveWindowSize = a.receiveWindowSize || this.DEFAULT_RECEIVE_WINDOW_SIZE; this.chosenEncoding = a.chosenEncoding }; a.AlphaProtocolHandler.nextMsgId =
    Math.floor(1E9 * Math.random()); a.AlphaProtocolHandler.prototype.encodeMessage = function (a, c) { return this.encode(a, this.MESSAGE_MESSAGE_TYPE, c) }; a.AlphaProtocolHandler.prototype.encodeRequest = function (a, c) { return this.encode(a, this.REQUEST_MESSAGE_TYPE, c) }; a.AlphaProtocolHandler.prototype.encode = function (b, c, d) {
        if (b instanceof ArrayBuffer) { if ("number" !== typeof d) throw new TypeError("Channel must be a number!"); if ("string" !== typeof c) throw new TypeError("Type must be a string!"); } else throw new TypeError("Payload must be an ArrayBuffer!");
        var f = this.codec.INT_LENGTH, k = this.codec.DELIMITER.length, k = this.TYPE_LENGTH + k + f + k + f + k + this.codec.BOOL_LENGTH + k + f + k + f + k + f + k + b.byteLength + this.footer.length, f = new a.MessageBuffer(new ArrayBuffer(k), this.codec); f.appendASCIIString(c); f.appendInt(d); f.appendInt(a.AlphaProtocolHandler.nextMsgId++); f.appendBool(this.moreFlag); f.appendInt(this.seq); c = f.byteOffset; f.appendInt(0); d = f.byteOffset; f.appendInt(k); f.appendBuffer(b, !0); f.appendASCIIString(this.footer, !0); b = a.computeRFC1071LikeChecksum(f.buffer,
            c, d); f.byteOffset = c; f.appendInt(b); return f.buffer
    }; a.AlphaProtocolHandler.prototype.decodeMessage = function (b) {
        b = new a.MessageBuffer(b, this.codec); var c = b.readASCIIString(this.TYPE_LENGTH), d = b.readInt(); b.readInt(); b.readBool(); b.readInt(); var f = b.byteOffset, k = b.readInt(); if (!a.validateChecksum(k, b.buffer, f, b.byteOffset)) throw "Failed to decode tcomm message. Checksum mismatch!"; f = b.readInt() - this.footer.length - b.byteOffset; f = b.readBuffer(f, !0); if (b.readASCIIString(this.footer.length, !0) !== this.footer) throw "Failed to decode tcomm message. Footer mismatch!";
        return new a.Message(f, d, c)
    }
})(window.tcomm = window.tcomm || {});
(function (a) { function b(a, b) { for (a = c(a); 0 != b && 0 != a;)a = Math.floor(a / 2), b--; return a } function c(a) { 0 > a && (a = 4294967295 + a + 1); return a } a.computeRFC1071LikeChecksum = function (a, f, k) { if (k < f) throw "Invalid checksum exclusion window!"; a = new Uint8Array(a); for (var h = 0, l = 0, e = 0; e < a.length; e++)e != f ? (l += c(a[e] << ((e & 3 ^ 3) << 3)), h += b(l, 32), l = c(l & 4294967295)) : e = k - 1; for (; h;)l += h, h = b(l, 32), l &= 4294967295; return c(l) }; a.validateChecksum = function (b, f, k, h) { return a.computeRFC1071LikeChecksum(f, k, h) === c(b) } })(window.tcomm = window.tcomm ||
    {});
(function (a) {
a.GatewayControlProtocol = { MessageTypes: { DEVICE_AVAILABLE_REQUEST: "MESSAGE_TYPE_DEVICE_AVAILABLE_REQUEST", DEVICE_AVAILABLE_RESPONSE: "MESSAGE_TYPE_DEVICE_AVAILABLE_RESPONSE", DEVICE_AVAILABLE_NOTIFICATION: "MESSAGE_TYPE_DEVICE_AVAILABLE_NOTIFICATION" } }; a.GatewayControlProtocolHandler = function (a) { this.type = "CTL"; this.codec = a }; a.GatewayControlProtocolHandler.prototype.encodeMessage = function (b, c, d) {
    if ("string" !== typeof b) throw new TypeError("messageType must be a string!"); if (!(c instanceof a.DeviceIdentity ||
        c instanceof a.ServiceIdentity)) throw new TypeError("endpointIdentity must be either a DeviceIdentity or ServiceIdentity !"); b = JSON.stringify({ messageType: b, endpointIdentity: c.asUrn(), isAvailable: d }); c = new a.MessageBuffer(new ArrayBuffer(this.type.length + this.codec.DELIMITER.length + b.length), this.codec); c.appendASCIIString(this.type); c.appendASCIIString(b, !0); return c.buffer
}; a.GatewayControlProtocolHandler.prototype.decodeMessage = function (b) {
    var c = new a.MessageBuffer(b, this.codec); b = b.byteLength;
    var d = c.readASCIIString(this.type.length); if (this.type !== d) throw "Failed to decode Gateway control message. Unexpected message type: " + d; c = c.readASCIIString(b - c.byteOffset, !0); try { return JSON.parse(c) } catch (f) { throw "Failed to decode Gateway control message. Payload was not valid JSON"; }
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.GatewayHandshakeProtocol = { Types: { INITIATE: "INI", ACKNOWLEDGE: "ACK", SIZE: 3 }, Sections: { INFORMATION: "ACI", RESULT: "ACR", SIZE: 3 }, OverallStatusCodes: { OK: 100, OK_TRANSIENT_FAILURE: 200, OK_NON_TRANSIENT_FAILURE: 300, TRANSIENT_FAILURE: 400, NON_TRANSIENT_FAILURE: 500 }, AccountStatusCodes: { OK: 100, TRANSIENT_FAILURE: 200, NON_TRANSIENT_FAILURE: 300, AUTHENTICATION_FAILURE: 303 }, PROTOCOL_VERSION: "1.0" }; a.GatewayHandshakeProtocolHandler = function (a) { this.footer = "END"; this.codec = a }; a.GatewayHandshakeProtocolHandler.prototype.encodeInitiateMessage =
    function (b) {
        var c = a.GatewayHandshakeProtocol.Types.INITIATE, d = generateUUID(), f = Date.now(), k = a.GatewayHandshakeProtocol.PROTOCOL_VERSION, h = this.codec.DELIMITER.length, h = new a.MessageBuffer(new ArrayBuffer(c.length + h + a.HexCodec.INT_LENGTH + k.length + 2 * h + a.HexCodec.INT_LENGTH + d.length + 2 * h + a.HexCodec.LONG_LENGTH + h + this.footer.length + h), this.codec); h.appendASCIIString(c); h.appendInt(k.length); h.appendASCIIString(k); h.appendInt(d.length); h.appendASCIIString(d); h.appendLong(f); if (0 < b.length) throw "Secondary account authentication is presently unimplemented";
        h.appendASCIIString(this.footer); return h.buffer
    }; a.GatewayHandshakeProtocolHandler.prototype.decodeAcknowledgeMessage = function (b) {
        b = new a.MessageBuffer(b, this.codec); if (b.readASCIIString(a.GatewayHandshakeProtocol.Types.SIZE) !== a.GatewayHandshakeProtocol.Types.ACKNOWLEDGE) throw "Failed to decode Gateway acknowledge message. Incorrect type!"; var c = b.readInt(); if (b.readASCIIString(c) !== a.GatewayHandshakeProtocol.PROTOCOL_VERSION) throw "Failed to decode gateway handshake message. Unrecognized protocol version!";
        c = b.readInt(); b.readASCIIString(c); c = b.readInt(); b.readLong(); b.readLong(); if (b.readASCIIString(this.footer.length) !== this.footer) throw "Failed to decode gateway handshake message. Footer mismatch!"; return c
    }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.GatewayProtocolHandler = function (a) { this.GATEWAY_MESSAGE_TYPE = "GWM"; this.MESSAGE_MESSAGE_TYPE = "MSG"; this.REQUEST_MESSAGE_TYPE = "RQS"; this.codec = a }; a.GatewayProtocolHandler.prototype.encodeRequest = function (a, c, d, f) { return this.encode(a, this.REQUEST_MESSAGE_TYPE, c, d, f) }; a.GatewayProtocolHandler.prototype.encodeMessage = function (a, c, d, f) { return this.encode(a, this.MESSAGE_MESSAGE_TYPE, c, d, f) }; a.GatewayProtocolHandler.prototype.encode = function (b, c, d, f, k) {
    if (b instanceof ArrayBuffer) {
        if ("number" !==
            typeof d) throw new TypeError("Channel must be a number!"); if (!(f instanceof a.ServiceIdentity || f instanceof a.DeviceIdentity)) throw new TypeError("Origin must be either a ServiceIdentity or a DeviceIdentity!"); if (!(k instanceof a.ServiceIdentity || k instanceof a.DeviceIdentity)) throw new TypeError("Destination must be either a ServiceIdentity or a DeviceIdentity!");
    } else throw new TypeError("Payload must be an ArrayBuffer!"); f = f.asUrn(); k = k.asUrn(); var h = this.codec.INT_LENGTH, l = this.codec.DELIMITER.length,
        h = new a.MessageBuffer(new ArrayBuffer(this.GATEWAY_MESSAGE_TYPE.length + l + c.length + l + h + l + h + l + f.length + l + h + l + k.length + l + b.byteLength), this.codec); h.appendASCIIString(this.GATEWAY_MESSAGE_TYPE); h.appendASCIIString(c); h.appendInt(d); h.appendInt(f.length); h.appendASCIIString(f); h.appendInt(k.length); h.appendASCIIString(k); h.appendBuffer(b, !0); return h.buffer
}; a.GatewayProtocolHandler.prototype.decodeMessage = function (b) {
    var c = new a.MessageBuffer(b, this.codec), d = c.readASCIIString(3); if (this.GATEWAY_MESSAGE_TYPE !==
        d) throw "Failed to decode Gateway message. Unexpected gateway message type: " + d; var d = c.readASCIIString(3), f = c.readInt(), k = c.readInt(), k = c.readASCIIString(k), h = c.readInt(), h = c.readASCIIString(h); b = c.readBuffer(b.byteLength - c.byteOffset, !0); return new a.GatewayMessage(b, f, d, a.IdentityFactory.getFromUrn(k), a.IdentityFactory.getFromUrn(h))
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.HexCodec = { INT_LENGTH: 10, LONG_LENGTH: 18, BOOL_LENGTH: 1, DELIMITER: " " }; a.HexCodec.encodeInt = function (b) { 0 > b && (b = b + 4294967295 + 1); for (b = b.toString(16); b.length < a.HexCodec.INT_LENGTH - 2;)b = "0" + b; return "0x" + b }; a.HexCodec.encodeLong = function (b) { for (b = b.toString(16); b.length < a.HexCodec.LONG_LENGTH - 2;)b = "0" + b; return "0x" + b }; a.HexCodec.decodeInt = function (a) { return ~~parseInt(a, 16) }; a.HexCodec.decodeLong = function (a) { return parseInt(a, 16) }; a.HexCodec.encodeBool = function (a) { return a ? "t" : "f" }; a.HexCodec.decodeBool =
    function (a) { if ("t" === a) return !0; if ("f" === a) return !1; throw "Could not decode " + a + " into boolean!"; }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.MessageBuffer = function (a, c) { this.buffer = a; this.byteOffset = 0; this.codec = c }; a.MessageBuffer.prototype.appendDelimiter = function () { this.appendASCIIString(this.codec.DELIMITER, !0) }; a.MessageBuffer.prototype.appendASCIIString = function (a, c) { for (var d = a.length, f = new Uint8Array(this.buffer, this.byteOffset, a.length), k = 0; k < a.length; k++) { var h = a.charCodeAt(k); if (127 < h) throw "String does not appear to be ASCII"; f[k] = h } this.byteOffset += d; c || this.appendDelimiter() }; a.MessageBuffer.prototype.appendBool =
    function (a, c) { this.appendASCIIString(this.codec.encodeBool(a), c) }; a.MessageBuffer.prototype.appendBuffer = function (a, c) { for (var d = a.byteLength, f = new Uint8Array(this.buffer, this.byteOffset, d), k = new Uint8Array(a), h = 0; h < d; h++)f[h] = k[h]; this.byteOffset += d; c || this.appendDelimiter() }; a.MessageBuffer.prototype.appendInt = function (a, c) { this.appendASCIIString(this.codec.encodeInt(a), c) }; a.MessageBuffer.prototype.appendLong = function (a, c) { this.appendASCIIString(this.codec.encodeLong(a), c) }; a.MessageBuffer.prototype.readDelimiter =
        function () { var a = this.codec.DELIMITER.length; if (this.readASCIIString(a, !0) != this.codec.DELIMITER) throw "Delimiter not found at: " + this.byteOffset - a; }; a.MessageBuffer.prototype.readASCIIString = function (a, c) { for (var d = [], f = new Uint8Array(this.buffer, this.byteOffset, a), k = 0; k < a; k++)d.push(String.fromCharCode(f[k])); d = d.join(""); this.byteOffset += a; c || this.readDelimiter(); return d }; a.MessageBuffer.prototype.readBool = function (a) { return this.codec.decodeBool(this.readASCIIString(this.codec.BOOL_LENGTH, a)) };
    a.MessageBuffer.prototype.readBuffer = function (a, c) { for (var d = new ArrayBuffer(a), f = new Uint8Array(d), k = new Uint8Array(this.buffer, this.byteOffset, a), h = 0; h < a; h++)f[h] = k[h]; this.byteOffset += a; c || this.readDelimiter(); return d }; a.MessageBuffer.prototype.readInt = function (a) { return this.codec.decodeInt(this.readASCIIString(this.codec.INT_LENGTH, a)) }; a.MessageBuffer.prototype.readLong = function (a) { return this.codec.decodeLong(this.readASCIIString(this.codec.LONG_LENGTH, a)) }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.TuningProtocolHandler = function (a) { this.footer = "TUNE"; this.codec = a }; a.TuningProtocolHandler.prototype.encodeMessage = function (b) {
    if ("string" !== typeof b) throw new TypeError("Tuning message must be a string!"); var c = this.codec.DELIMITER.length, d = this.codec.INT_LENGTH + c + this.codec.INT_LENGTH + c + b.length + this.footer.length, c = new a.MessageBuffer(new ArrayBuffer(d), this.codec), f = c.byteOffset; c.appendInt(0); var k = c.byteOffset; c.appendInt(d); c.appendASCIIString(b, !0); c.appendASCIIString(this.footer,
        !0); b = a.computeRFC1071LikeChecksum(c.buffer, f, k); c.byteOffset = f; c.appendInt(b); return c.buffer
}; a.TuningProtocolHandler.prototype.decodeMessage = function (b) {
    var c = new a.MessageBuffer(b, this.codec), d = c.byteOffset, f = c.readInt(); if (!a.validateChecksum(f, c.buffer, d, c.byteOffset)) throw "Failed to decode tuning message. Checksum mismatch!"; c.readInt(); b = c.readASCIIString(b.byteLength - this.footer.length - c.byteOffset, !0); if (c.readASCIIString(this.footer.length, !0) !== this.footer) throw "Failed to decode tuning message. Footer mismatch!";
    try { return JSON.parse(b) } catch (k) { throw "Failed to decode tuning message. Payload was not valid JSON"; }
}
})(window.tcomm = window.tcomm || {});
(function (a) { a.Response = function (a) { a = a.getPayloadAsString().split("\r\n"); this.headerMap = {}; for (header in a) if ("0" === header) this.status = a[header].split(" ")[1]; else { if (null === a[header] || "" === a[header]) break; thisHeader = a[header].split(":"); this.headerMap[thisHeader[0]] = thisHeader[1] } this.response = a[++header] }; a.Response.prototype.getResponseHeader = function (a) { return this.headerMap[a] } })(window.tcomm = window.tcomm || {});
(function (a) {
a.ResponseRouter = function (b) { this.responseRoutes = {}; this.msgRouter = b; this.lastAllocatedEphemeralChannel = a.Channels.REQUEST_RESPONSE_CHANNEL_ID_START }; a.ResponseRouter.prototype.registerResponseHandler = function (a) { channel = this.lastAllocatedEphemeralChannel; this.lastAllocatedEphemeralChannel += 1; this.responseRoutes[channel] = a; this.msgRouter.addRoute(channel, this.msgHandler); return channel }; a.ResponseRouter.prototype.removeRoute = function (a) { this.responseRoutes[a] = []; this.msgRouter.removeRoutes(a) };
    a.ResponseRouter.prototype.routeResponse = function (b) { var c = this.responseRoutes[b.channel]; "undefined" !== typeof c ? c(new a.Response(b)) : a.FrogLog.log("ResponseRouter", "no response handler for this channel", "msg.channel", b.channel) }
})(window.tcomm = window.tcomm || {}); function strToAb(a) { for (var b = new ArrayBuffer(a.length), c = new Uint8Array(b), d = 0; d < a.length; d++)c[d] = a.charCodeAt(d); return b }
function abToStr(a) { var b = ""; a = new Uint8Array(a); for (var c = 0; c < a.length; c++)b += String.fromCharCode(a[c]); return b } function convertToUnsignedNum(a) { 0 > a && (a = 4294967295 + a + 1); return a } function generateUUID() { for (var a = [], b = 0; 36 > b; b++) { var c = "rrrrrrrr-rrrr-4rrr-srrr-rrrrrrrrrrrr".charAt(b); if ("r" === c || "s" === c) { var d = Math.floor(16 * Math.random()); "s" === c && (d = d & 3 | 8); a.push(d.toString(16)) } else a.push(c) } return a.join("") }
function setCookie(a, b, c) { var d = new Date; d.setDate(d.getDate() + c); b = escape(b) + "; expires=" + d.toUTCString(); document.cookie = a + "=" + b } function getCookie(a) { var b = document.cookie, c = b.indexOf(" " + a + "="); -1 == c && (c = b.indexOf(a + "=")); -1 == c ? b = null : (c = b.indexOf("=", c) + 1, a = b.indexOf(";", c), -1 == a && (a = b.length), b = unescape(b.substring(c, a))); return b } var clearCookie = function (a) { document.cookie = a + "=;expires=Thu, 01 Jan 1970 00:00:01 GMT;" }, 

AbstractBiDiSocket = { prototype: {} };
(function (a) {
a.Socket = { nextId: 0, States: { UNDEFINED: "Undefined", OPENING: "Opening", OPEN: "Open", CLOSING: "Closing", CLOSED: "Closed" } }; a.AbstractBiDiSocket = function (b, c, d) { this.state = a.Socket.States.UNDEFINED; this.id = a.Socket.nextId++; this.MESSAGE_MESSAGE_TYPE = "MSG"; this.RESPONSE_MESSAGE_TYPE = "RSP"; this.onOpen = []; this.msgRouter = b || {}; this.responseRouter = c || {}; this.socketIdentity = d || {}; this.onError = []; this.onClose = []; this.purpose = "Regular" }; a.AbstractBiDiSocket.prototype.addOpenListener = function (a) {
    this.onOpen.push(a);
    this.isOpen() && a()
}; a.AbstractBiDiSocket.prototype.addCloseListener = function (a) { this.onClose.push(a) }; a.AbstractBiDiSocket.prototype.addErrorListener = function (a) { this.onError.push(a) }; a.AbstractBiDiSocket.prototype.changeState = function (a) { this.state = a }; a.AbstractBiDiSocket.prototype.onOpened = function () { this.changeState(a.Socket.States.OPEN); for (var b = 0; b < this.onOpen.length; b++)this.onOpen[b]() }; a.AbstractBiDiSocket.prototype.onClosed = function (b) {
    this.changeState(a.Socket.States.CLOSED); for (var c =
        0; c < this.onClose.length; c++)this.onClose[c](b)
}; a.AbstractBiDiSocket.prototype.onMessaged = function (b, c) {
    var d; b instanceof a.ServiceIdentity || b instanceof a.DeviceIdentity ? (a.FrogLog.log("AbstractBiDiSocket", "routing message using source identity", "srcIdentity", b.asUrn()), d = b) : (a.FrogLog.log("AbstractBiDiSocket", "routing message using socket identity"), d = this.socketIdentity); c.type == this.MESSAGE_MESSAGE_TYPE ? (a.FrogLog.log("AbstractBiDiSocket", "received MSG message"), this.msgRouter instanceof a.MessageRouter &&
        this.msgRouter.routeMessage(d, c)) : c.type == this.RESPONSE_MESSAGE_TYPE ? (a.FrogLog.log("AbstractBiDiSocket", "received RSP message"), this.responseRouter instanceof a.ResponseRouter && this.responseRouter.routeResponse(c)) : (a.FrogLog.log("AbstractBiDiSocket", "got some other kind of message", "msg.type", c.type), this.msgRouter instanceof a.MessageRouter && this.msgRouter.routeMessage(d, c))
}; a.AbstractBiDiSocket.prototype.onErrored = function (b) { this.changeState(b || a.Socket.States.CLOSED); for (b = 0; b < this.onError.length; b++)this.onError[b]() };
    a.AbstractBiDiSocket.prototype.isOpen = function () { return this.state === a.Socket.States.OPEN }; a.AbstractBiDiSocket.prototype.isOpenOrOpening = function () { return this.state === a.Socket.States.OPEN || this.state === a.Socket.States.OPENING }; a.AbstractBiDiSocket.prototype.open = function () { }; a.AbstractBiDiSocket.prototype.sendMessage = function () { }; a.AbstractBiDiSocket.prototype.close = function () { }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.CloseStatusCodes = {
    NORMAL: 1E3, ABNORMAL: 1006, UNKNOWN_ERROR: 4E3, AUTHENTICATION_FAILED: 4001, CLIENT_ERROR: 4002, EXTRA_DATA_RECEIVED: 4003, EOF_ERROR: 4004, INCORRECT_FRAME_HEADER: 4005, PINGPONG_FAILURE: 4006, IO_ERROR: 4007, SERVER_COMMUNICATION_ERROR: 4008, SERVER_RECEIVES_NEW_CONNECTION: 4009, SERVER_INITIATED_CLOSE: 4010, TUNING_FAILED: 4011, TUNING_FAILED_PROTOCOL_MISMATCH: 4012, RESOURCE_CRUNCH_ON_SERVER: 4013, SERVER_EXISTING_CONNECTION_NOT_OLD: 4014, NOT_YET_CONNECTED_ERROR: 4015, CONNECTIVITY_CHANGE: 4500,
    ACCOUNT_CHANGE: 4501, HEARTBEAT_FAILURE: 4502, CONNECTION_TIMEOUT: 4503
}
})(window.tcomm = window.tcomm || {}); 

var GatewayProtocolSocket = { prototype: {} };
(function (a) {
a.GatewayProtocolSocket = function (b, c, d, f, k) {
    a.AbstractBiDiSocket.call(this, f, k, c); this.biDiSocket = b; this.identity = c; this.handshakeHandler = new a.GatewayHandshakeHandler(f); this.protocolHandler = d; var h = this; if (h.biDiSocket.isOpen()) h.onOpened(); else h.biDiSocket.addOpenListener(function () { h.handshakeHandler.initHandshake(h.biDiSocket, [], function (b) { if (b) h.onOpened(); else a.FrogLog.log("GatewayProtocolSocket", "gateway handshake failed - closing connection"), h.onClosed() }) }); var l = this; l.biDiSocket.addCloseListener(function (a) { l.onClosed(a) });
    var e = this; e.msgRouter instanceof a.MessageRouter && e.msgRouter.addRoute(a.Channels.GW_CHANNEL, function (b, c) { switch (e.state) { case a.Socket.States.OPENING: case a.Socket.States.OPEN: try { var d = e.protocolHandler.decodeMessage(c.getPayloadAsBuffer()) } catch (g) { a.FrogLog.log("GatewayProtocolSocket", "failed to decode Gateway message", "err", g); break } e.onMessaged(d.originId, d) } }); var g = this; g.biDiSocket.addErrorListener(function () { g.onErrored() })
}; a.GatewayProtocolSocket.prototype = Object.create(a.AbstractBiDiSocket.prototype);
    a.GatewayProtocolSocket.prototype.open = function () { this.changeState(a.Socket.States.OPENING); this.biDiSocket.open() }; a.GatewayProtocolSocket.prototype.sendMessage = function (b, c) { if (this.state === a.Socket.States.OPEN) { var d = this.protocolHandler.encodeMessage(b, c, new a.DeviceIdentity("", "", "0", "0"), this.identity); this.biDiSocket.sendMessage(d, a.Channels.GW_CHANNEL) } else throw "GatewayProtocolSocket could not send message in state" + this.state; }; a.GatewayProtocolSocket.prototype.sendRequest = function (b, c) {
        if (this.state ===
            a.Socket.States.OPEN) { var d = this.protocolHandler.encodeRequest(b, c, new a.DeviceIdentity("", "", "0", "0"), this.identity); this.biDiSocket.sendMessage(d, a.Channels.GW_CHANNEL) } else throw "GatewayProtocolSocket could not send message in state" + this.state;
    }; a.GatewayProtocolSocket.prototype.close = function (b, c) { this.state !== a.Socket.States.OPENING && this.state !== a.Socket.States.OPEN || this.biDiSocket.close(b, c) }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.DeviceGatewayProtocolSocket = function (b, c, d, f, k) {
    if (!(c instanceof a.DeviceIdentity)) throw "Cannot instantiate DeviceGatewayProtocolSocket with non-device identity!"; this.controlProtocolHandler = f; a.GatewayProtocolSocket.call(this, b, c, d); this.msgRouter = k; var h = this; h.msgRouter instanceof a.MessageRouter && h.msgRouter.addRoute(a.Channels.GW_CTL_CHANNEL, function (b, c) {
        switch (h.state) {
            case a.Socket.States.OPENING: case a.Socket.States.OPEN: try { var d = h.controlProtocolHandler.decodeMessage(c.getPayloadAsBuffer()) } catch (f) {
                a.FrogLog.log("DeviceGatewayProtocolSocket",
                    "could not decode Gateway control message", "err", f); break
            } var k = a.IdentityFactory.getFromUrn(d.endpointIdentity); if (k.deviceType === h.identity.deviceType && k.deviceSerialNumber === h.identity.deviceSerialNumber) switch (a.FrogLog.log("DeviceGatewayProtocolSocket", "handling Gateway control message", "controlMessage", JSON.stringify(d)), d.messageType) {
                case a.GatewayControlProtocol.MessageTypes.DEVICE_AVAILABLE_RESPONSE: case a.GatewayControlProtocol.MessageTypes.DEVICE_AVAILABLE_NOTIFICATION: d = d.isAvailable;
                    switch (h.state) { case a.Socket.States.OPENING: if (d) { a.GatewayProtocolSocket.prototype.onOpened.call(h); break } case a.Socket.States.OPEN: if (!d) h.onClosed() }break; default: a.FrogLog.log("DeviceGatewayProtocolSocket", "received unrecognized Gateway control message type")
            }
        }
    })
}; a.DeviceGatewayProtocolSocket.prototype = Object.create(a.GatewayProtocolSocket.prototype); a.DeviceGatewayProtocolSocket.prototype.onOpened = function () {
    this.changeState(a.Socket.States.OPENING); var b = this.controlProtocolHandler.encodeMessage(a.GatewayControlProtocol.MessageTypes.DEVICE_AVAILABLE_REQUEST,
        this.identity); this.biDiSocket.sendMessage(b, a.Channels.GW_CTL_CHANNEL)
}
})(window.tcomm = window.tcomm || {});
(function (a) {
a.ProtocolSocket = function (b, c, d, f, k) {
    a.AbstractBiDiSocket.call(this, d, f, k); this.biDiSocket = new a.WebSocketWrapper(b); this.tuningHandler = c; this.protocolHandler = {}; var h = this; h.biDiSocket.addOpenListener(function () { h.tuningHandler.initTuningHandshake(h.biDiSocket, function (b, c) { b ? (h.protocolHandler = c, h.onOpened()) : (a.FrogLog.log("ProtocolSocket", "tuning handshake failed - closing connection"), h.close(a.CloseStatusCodes.TUNING_FAILED)) }) }); var l = this; l.biDiSocket.addCloseListener(function (a) { l.onClosed(a) });
    var e = this; e.biDiSocket.addMessageListener(function (b) { if (e.state === a.Socket.States.OPEN) { try { var c = e.protocolHandler.decodeMessage(b) } catch (d) { a.FrogLog.log("ProtocolSocket", "failed to decode TComm message", "err", d); return } e.onMessaged(null, c) } }); var g = this; g.biDiSocket.addErrorListener(function () { g.onErrored() })
}; a.ProtocolSocket.prototype = Object.create(a.AbstractBiDiSocket.prototype); a.ProtocolSocket.prototype.open = function () { this.changeState(a.Socket.States.OPENING); this.biDiSocket.open() }; a.ProtocolSocket.prototype.sendMessage =
    function (b, c) { if (this.state === a.Socket.States.OPEN) { var d = this.protocolHandler.encodeMessage(b, c); this.biDiSocket.sendMessage(d) } else throw "ProtocolSocket could not send message in state" + this.state; }; a.ProtocolSocket.prototype.sendRequest = function (b, c) { if (this.state === a.Socket.States.OPEN) { var d = this.protocolHandler.encodeRequest(b, c); this.biDiSocket.sendMessage(d) } else throw "ProtocolSocket could not send request in state" + this.state; }; a.ProtocolSocket.prototype.close = function (b, c) {
    this.state !==
        a.Socket.States.OPENING && this.state !== a.Socket.States.OPEN || this.biDiSocket.close(b, c)
    }
})(window.tcomm = window.tcomm || {});
(function (a) {
a.WebSocketWrapper = function (b) { a.AbstractBiDiSocket.call(this); this.url = b; this.webSocket = {}; this.messageListeners = [] }; a.WebSocketWrapper.prototype = Object.create(a.AbstractBiDiSocket.prototype); a.WebSocketWrapper.prototype.addMessageListener = function (a) { this.messageListeners.push(a) }; a.WebSocketWrapper.prototype.onMessaged = function (a, c) { for (var d = 0; d < this.messageListeners.length; d++)this.messageListeners[d](c) }; a.WebSocketWrapper.prototype.open = function () {
    // THdebug - commented this lilne: if ("undefined" === typeof window.WebSocket) throw "Could not open connection. WebSocket unsupported.";
    a.FrogLog.log("WebSocketWrapper", "attempting to open websocket connection", "this.url", this.url); this.changeState(a.Socket.States.OPENING); 
    // THdebug - added options to the websocket open request
    //this.webSocket = new WebSocket(this.url); 
    this.webSocket = new WebSocket(this.url, document.wsoptions); 

    this.webSocket.binaryType = "arraybuffer"; var b = this; this.webSocket.onopen = function () { a.FrogLog.log("WebSocketWrapper", "WebSocket upgrade accepted"); b.onOpened() }; this.webSocket.onclose = function (c) {
        null !== c ? a.FrogLog.log("WebSocketWrapper", "WebSocket closed", "closeEvent", JSON.stringify({ code: c.code, reason: c.reason, wasClean: c.wasClean })) :
        a.FrogLog.log("WebSocketWrapper", "WebSocket closed"); b.onClosed(c)
    }; this.webSocket.onmessage = function (c) { a.FrogLog.log("WebSocketWrapper", "WebSocket received", "msgEvent.data", abToStr(c.data)); b.onMessaged(null, c.data) }; this.webSocket.onerror = function () { a.FrogLog.log("WebSocketWrapper", "WebSocket error"); b.onErrored() }
}; a.WebSocketWrapper.prototype.sendMessage = function (b) {
    if (this.state === a.Socket.States.OPEN) {
        var c = (new Date).getTime(), d = Number.MAX_VALUE; this.lastMsgTime && (d = c - this.lastMsgTime); if (30 <
            d) a.FrogLog.log("WebSocketWrapper", "WebSocket sending", "msg", abToStr(b)), this.lastMsgTime = c, this.webSocket.send(b); else { var f = this; setTimeout(function () { a.FrogLog.log("WebSocketWrapper", "WebSocket deferred message for 50ms"); f.sendMessage(b) }, 50) }
    }
}; a.WebSocketWrapper.prototype.close = function (b) { b = b || a.CloseStatusCodes.NORMAL; this.state !== a.Socket.States.OPENING && this.state !== a.Socket.States.OPEN || this.webSocket.close(b, "") }
})(window.tcomm = window.tcomm || {}); 
