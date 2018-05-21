#!/usr/bin/env node

const log = require('yalm');
const Mqtt = require('mqtt');
const config = require('./config.js');
const toughCookie = require('tough-cookie');
const toughCookieFilestore = require('tough-cookie-filestore');
const request = require('request-promise-native');
const fs = require('fs');
const ws = require('ws');
const cheerio = require('cheerio');
const pkg = require('./package.json');
const ab2str = require('arraybuffer-to-string');
const str2ab = require('string-to-arraybuffer');
const express = require('express');
const http = require('http');
const https = require('https');
const _ = require('underscore');

const cookiepath = __dirname + '/conf/cookies.json';
var Cookie = toughCookie.Cookie;
if(!fs.existsSync(cookiepath))
    fs.writeFileSync(cookiepath, '');
var jar = request.jar(new toughCookieFilestore(cookiepath));

// dummys for deps library
var document = {};
var window = {};
var wsdefaults = {};

class WebSocket extends ws {
    constructor(url) {
        super(url, wsdefaults);
    }
}

const lang='de,en';
const amazon='amazon.de';
const alexa='alexa.amazon.de';
const version=0;
const agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:58.0) Gecko/20100101 Firefox/58.0';

let mqtt;
let mqttConnected = false;
let alexaConnected = false;
var alexaDevices = [];
var alexaEventWs = null;

function alexaCheckStatus() {
    var options = {
        url: 'https://' + alexa + '/api/bootstrap?version=' + version,
        headers: {
            'User-Agent': agent,
            'DNT': '1',
            'Connection': 'keep-alive'
        },
        jar: jar,
        json: true
    };
    return new Promise((resolve, reject) => {
        request(options)
        .then((response) => {
            var status = false;
            if (response.authentication)
                if (response.authentication.authenticated)
                    if (response.authentication.authenticated == true) {
                        status = true;
                        alexaConnect();
                    }
            resolve(status);
        })
        .catch((err) => {
            resolve(false);
        });
    });
}

var alexaCurrentUrl = null;

function alexaGetResponse(name, url, headers = {}, data = null) {
    log.debug(name);
    var options = {
        method: (data) ? 'POST' : 'GET',
        url: url,
        headers: headers,
        resolveWithFullResponse: true,
        followRedirect: (redirect) => {
            return false;
        },
        jar: jar
    };
    options.headers['User-Agent'] = agent;
    options.headers['Accept-Language'] = lang;
    options.headers['DNT'] = '1';
    options.headers['Connection'] = 'keep-alive';
    options.headers['Upgrade-Insecure-Requests'] = '1';
    if (!options.headers.Referer)
        if (alexaCurrentUrl)
            options.headers.Referer = alexaCurrentUrl;
    alexaCurrentUrl = url;
    if (data)
        options.formData = data;
    return new Promise((resolve, reject) => {
        request(options)
        .then((response) => {
            log.debug(name + ' response code', response.statusCode);
            switch (response.statusCode) {
                case 200:
                    resolve(response);
                    break;
                default:
                    reject(name + ' failed with status code', response.statusCode);
            }
        })
        .catch((err) => {
            var response = err.response;
            log.debug(name + ' response code', response.statusCode);
            switch (response.statusCode) {
                case 302:
                    alexaGetResponse(name + ' redirect', response.headers.location, headers, data)
                    .then((response) => { resolve(response); })
                    .catch((err) => { reject(err); });
                    break;
                default:
                    reject(name + ' failed with status code', response.statusCode);
            }
        });
    });
}

function alexaGetCookie(url, key) {
    var cookies = jar.getCookies(url);
    for (var i = 0; i < cookies.length; i++) {
        var cookie = JSON.parse(JSON.stringify(cookies[i]));
        if (cookie.key === key) {
            log.debug('cookie ' + key, cookie.value);
            return cookie.value;
        }
    }
    return '';
}

function alexaGetFormFields(html, form) {
    const $ = cheerio.load(html);
    var fieldsarray = $('form[' + form + ']' ).serializeArray();
    var fields = {};
    for (var i = 0; i < fieldsarray.length; i++)
        if (fieldsarray[i].value)
            if (fieldsarray[i].value.length > 0)
                fields[fieldsarray[i].name] = fieldsarray[i].value;
    return fields;
}

