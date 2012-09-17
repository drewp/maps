#!bin/python
"""
receive updates from various phone sender programs; save them to mongodb; ping the notifier.

No c3po announcements here.
"""
from bottle import route, run, request
import json, time, restkit, traceback
from pymongo import Connection

config = json.loads(open("priv.json").read())
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]
notifier = restkit.Resource("http://localhost:9098/")

def finish(d):
    """
    after gathering the attributes into the dict, call this to write it and ping notifier
    """
    mongo.insert(d, safe=True)
    # if you get this far, the primary request was a success. Further
    # errors are only logged.
    try:
        _id = d.pop('_id')
        notifier.post("newUpdate", payload=json.dumps(d))
    except restkit.RequestError:
        traceback.print_exc()
        

@route("/update", method="GET")
def updateGet():
    """SendPosition for iphone won't use POST

    nor does opengeotracker for android
    """
    params = request.query

    user = config['sendPositionDeviceMap'][
        params.get('key', params.get('deviceid', None))]

    now = long(time.time() * 1000)

    if 'key' in params:
        d = {
            "source" : "OpenGeoTracker",
            "user" : user,
            "timestamp" : now,
            'longitude': float(params['longitude']),
            'latitude': float(params['latitude']),
            'altitude': float(params['altitude']),
            'bearing': float(params['bearing']),
            'tag': params.get('tag', ''),
            'provider': params['provider'],
            'speed': float(params['speed']),
            'accuracy': float(params['accuracy']),
            }
    else:
        d = { "source" : "SendPosition",
              "user" : user,
              "timestamp" : now,
              "horizAccuracy" : float(params['hacc']),
              "altitude" : float(params['altitude']),
              "longitude" : float(params['lon']),
              "latitude" : float(params['lat']),
              "velocity" : float(params['speed']),
              "vertAccuracy" : float(params['vacc']),
              "heading" : float(params['heading'])
              }
    return finish(d)

@route("/update", method="POST")
def updatePost():
    """
    i forget what sender this was
    """
    # {u'horizAccuracy': 1616L, u'timestamp': Decimal('1251629916354'),
    # u'altitude': 0L, u'longitude': Decimal('-120.000000'),
    # u'errorCode': 0L, u'latitude': Decimal('35.000000'),
    # u'velocity': 0L, u'vertAccuracy': 0L,
    # u'heading': 0L, "user": "http://bigasterisk.com/foaf.rdf#drewp"}

    if web.input().get('ping', ''):
        # map3.js has done the update, but we need to send the
        # announcements
        d = mongo.find(sort=[('timestamp', -1)], limit=1).next()
        self.sendUpdates(d)
        return

    inJson = web.data().strip()
    if '"errorCode": 0' not in inJson and '"errorCode":0' not in inJson:
        raise ValueError(inJson)

    d = jsonlib.read(inJson, use_float=True)

    if not d.get('user', '').strip():
        raise ValueError("need user")

    return finish(d)

run(host='localhost', port=9033)

"""
// some other protcols from other phone senders which I haven't ported yet

app.post("/webform1.aspx", function (req, res) {
    /* as sent by https://play.google.com/store/apps/details?id=com.jeff.android.atracker */
    console.log(req.body);
    var fields = req.body.postStuff.trimRight().split(',')
    var doc = {
	user: req.body.postName.trim(),
	longitude: parseFloat(fields[0]),
	latitude: parseFloat(fields[1]),
	smsUTC: +new Date(req.body.smsUTC + " GMT"),
	field3: fields[3],
	field4: fields[4],
    }
    insertPoint(doc, function () { res.end(); });
});

app.post("/myTracking", function (req, res) {
    /* as sent by https://play.google.com/store/apps/details?id=com.wiebej.gps2mytracking
       
       configuration in there:
          server: http://10.1.0.1:9085/
          server side form: myTracking
          user name: (foaf with %23 instead of #)
          time before logging: 10
          distance before logging: 5
          start on boot: yes
     */
    var doc = {
	user: req.query.name,
	latitude: parseFloat(req.query.latitude),
	longitude: parseFloat(req.query.longitude),
	altitude: parseFloat(req.query.alt),
	speed: parseFloat(req.query.speed),
	crs: parseFloat(req.query.crs),
	source: "GPS2MyTracking",
	smsUTC: req.query.smsUTC
    };
    console.log(doc);
    insertPoint(doc, function () { res.end(); });
});

app.post("/gprmc/Data", function (req, res) {
    /*
      note in GPS2OpenGTS android, you have to escape your own account
      name as a query param, # -> %23
      
      http://aprs.gids.nl/nmea/#rmc
    */

    function toDeg(nmea, dir) {
	// http://aprs.gids.nl/nmea/#rmc like 4916.45 N -> 49deg 16.45min
	var degMin = nmea / 100;
	var deg = Math.floor(degMin);
	var min = (degMin - deg) * 100;
	var sign = (dir == "W" || dir == "S") ? -1 : 1;
	return sign * (deg + min / 60);
    }

    function metersPerSecFromKnots(knots) {
	return knots * .514444;
    }
    
    var cksum = req.query.gprmc.split("*");
    var fields = cksum[0].split(",");
    console.log(fields);
    if (fields[0] != "$GPRMC") {
	throw new Error("unknown gprmc format: "+req.query.gprmc);
    }
    if (fields[2] != "A") {
	throw new Error("bad gprmc validity: "+req.query.gprmc);
    }

    var doc = {
	user: req.query.acct,
	gprmcTime: {time: fields[1], date: fields[9]},
	latitude: toDeg(parseFloat(fields[3]), fields[4]),
	longitude: toDeg(parseFloat(fields[5]), fields[6]),
	velocity: metersPerSecFromKnots(parseFloat(fields[7])),
	bearing: parseFloat(fields[8]),
	variation: {degrees: parseFloat(fields[10] || "0"), dir: fields[11]},
	source: "GPS2OpenGTS"
    };
    console.log(doc);
    insertPoint(doc, function () { res.end(); });
});
"""
