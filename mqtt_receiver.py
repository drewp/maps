"""
https://github.com/binarybucks/mqttitude
phone app sends to mosquitto broker

we subscribe on that broker and send http to update.py
"""

import mosquitto, json, restkit, logging

logging.basicConfig(level=logging.INFO, format="%(asctime)-15s %(message)s")
log = logging.getLogger()

config = json.load(open('priv.json'))
updateServer = restkit.Resource("http://bang:9033/update")

client = mosquitto.Mosquitto("map-receiver")
client.connect("prime.bigasterisk.com")
log.info('connected to %s', client._host)
# need more auth here, to be able to read
client.subscribe("/mqttitude/#", 0)
def on_message(mosq, obj, msg):
    payload = json.loads(msg.payload)
    log.info("got message %r %r", msg.topic, payload)
    userFromTopic = config['mqttTopic'][msg.topic]
    record = {
        "timestamp" : int(payload['tst']) * 1000,
        "user" : userFromTopic,
        "longitude" : float(payload['lon']),
        "latitude" : float(payload['lat']),
        "source" : "mqttitude",
    }
    for attr in ['alt', 'batt', 'acc']:
        if attr in payload:
            record[attr] = payload[attr]
    log.info(repr(record))
    updateServer.post(payload=json.dumps(record))
    log.info("posted message")

client.on_message = on_message

while True:
    client.loop()
