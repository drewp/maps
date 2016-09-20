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
client.connect("localhost")
log.info('connected to %s', client._host)
# need more auth here, to be able to read
client.subscribe("/mqttitude/#", 0)
def on_message(mosq, obj, msg):
    payload = json.loads(msg.payload)
    log.info("got message %r %r", msg.topic, payload)
    try:
        userFromTopic = config['mqttTopic'][msg.topic]
    except KeyError:
        log.warn("ignoring unknown topic")
        return
    if 'lon' not in payload:
        log.info("ignoring")
        return
    record = {
        "timestamp" : int(payload['tst']),
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