function alexaLogin() {
    alexaDevices = [];
    fs.writeFileSync(cookiepath, '');
    jar = request.jar(new toughCookieFilestore(cookiepath));
    alexaGetResponse('login step 1', 'https://' + alexa)
    .then((response) => {
        var formfields = alexaGetFormFields(response.body, 'name=signIn');
        delete formfields.prepopulatedLoginId;
	delete formfields.email;
        delete formfields.password;
        alexaGetResponse('login step 2', 'https://www.' + amazon + '/ap/signin', {}, formfields)
        .then((response) => {
            formfields = alexaGetFormFields(response.body, 'name=signIn');
            formfields.email = config.account;
            formfields.password = config.password;
            var sessionid = alexaGetCookie('https://www.' + amazon, 'session-id');
            alexaCurrentUrl += '/' + sessionid;
            alexaGetResponse('login step 3', 'https://www.' + amazon + '/ap/signin', {}, formfields)
            .then((response) => {
                if (alexaCurrentUrl === 'https://' + alexa + '/spa/index.html') {
                    alexaGetResponse('get csrf', 'https://' + alexa + '/api/language', { Origin: 'https://' + alexa })
                    .then((response) => {
                        alexaConnect();
                    })
                    .catch((err) => {
                        log.error(err);
                        process.exit(1);
                    });
                } else {
                    alexaDisconnect();
                }
            })
            .catch((err) => {
                log.error(err);
                process.exit(1);
            });
        })
        .catch((err) => {
            log.error(err);
            process.exit(1);
        });
    })
    .catch((err) => {
        log.error(err);
        process.exit(1);
    });
}

function start() {
    log.setLevel(config.verbosity);
    log.info(pkg.name + ' ' + pkg.version + ' starting');

    log.debug('starting web hook for alexa smart home skill');
    webStart();

    if (config.account && config.account.length > 0) {
        log.debug('amazon account', config.account);
        alexaCheckStatus()
        .then((status) => {
            if (!status)
                alexaLogin();
        })
        .catch((err) => {
            process.exit(1);
        });
    }

    log.info('mqtt trying to connect', config.mqttUrl);

    mqtt = Mqtt.connect(config.mqttUrl, {
        clientId: config.name + '_' + Math.random().toString(16).substr(2, 8),
        will: {topic: config.name + '/connected', payload: '0', retain: (config.mqttRetain)},
        rejectUnauthorized: !config.insecure
    });

    mqtt.on('connect', () => {
        mqttConnected = true;
        log.info('mqtt connected', config.mqttUrl);
        mqtt.publish(config.name + '/connected', alexaConnected ? '2' : '1', {retain: config.mqttRetain});
        log.info('mqtt subscribe', config.name + '/set/#');
        mqtt.subscribe(config.name + '/set/#');
    });

    mqtt.on('close', () => {
        if (mqttConnected) {
            mqttConnected = false;
            log.info('mqtt closed ' + config.mqttUrl);
        }
    });

    mqtt.on('error', err => {
        log.error('mqtt', err.toString());
    });

    mqtt.on('offline', () => {
        log.error('mqtt offline');
    });

    mqtt.on('reconnect', () => {
        log.info('mqtt reconnect');
    });

    mqtt.on('message', (topic, payload) => {
        payload = payload.toString();
        log.debug('mqtt <', topic, payload);

        if (payload.indexOf('{') !== -1) {
            try {
                payload = JSON.parse(payload);
            } catch (err) {
                log.error(err.toString());
            }
        } else if (payload === 'false') {
            payload = false;
        } else if (payload === 'true') {
            payload = true;
        } else if (!isNaN(payload)) {
            payload = parseFloat(payload);
        }
        const [adapter, method, device, type] = topic.split('/');

        if (adapter === config.name)
            switch (method) {
                case 'set':
                    switch (type) {
                        case 'command':
                            alexaSendDeviceCommand(device, payload.val, payload.data);
                            break;
                        default:
                            log.error('unknown method', method);
                    }
                    break;
                default:
                    log.error('unknown method', method);
            }

        webStatusCheck(topic, payload);
    });
}

function alexaSendDeviceCommand(device, command, data = null) {
    //https://alexa.amazon.de/api/np/command?deviceSerialNumber=XXXXXXXXXXXXXXXX&deviceType=XXXXXXXXXXXXXX
    if (typeof device === 'string') {
        for (var i = 0; i < alexaDevices.length; i++) {
            if (alexaDevices[i].accountName === device)
                device = alexaDevices[i];
        }
    }
    var api = 'np/command';
    var query = '';
    var val = null;
    switch (command) {
        case 'play':
            val = { type: "PlayCommand" };
            break;
        case 'pause':
            val = { type: "PauseCommand" };
            break;
        case 'next':
            val = { type: "NextCommand" };
            break;
        case 'previous':
            val = { type: "PreviousCommand" };
            break;
        case 'forward':
            val = { type: "ForwardCommand" };
            break;
        case 'rewind':
            val = { type: "RewindCommand" };
            break;
        case 'shuffle':
            val = { type: "ShuffleCommand", shuffle: "true" };
            break;
        case 'volume':
            val = { type: "VolumeLevelCommand", volumeLevel: value };
            break;
        case 'tunein':
            api = 'tunein/queue-and-play';
            query += '&guideId=' + data;
            query += '&contentType=station';
            query += '&callSign=';
            query += '&mediaOwnerCustomerId=' + device.deviceOwnerCustomerId;
            val = {};
            break;
    };

    var options = {
        method: 'POST',
        keepAlive: true,
        url: 'https://' + alexa + '/api/' + api,
        qs: {
            deviceSerialNumber: device.serialNumber,
            deviceType: device.deviceType
        },
        strictSSL: false,
        headers: {
            'Cache-Control': 'no-cache',
            csrf: alexaGetCookie('https://www.' + amazon, 'csrf'),
            'User-Agent': agent
        },
        resolveWithFullResponse: true,
        jar: jar,
        json: true,
        body: val
    };
    request(options)
    .then((response) => {
        log.debug('command response', response.toJSON());
    })
    .catch((err) => {
        log.error('command error', err.error);
    });
}

