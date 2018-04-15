module.exports = require('yargs')
    .env('MQTT2ALEXA')
    .usage('Usage: $0 [options]')
    .describe('a', 'amazon account name')
    .describe('p', 'amazon account password')
    .describe('v', 'possible values: "error", "warn", "info", "debug"')
    .describe('n', 'instance name. used as connected topic and client id prefix')
    .describe('m', 'mqtt broker url. See https://github.com/mqttjs/MQTT.js#connect-using-a-url')
    .describe('h', 'show help')
    .describe('k', 'allow tls connections with invalid certificates')
    .alias({
        a: 'account',
        p: 'password',
        h: 'help',
        k: 'insecure',
        n: 'name',
        m: 'mqtt-url',
        v: 'verbosity',
    })
    .demand('account')
    .demand('password')
    .boolean('insecure')
    .default({
        m: 'mqtt://localhost',
        n: 'alexa',
        v: 'info',
    })
    .version()
    .help('help')
    .argv;
