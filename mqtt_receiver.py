"""
https://github.com/binarybucks/mqttitude
phone app sends to mosquitto broker

we subscribe on that broker and send http to update.py
"""

import mosquitto, json, restkit

config = json.load(open('priv.json'))
updateServer = restkit.Resource("http://localhost:9033/update")

client = mosquitto.Mosquitto("map-receiver")
client.connect("bigasterisk.com")
client.subscribe("/mqttitude/#", 0)
def on_message(mosq, obj, msg):
    payload = json.loads(msg.payload)
    print "got message %r %r" % (msg.topic, payload)
    userFromTopic = config['mqttTopic'][msg.topic]
    record = {
        "timestamp" : int(payload['tst']) * 1000,
        "user" : userFromTopic,
        "longitude" : float(payload['lon']),
        "latitude" : float(payload['lat']),
        "altitude" : float(payload['alt']),
        "accuracy" : payload['acc'],
        "source" : "mqttitude",
    }
    print record
    updateServer.post(payload=json.dumps(record))


client.on_message = on_message

while True:
    client.loop()