function alexaGetTasks() {
    //https://alexa.amazon.de/api/todos?startTime=&endTime=&completed=&type=TASK&size=100&offset=-1&_=1523718809085
    log.warn('tasks not implemented yet');
}

function alexaGetShoppingItems() {
    //https://alexa.amazon.de/api/todos?startTime=&endTime=&completed=&type=SHOPPING_ITEM&size=100&offset=-1&_=1523718809086
    log.warn('shopping items not implemented yet');
}

function alexaQueryTuneinStations(device, query) {
    var ts = new Date().getTime();
    alexaGetResponse('devicestations', 'https://' + alexa + '/api/tunein/search?query=' + query + '&mediaOwnerCustomerId=' +  + '&_=' + ts, {
        Accept: 'application/json, text/javascript, */' + '*; q=0.01',
//        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://' + alexa + '/spa/index.html'
    })
    .then((response) => {
        var stations = JSON.parse(response.body).browseList;
        for (var i = 0; i < stations.length; i++) {
            if (stations[i].contentType === 'station') {
                return stations[i].id;
            }
        }
    })
    .catch((err) => {});
}

function alexaGetDeviceAudibleBooks() {
    //https://alexa.amazon.de/api/audible/audible-books?deviceSerialNumber=XXXXXXXXXXXXXXXX&deviceType=XXXXXXXXXXXXXX&mediaOwnerCustomerId=XXXXXXXXXXXXXX&_=1523728568156
    log.warn('audible books not implemented yet'); 
}

var messaging = function (alexaurl) {
    this.alexaurl = alexaurl;
    this.deviceType = "ALEGCNGL9K0HM";
    this.connectionProperties = { 
        secure: !0, 
        direct: !1, 
        reconnect: !0 
    };
    this.reconnectDelay = 1E3;
    _.bindAll(this, "onMessage", "connectionOpened", "connectionClosed", "sendRegisterConnection", "getNewConnection", "reconnect");
};

