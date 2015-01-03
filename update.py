#!bin/python
"""
receive updates from various phone sender programs; save them to mongodb; ping the notifier.

No c3po announcements here.
"""
from bottle import route, run, request
import json, time, restkit, traceback
from dateutil.parser import parse
from dateutil.tz import tzlocal
from pymongo import Connection

config = json.loads(open("priv.json").read())
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]
notifier = restkit.Resource("http://localhost:9098/")

def finish(d):
    """
    after gathering the attributes into the dict, call this to write it and ping notifier
    """
    print "writing to mongo %s" % json.dumps(d)
    print mongo.insert(d, safe=True)
    print "  assigned id", d['_id']
    found = mongo.find_one(d['_id'])
    if found['user'] != d['user']:
        raise ValueError("new record doesn't match sent data")
    # if you get this far, the primary request was a success. Further
    # errors are only logged.
    try:
        _id = d.pop('_id')
        notifier.post("newUpdate", payload=json.dumps(d))
    except restkit.RequestError:
        traceback.print_exc()
        

@route("/update", method="GET")
def updateGet():
    """SendPosition for iphone won't use POST *or* gpsLogging android app.

    nor does opengeotracker for android
    """
    params = request.query


    user = config['sendPositionDeviceMap'][
        params.get('key',
                   params.get('deviceid',
                              params.get('user', None)))]

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
    elif 'time' in params:
        # GPSLogger, with my format string
        d = {
            'source': 'GPSLogger',
            'user': user,
            'timestamp': int(parse(params['time']).astimezone(tzlocal()).strftime('%s000')),
            'latitude': float(params['lat']),
            'longitude': float(params.get('longitude', params.get('long', None))),
            'altitude': float(params['alt']),
            'speed': float(params['s']),
            'battery': float(params['batt']),
            'provider': params['prov'],
        }
        if 'acc' in params: d['accuracy'] = float(params['acc'])
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
        
    d['recv_time'] = time.time()
    return finish(d)

@route("/update", method="POST")
def updatePost():
    """
    i forget what sender this was, originally. Now used for android
    sl4a one and mqtt.
    """
    # {u'horizAccuracy': 1616L, u'timestamp': Decimal('1251629916354'),
    # u'altitude': 0L, u'longitude': Decimal('-120.000000'),
    # u'errorCode': 0L, u'latitude': Decimal('35.000000'),
    # u'velocity': 0L, u'vertAccuracy': 0L,
    # u'heading': 0L, "user": "http://bigasterisk.com/foaf.rdf#drewp"}

    inJson = request.body.read().strip()
    d = json.loads(inJson)

    if 'timestamp' not in d and 'time' in d:
        d['timestamp'] = d.pop('time')

    if not d.get('user', '').strip():
        raise ValueError("need user")
    d['recv_time'] = time.time()

    return finish(d)

@route("/myTracking", method="POST")
def myTrackingPost():
    """
     as sent by https://play.google.com/store/apps/details?id=com.wiebej.gps2mytracking
       
       configuration in there:
          server: http://10.1.0.1:9033/
          server side form: myTracking
          user name: (foaf with %23 instead of #)
          time before logging: 10
          distance before logging: 5
          start on boot: yes
    """
    q = request.query
    doc = {
        'timestamp' : long(time.time() * 1000),
	'user': q.name,
	'latitude': float(q.latitude),
	'longitude': float(q.longitude),
	'altitude': float(q.alt),
	'speed': float(q.speed),
	'crs': float(q.crs),
	'source': "GPS2MyTracking",
	'smsUTC': q.smsUTC
    }
    return finish(doc)

@route("/")
def index():
    return "update.py service for maps. receives phone updates; writes mongodb"

run(host='0.0.0.0', port=9033, server='cherrypy')

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
