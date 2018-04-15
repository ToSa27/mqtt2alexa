#!/usr/bin/env node

const log = require('yalm');
const Mqtt = require('mqtt');
const config = require('./config.js');
const toughCookie = require('tough-cookie');
const toughCookieFilestore = require('tough-cookie-filestore');
const request = require('request-promise-native');
const fs = require('fs');
const cheerio = require('cheerio');
const pkg = require('./package.json');

const lang='de,en';
const amazon='amazon.de';
const alexa='alexa.amazon.de';
const version=0;
const agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:58.0) Gecko/20100101 Firefox/58.0';
const cookiepath = 'cookies.json';

var Cookie = toughCookie.Cookie;
if(!fs.existsSync(cookiepath))
    fs.writeFileSync(cookiepath, '');
var jar = request.jar(new toughCookieFilestore(cookiepath));

let mqtt;
let mqttConnected = false;
let alexaConnected = false;
//let pollingTimer;
//const pollingInterval = (config.pollingInterval || 10) * 1000;
var alexaDevices = [];

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
    alexaGetResponse('login step 1', 'https://alexa.' + amazon)
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
                if (alexaCurrentUrl === 'https://alexa.' + amazon + '/spa/index.html') {
                    alexaGetResponse('get csrf', 'https://' + alexa + '/api/language', { Origin: 'https://alexa.' + amazon })
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

    log.debug('amazon account', config.account);
    alexaCheckStatus()
    .then((status) => {
        if (!status)
            alexaLogin();
    })
    .catch((err) => {
        process.exit(1);
    });

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
        const [, method, device, type] = topic.split('/');

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

/*
    alexaGetResponse('devicecommand ' + device.accountName + ' : ' + command, 'https://' + alexa + '/api/' + api + '?deviceSerialNumber=' + device.serialNumber + '&deviceType=' + device.deviceType + query, {
        Accept: 'application/json, text/javascript, *' + '/' + '*; q=0.01',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: 'https://alexa.' + amazon + '/spa/index.html',
        Origin: 'https://alexa.' + amazon,
        csrf: alexaGetCookie('https://www.' + amazon, 'csrf'),
        'X-Requested-With': 'XMLHttpRequest'
    }, data)
    .then((response) => {
        log.debug('command response', response);
    })
    .catch((err) => {
        log.error('command error', err);
    });
*/
}

function alexaGetTasks() {
//https://alexa.amazon.de/api/todos?startTime=&endTime=&completed=&type=TASK&size=100&offset=-1&_=1523718809085
}

function alexaGetShoppingItems() {
//https://alexa.amazon.de/api/todos?startTime=&endTime=&completed=&type=SHOPPING_ITEM&size=100&offset=-1&_=1523718809086
}

function alexaQueryTuneinStations(device, query) {
    var ts = new Date().getTime();
    alexaGetResponse('devicestations', 'https://alexa.' + amazon + '/api/tunein/search?query=' + query + '&mediaOwnerCustomerId=' +  + '&_=' + ts, {
        Accept: 'application/json, text/javascript, */' + '*; q=0.01',
//        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://alexa.' + amazon + '/spa/index.html'
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
}

function alexaSubscribeDeviceEvents(device) {
//wss://dp-gw-na.amazon.de/?x-amz-device-type=XXXXXXXXXXXXX&x-amz-device-serial=XXX-XXXXXXX-XXXXXXX-XXXXXXXXXXXXX
/*
// ToDo : weird serial number format ?!?
    device._ws_ = new ws('wss://dp-gw-na.' + amazon + '/?x-amz-device-type=' + device.deviceType + '&x-amz-device-serial=' + device.serialNumber);
    device._ws_.on('message', (message) => {
        log.debug('ws message', message);
    });
    device._ws_.on('close', (code) => {
        log.debug('ws disconnected', code);
    });
    device._ws_.on('error', (error) => {
        log.debug('ws error', error);
    });
*/
}

function alexaGetDevicePlayer(device) {
//https://alexa.amazon.de/api/np/player?deviceSerialNumber=XXXXXXXXXXXXXXXX&deviceType=XXXXXXXXXXXXXX&screenWidth=1360&_=1523718809108
    var ts = new Date().getTime();
    alexaGetResponse('deviceplayer ' + device.accountName, 'https://alexa.' + amazon + '/api/np/player?deviceSerialNumber=' + device.serialNumber + '&deviceType=' + device.deviceType + '&screenWidth=1360&_=' + ts, {
        Accept: 'application/json, text/javascript, */' + '*; q=0.01',
        Referer: 'https://alexa.' + amazon + '/spa/index.html'
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
}

function alexaGetDeviceStatus(device) {
    //https://alexa.amazon.de/api/media/state?deviceSerialNumber=XXXXXXXXXXXXXXXX&deviceType=XXXXXXXXXXXXXX&screenWidth=1360&_=1523728567874
    var ts = new Date().getTime();
    alexaGetResponse('devicestatus ' + device.accountName, 'https://alexa.' + amazon + '/api/media/state?deviceSerialNumber=' + device.serialNumber + '&deviceType=' + device.deviceType + '&screenWidth=1360&_=' + ts, {
        Accept: 'application/json, text/javascript, */' + '*; q=0.01',
        Referer: 'https://alexa.' + amazon + '/spa/index.html'
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
        Referer: 'https://alexa.' + amazon + '/spa/index.html',
        Origin: 'https://alexa.' + amazon,
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
                alexaSubscribeDeviceEvents(device);
            }
        }
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

start();