messaging.prototype = {
    generateUniqueSerial: function (ubid) {
        this.deviceSerial = ubid + "-" + Date.now(); 
    }, 
    initialize: function (stage, realm) {
        var ident = window.tcomm.IdentityFactory.getDeviceIdentity(this.deviceType, this.deviceSerial);
        var signer = new window.tcomm.QueryParamDeviceIdRequestSigner(ident);
        try { 
            window.tcomm.CommunicationManager.initializeWithConfig({ 
                requestSigner: signer, 
                domain: stage, 
                realm: realm, 
                shouldEnableGateway: !0 
            });
        } catch (err) {
            log.error("Caught error while initializing tcomm", err);
        } finally { 
            window.tcomm.CommunicationManager.registerMessageHandler(window.tcomm.Channels.DEE_WEBSITE_MESSAGING, this.onMessage);
            this.reconnect();
        } 
        //this.listenTo(backbone, "onMobileAppResume", this.reconnect);
    },
    onMessage: function (a, msg) {
        var payloadstr, command, payload;
        try {
            payloadstr = JSON.parse(msg.getPayloadAsString());
            command = payloadstr.command;
            payload = JSON.parse(payloadstr.payload);
        } catch (err) {
            log.error("Caught error while processing message", msg, err);
        }
        try {
            //this.trigger("message:" + command, payload, command);
            log.debug('message received: command', command);
            log.debug('message received: payload', payload);
            if (command != 'PUSH_ACTIVITY') {
                var device = null;
                for (var i = 0; i < alexaDevices.length; i++)
                    if (alexaDevices[i].serialNumber == payload.dopplerId.deviceSerialNumber) {
                        device = alexaDevices[i];
                    }
                if (!device)
                    log.warn('received message for unknown device');
                else {
                    var ts = new Date().getTime();
                    switch(command) {
                        case 'PUSH_MEDIA_CHANGE':
                        case 'PUSH_AUDIO_PLAYER_STATE':
                            alexaGetDevicePlayer(device);
                            break;
                        case 'PUSH_CONTENT_FOCUS_CHANGE':
                        case 'PUSH_MEDIA_QUEUE_CHANGE':
                        case 'PUSH_BLUETOOTH_STATE_CHANGE':
                        case 'PUSH_VOLUME_CHANGE':
                        case 'PUSH_DOPPLER_CONNECTION_CHANGE':
                        case 'PUSH_DELETE_DOPPLER_ACTIVITIES':
                        case 'PUSH_MICROPHONE_STATE':
                            // do nothing for now (payload will still be handled below)
                            break;
                        default:
                            log.warn('websocket received unknown command', command);
                    };
                    if (payload.audioPlayerState)
                        mqttPublish(config.name + '/status/' + device.accountName + '/state', JSON.stringify({ val: payload.audioPlayerState, ts: ts }), {retain: config.mqttRetain});
                    if (payload.isMuted)
                        mqttPublish(config.name + '/status/' + device.accountName + '/muted', JSON.stringify({ val: payload.isMuted, ts: ts }), {retain: config.mqttRetain});
                    if (payload.volumeSetting)
                        mqttPublish(config.name + '/status/' + device.accountName + '/volume', JSON.stringify({ val: payload.volumeSetting, ts: ts }), {retain: config.mqttRetain});
                }
            }
        } catch (err) {
            log.error("Caught error while triggering message event " + command, err);
        }
    },
    getDestinationIdentity: function () {
        return window.tcomm.IdentityFactory.getServiceIdentityFromName("DeeWebsiteMessagingService");
    },
    getConnection: function () {
        return this.connection && this.connection.getState() === window.tcomm.Socket.States.OPEN ? this.connection : null;
    },
    reconnect: function () {
        var self = this;
        !this.connection && this.connectionProperties.reconnect && request({
            url: "https://" + this.alexaurl + "/api/ping",
            qs: { _: new Date().getTime() },
            jar: jar
        }, (err, response, body) => {
            if (err)
                log.error("No network access detected! Skipping connection attempt for DWMS")
            else {
                log.debug("Network detected, attempting to connect DWMS");
                self.getNewConnection()
            }
        });
    },
    closeConnection: function () {
        this.connectionProperties.reconnect = !1;
        this.connection && this.connection.release()
    },
    requestReconnect: function () {
        clearTimeout(this.nextReconnect);
        this.nextReconnect = _.delay(this.reconnect, this.reconnectDelay);
        this.updateDelay();
    },
    updateDelay: function (a) {
        a ? this.reconnectDelay = 1E3 : (a = 1E3 * (Math.random() - 0.5), a = 2 * this.reconnectDelay + a, this.reconnectDelay = Math.min(a, 2E4))
    },
    getNewConnection: function () {
        var dident = this.getDestinationIdentity();
        var conn = window.tcomm.CommunicationManager.acquireConnection(dident, this.connectionProperties.secure, this.connectionProperties.direct);
        var self = this;
        conn.addOpenListener(function () {
            log.info('connection:opened');
            self.connectionOpened(conn);
        });
        conn.addCloseListener(function () {
            log.info('connection:closed');
            self.connectionClosed(conn);
        })
    },
    connectionOpened: function (conn) {
        conn !== this.connection && this.connection && this.connection.release();
        this.connection = conn;
        try {
            this.sendRegisterConnection();
            this.updateDelay(!0);
        } catch (err) {
            this.connection && this.connection.release();
            return;
        }
        //this.trigger("connection:ready", this.connection);
        log.info("connection:ready");
    },
    connectionClosed: function (conn) {
        conn === this.connection && (this.connection = null);
        //this.trigger("connection:lost");
        log.warn("connection:lost");
        this.requestReconnect();
    },
    sendRegisterConnection: function () {
        var conn;
        if (conn = this.getConnection()) {
            var msg = { command: "REGISTER_CONNECTION" };
            conn.sendMessage(JSON.stringify(msg), window.tcomm.Channels.DEE_WEBSITE_MESSAGING); 
        } else 
            log.error("DeeWebsiteMessaging.sendRegisterConnection: no valid connection to send registration on"); 
    }
};

function alexaSubscribeEventsInt() {
    const stage = "prod";
    const realm = "DEAmazon";
    window.WebSocket = '';
    document.cookie = jar.getCookieString('https://' + amazon);
    wsdefaults = {
        headers: {
            Origin: 'https://' + alexa,
            'User-Agent': agent,
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': lang,
            'DNT': '1',
            'Cookie': jar.getCookieString('https://' + amazon)
        },
        protocolVersion: 13,
        perMessageDeflate: true
    };
    eval(fs.readFileSync(__dirname + '/deps.js').toString());
    var m = new messaging(alexa);
    m.generateUniqueSerial(alexaGetCookie('https://' + amazon, 'ubid-acbde'));
    m.initialize(stage, realm);
    // ToDo : this is a really bad approach - on the other hand the original code is calling reconnect from several different places just in case...
    setInterval(() => { m.reconnect(); }, 10000);
}

function alexaSubscribeEvents() {
    fs.access(__dirname + '/deps.js', fs.constants.R_OK, (err) => {
        if (err) {
            log.info('websocket pulling dependencies library');
            request({
                method: 'GET',
                url: 'https://' + alexa + '/lib/47099-deps.min.js',
                headers: {
                    Origin: 'https://' + alexa,
                    'User-Agent': agent,
//                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': lang,
                    'DNT': '1',
                    'Connection': 'keep-alive'
                },
                jar: jar
            })
            .then((body) => {
                var deps = body.substr(body.indexOf('window.FastClick=FastClick;') + 'window.FastClick=FastClick;'.length);
                deps = deps.substr(0, deps.indexOf('var requirejs'));
                fs.writeFile(__dirname + '/deps.js', deps, (err) => {
                    if (err)
                        log.error('websocket error writing dependencies library');
                    else
                        alexaSubscribeEventsInt();
                });
            })
            .catch((err) => {
                log.error('websocket error pulling dependencies library', err);
            });
        } else
            alexaSubscribeEventsInt();
    });
}
    
function alexaGetDevicePlayer(device) {
    //https://alexa.amazon.de/api/np/player?deviceSerialNumber=XXXXXXXXXXXXXXXX&deviceType=XXXXXXXXXXXXXX&screenWidth=1360&_=1523718809108
    var ts = new Date().getTime();
    alexaGetResponse('deviceplayer ' + device.accountName, 'https://' + alexa + '/api/np/player?deviceSerialNumber=' + device.serialNumber + '&deviceType=' + device.deviceType + '&screenWidth=1360&_=' + ts, {
        Accept: 'application/json, text/javascript, *' + '/' + '*; q=0.01',
        Referer: 'https://' + alexa + '/spa/index.html'
    })
    .then((response) => {
        device._player_ = JSON.parse(response.body).playerInfo;
        mqttPublish(config.name + '/status/' + device.accountName + '/artist', JSON.stringify({ val: device._player_.infoText.subText1, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/album', JSON.stringify({ val: device._player_.infoText.subText2, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/title', JSON.stringify({ val: device._player_.infoText.title, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/art', JSON.stringify({ val: device._player_.mainArt.url, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/progress', JSON.stringify({ val: device._player_.progress.mediaProgress, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/duration', JSON.stringify({ val: device._player_.progress.mediaLength, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/provider', JSON.stringify({ val: device._player_.provider.providerName, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/state', JSON.stringify({ val: device._player_.state, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/muted', JSON.stringify({ val: device._player_.volume.muted, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/volume', JSON.stringify({ val: device._player_.volume.volume, ts: ts }), {retain: config.mqttRetain});
    })
    .catch((err) => {});
}

function alexaGetDeviceQueue(device) {
    //https://alexa.amazon.de/api/np/queue?deviceSerialNumber=XXXXXXXXXXXXXXXX&deviceType=XXXXXXXXXXXXXX&size=25&_=1523718809109
    log.warn('queue not implemented yet'); 
}

function alexaGetDeviceStatus(device) {
    //https://alexa.amazon.de/api/media/state?deviceSerialNumber=XXXXXXXXXXXXXXXX&deviceType=XXXXXXXXXXXXXX&screenWidth=1360&_=1523728567874
    var ts = new Date().getTime();
    alexaGetResponse('devicestatus ' + device.accountName, 'https://' + alexa + '/api/media/state?deviceSerialNumber=' + device.serialNumber + '&deviceType=' + device.deviceType + '&screenWidth=1360&_=' + ts, {
        Accept: 'application/json, text/javascript, */' + '*; q=0.01',
        Referer: 'https://' + alexa + '/spa/index.html'
    })
    .then((response) => {
        log.debug('devicestatus body', response.body);
        device._status_ = JSON.parse(response.body);
        mqttPublish(config.name + '/status/' + device.accountName + '/state', JSON.stringify({ val: device._status_.currentState, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/muted', JSON.stringify({ val: device._status_.muted, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/progress', JSON.stringify({ val: device._status_.progressSeconds, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/volume', JSON.stringify({ val: device._status_.volume, ts: ts }), {retain: config.mqttRetain});
        mqttPublish(config.name + '/status/' + device.accountName + '/contenttype', JSON.stringify({ val: device._status_.contentType, ts: ts }), {retain: config.mqttRetain});
    })
    .catch((err) => {
        log.error('devicestatus error', err);
    });
}

function alexaGetDevices() {
    var ts = new Date().getTime();
    alexaGetResponse('devicelist', 'https://' + alexa + '/api/devices-v2/device?cached=false', {
        'Content-Type': 'application/json; charset=UTF-8' ,
        Referer: 'https://' + alexa + '/spa/index.html',
        Origin: 'https://' + alexa,
        csrf: alexaGetCookie('https://www.' + amazon, 'csrf')
    })
    .then((response) => {
        alexaDevices = JSON.parse(response.body).devices;
        for (var i = 0; i < alexaDevices.length; i++) {
            var device = alexaDevices[i];
            mqttPublish(config.name + '/status/' + device.accountName + '/devicefamily', JSON.stringify({ val: device.deviceFamily, ts: ts }), {retain: config.mqttRetain});
            mqttPublish(config.name + '/status/' + device.accountName + '/deviceSerial', JSON.stringify({ val: device.serialNumber, ts: ts }), {retain: config.mqttRetain});
            mqttPublish(config.name + '/status/' + device.accountName + '/deviceType', JSON.stringify({ val: device.deviceType, ts: ts }), {retain: config.mqttRetain});
            if (device.deviceFamily === "ECHO") {
                alexaGetDeviceStatus(device);
                alexaGetDevicePlayer(device);
                alexaGetDeviceQueue(device);
            }
        }
        alexaSubscribeEvents();
    })
    .catch((err) => { log.error('devicelist error', err); });
}

function alexaConnect() {
    if (!alexaConnected) {
        alexaConnected = true;
        log.info('alexa connected');
        mqttPublish(config.name + '/connected', '2', {retain: config.mqttRetain});
        alexaGetDevices();
    }
}

function alexaDisconnect() {
    if (alexaConnected) {
        alexaConnected = false;
        log.error('alexa disconnected');
        mqttPublish(config.name + '/connected', '1', {retain: config.mqttRetain});
// ToDo : delete cookies ?
    }
}

function mqttPublish(topic, payload, options) {
    if (!payload) {
        payload = '';
    } else if (typeof payload !== 'string') {
        payload = JSON.stringify(payload);
    }
    log.debug('mqtt >', topic, payload);
    mqtt.publish(topic, payload, options);
}

var webServer;
var webBearer;
var webStatus = [];
var webDevices = [];

function webLoadDevices() {
    try {
        webDevices = JSON.parse(fs.readFileSync(__dirname + '/conf/devices.json'));
    } catch (err) {
        webDevices = [];
    }
}

function webStart() {
    webLoadBearer();
    webLoadDevices();

    log.debug('starting server on port', config.port);
    webServer = express();
    webServer.use(express.json());
    https.createServer({
        key: fs.readFileSync(__dirname + '/certs/privkey.pem'),
        cert: fs.readFileSync(__dirname + '/certs/fullchain.pem')
    }, webServer).listen(config.port);

    webServer.post('/', (req, res) => {
        log.debug('rx', req.url);
        var header = req.body.directive.header;
        log.debug('rx header', header);
        var endpoint = req.body.directive.endpoint;
        var dev = endpoint ? webDevices.find(o => o.id === endpoint.endpointId) : null;
        log.debug('rx endpoint', endpoint);
        var payload = req.body.directive.payload;
        log.debug('rx payload', payload);
        var resp = {
            event: {
                header: {
                    namespace: header.namespace,
                    name: header.name + '.Response',
                    payloadVersion: header.payloadVersion,
                    messageId: header.messageId + '-R'
                },
                payload: {}
            }
        };
        switch (header.namespace) {
            case "Alexa":
                switch (header.name) {
                    case "ReportState":
                        resp.event.header.name = "StateReport";
                        resp.event.header.correlationToken = header.correlationToken;
                        resp.event.endpoint = {
                            endpointId: endpoint.endpointId,
                            cookie: {}
                        };
                        resp.context = {
                            properties: webStatusProperties(endpoint.endpointId)
                        };
                        break;
                    default:
                        log.warn('unknown name', header.name);
                }
                break;
            case "Alexa.Authorization":
                switch (header.name) {
                    case "AcceptGrant":
                        webGetToken(payload.grant.code).then().catch();
                        break;
                    default:
                        log.warn('unknown name', header.name);
                }
                break;
            case "Alexa.Discovery":
                switch (header.name) {
                    case "Discover":
                        resp.event.payload.endpoints = [];
                        webDevices.forEach((device) => {
                            resp.event.payload.endpoints.push(webDeviceAlexa(device));
                        });
                        break;
                    default:
                        log.warn('unknown name', header.name);
                }
                break;
            case "Alexa.PowerController":
                switch (header.name) {
                    case "TurnOn":
                    case "TurnOff":
                        log.debug('TurnOnOff');
                        if (dev && dev.commands && dev.commands.OnOff) {
                            if (Array.isArray(dev.commands.OnOff)) {
                                log.debug('TurnOnOff has dev commands', dev.commands.OnOff);
                                dev.commands.OnOff.forEach((cmd) => {
                                    var val = (header.name == "TurnOn" ? cmd.val.on : cmd.val.off);
                                    log.debug('TurnOnOff has val', val);
                                    if (val != null)
                                        mqttPublish(cmd.adapter + "/set/" + cmd.device + (cmd.suffix || "") + "/" + cmd.param, JSON.stringify({ val: val }));
                                });
                            } else {
                                log.debug('TurnOnOff has dev command', dev.commands.OnOff);
                                var val = (header.name == "TurnOn" ? dev.commands.OnOff.val.on : dev.commands.OnOff.val.off);
                                log.debug('TurnOnOff has val', val);
                                if (val != null)
                                    mqttPublish(dev.adapter + "/set/" + dev.device + (dev.commands.OnOff.suffix || "") + "/" + dev.commands.OnOff.param, JSON.stringify({ val: val }));
                            }
                        }
                        resp.event.header.namespace = "Alexa";
                        resp.event.header.name = "Response";
                        resp.event.header.correlationToken = header.correlationToken;
                        resp.event.endpoint = endpoint;
                        
//                        resp.event.endpoint = {
                        //    scope: {
                        //        type: "BearerToken",
                        //        token: webBearer.access_token
                        //    },
//                            endpointId: endpoint.endpointId
//                        };
                        // ToDo
                        /*
                        resp.context = {
                            properties: webStatusProperties(endpoint.endpointId)
                        };
                        resp.context = {
                            "properties": [ {
                                "namespace": "Alexa.PowerController",
                                "name": "powerState",
                                "value": header.name == "TurnOn" ? "ON" : "OFF",
                                "timeOfSample": new Date().toISOString(),
                                "uncertaintyInMilliseconds": 0
                            } ]
                        };
*/
                        break;
                    default:
                        log.warn('unknown name', header.name);
                }
                break;
            default:
                log.warn('unknown namespace', header.namespace);
        }
        log.debug('tx response', JSON.stringify(resp));
        res.send(JSON.stringify(resp));
    });
}

function webDeviceAlexa(device) {
    var ep = {
        endpointId: device.id,
        friendlyName: device.voice,
        description: device.id,
        manufacturerName: device.adapter,
        displayCategories: [],
        cookie: {},
        capabilities: [
            {
                type: "AlexaInterface",
                interface: "Alexa",
                version: "3"                            
            }
        ]
    };
    device.types.forEach((type) => {
        ep.displayCategories.push(type.toUpperCase());
    });
    if (device.status && device.status.Unreachable) {
        ep.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.EndpointHealth",
            version: "3",
            properties: {
                supported: [
                    {
                        name: "connectivity"
                    }
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
        webStatusAdd({
            endpoint: ep.endpointId,
            interface: "Alexa.EndpointHealth",
            property: "connectivity",
            topic: device.adapter + "/status/" + device.device + (device.status.Unreachable.suffix || "") + "/" + device.status.Unreachable.param,
            translate: [
                { mqtt: true, alexa: 'UNREACHABLE' },
                { mqtt: false, alexa: 'OK' }
            ]
        });
    }
    if (device.commands && device.commands.OnOff) {
        ep.capabilities.push({
            type: "AlexaInterface",
            interface: "Alexa.PowerController",
            version: "3",
            properties: {
                supported: [
                    {
                        name: "powerState"
                    }
                ],
                proactivelyReported: (device.status != null && device.status.OnOff != null),
                retrievable: (device.status != null && device.status.OnOff != null)
            }
        });
    }
    if (device.status && device.status.OnOff) {
        webStatusAdd({
            endpoint: ep.endpointId,
            interface: "Alexa.EndpointHealth",
            property: "powerState",
            topic: device.adapter + "/status/" + device.device + (device.status.OnOff.suffix || "") + "/" + device.status.OnOff.param,
            translate: [
                { mqtt: true, alexa: 'ON' },
                { mqtt: false, alexa: 'OFF' }
            ]
        });
    }
    return ep;
}

function webMessageId() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

function webStatusAdd(sta) {
    if (!webStatus.find(o => o.endpoint === sta.endpoint && o.interface === sta.interface && o.property === sta.property && o.filter === sta.filter && o.topic === sta.topic)) {
        log.debug('listen for change', sta.endpoint, sta.property, sta.topic);
        webStatus.push(sta);
        mqtt.subscribe(sta.topic);
    }
}

function webStatusCheck(topic, payload) {
    webSendStatus(webStatus.find(o => o.topic === topic), payload.val, payload.ts || new Date().getTime());
}

function webSendStatus(sta, val, ts) {
    if (!sta) return;
    var wval = sta.translate ? sta.translate.find(o => o.mqtt === val).alexa : val;        
    if (sta.filter && sta.filter != wval)
        return;
    sta.val = {
        mqtt: val,
        alexa: wval,
        ts: ts
    };
    log.debug('sending change report', sta.property, val, wval);
    request({
        method: "POST",
        url: "https://api.eu.amazonalexa.com/v3/events",
        headers: {
            Authorization: "Bearer " + webBearer.access_token,
        },
        json: {
            context: {},
            event: {
                header: {
                    messageId: webMessageId(),
                    namespace: "Alexa",
                    name: "ChangeReport",
                    payloadVersion: "3"
                },
                endpoint: {
                    scope: {
                        type: "BearerToken",
                        token: webBearer.access_token
                    },
                    endpointId: sta.endpoint
                },
                payload: {
                    change: {
                        cause: {
                            type: "PHYSICAL_INTERACTION"
                        },
                        properties: [
                            {
                                namespace: sta.interface,
                                name: sta.property,
                                value: {
                                    value: wval
                                },
                                timeOfSample: new Date(ts).toISOString(),
                                uncertaintyInMilliseconds: 0
                            }
                        ]
                    }
                }
            }
        }
    })
    .then((res) => {})
    .catch((err) => {
        log.error('error sending change report');
        if (err.statusCode == 401) {
            webRefreshToken(sta, val, ts)
            .then(() => {})
            .catch((err) => {});
        }
    });
}

function webLoadBearer() {
    try {
        webBearer = JSON.parse(fs.readFileSync(__dirname + '/conf/bearer.json'));
    } catch (err) {
        webBearer = null;
    }
}

var webTokenTimeout;
var webTokenRefreshing = false;

function webSaveBearer(bearer) {
    webBearer = bearer;
    if (webTokenTimeout)
        clearTimeout(webTokenTimeout);
    webTokenTimeout = setTimeout(webRefreshToken, bearer.expires_in * 980);
    fs.writeFile(__dirname + '/conf/bearer.json', JSON.stringify(bearer), (err) => {
        if (err)
            log.error('error writing bearer', err);
    });
}

function webGetToken(code) {
    log.debug('token request');
    return new Promise((resolve, reject) => {
        request({
            method: "POST",
            url: "https://api.amazon.com/auth/o2/token",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: "grant_type=authorization_code&code=" + code + "&client_id=" + config.clientid + "&client_secret=" + config.clientsecret
        })
        .then((body) => {
            log.debug('token request response', body);
            webSaveBearer(JSON.parse(body)); 
            resolve();
        })
        .catch((err) => {
            log.warn('failed to get token', err);
            reject(err);
        });
    });
}

var webRefreshWaiting = [];

function webRefreshToken(sta = null, val = null, ts = null) {
    log.debug('token refresh');
    return new Promise((resolve, reject) => {
        if (sta && val && ts)
            webRefreshWaiting.push({ sta: sta, val: val, ts: ts });
        if (webTokenRefreshing) {
            resolve();
        } else {
            webTokenRefreshing = true;
                request({
                    method: "POST",
                    url: "https://api.amazon.com/auth/o2/token",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                    },
                    body: "grant_type=refresh_token&refresh_token=" + webBearer.refresh_token + "&client_id=" + config.clientid + "&client_secret=" + config.clientsecret
                })
                .then((body) => {
                    log.debug('token refresh response', body);
                    webSaveBearer(JSON.parse(body)); 
                    webTokenRefreshing = false;
                    webRefreshWaiting.forEach((req) => {
                        webSendStatus(req.sta, req.val, req.ts);
                    });
                    resolve();
                })
                .catch((err) => {
                    log.warn('failed to refresh token', err);
                    webTokenRefreshing = false;
                    reject(err);
                });
        }
    });
}

function webStatusProperties(endpointId) {
    var props = [];
    webStatus.forEach((prop) => {
        if (prop.endpoint === endpointId) {
            if (prop.val) {
                props.push({
                    namespace: prop.interface,
                    name: prop.property,
                    value: prop.val.alexa,
                    timeOfSample: new Date(prop.val.ts).toISOString(),
                    uncertaintyInMilliseconds: 0
                });
            }
        }
    });
    return props;
}

start();
