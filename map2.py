#!bin/python
from __future__ import division
import sys, web, time, jsonlib, logging, datetime, os, json, re
from xml.utils import iso8601
from dateutil.tz import tzlocal
from web.contrib.template import render_genshi
from pyproj import Geod # geopy can do distances too
import restkit
from pymongo import Connection, DESCENDING
from locations import readGoogleMapsLocations

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger()
milesPerMeter = 0.000621371192237334

config = json.loads(open("priv.json").read())

render = render_genshi('templates', auto_reload=True)

urls = (r'/', 'index',
        r'/history', 'history',
        r'/update', 'update',
        r'/logPos.php', 'update',
        r'/trails', 'trails',
        r'/gmap', 'gmap',
        r'/drawMap.png', 'drawMapImg',
        r'/updateTrails', 'updateTrails',
        )

app = web.application(urls, globals(), autoreload=False)
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]
makeTime = lambda milli: datetime.datetime.fromtimestamp(milli/1000, tzlocal()).isoformat()

def lastUpdates():
    mongo.ensure_index([('user', 1), ('timestamp', -1)])
    log.debug("distinct users")
    allUsers = set(mongo.distinct('user'))
    allUsers.discard("?")
    allUsers.discard(None)
    updates = {}
    log.debug("first timestamps")
    for u in allUsers:
        updates[u] = mongo.find({'user':u}).sort('timestamp', DESCENDING).next()
    log.info("updates: %r" % updates)
    return updates

class index(object):
    def GET(self):
        web.header('Content-type', 'application/xhtml+xml; charset=UTF-8')
        return render.index(
            updates=lastUpdates().values(),
            makeTime=makeTime,
            foafName=foafName,
            bundleId=int(os.path.getmtime("static/bundle.js")),
            )
        
class drawMapImg(object):
    def GET(self):
        import drawmap
        #reload(drawmap)
        web.header('Content-type', 'image/png')
        web.header('Cache-Control', 'private, max-age=0')
        web.header('Expires', '-1')
        i = web.input(width=320, height=320, history=10)
        return drawmap.mapImage(mongo, width=int(i.width), height=int(i.height), history=int(i.history))

class gmap(object):
    def GET(self):
        web.header('Content-type', 'application/xhtml+xml; charset=UTF-8')
        updates = lastUpdates()
        def markers(updates):
            return "".join(
                "&markers=color:blue|label:%s|%s,%s" % (
                    foafName(u['user'])[0],
                    u['latitude'], u['longitude']) for u in updates)

        return render.gmap(
            updates=updates.values(),
            makeTime=makeTime,
            foafName=foafName,
            markers=markers,
            avgAttr=lambda recs, attr: (sum(r[attr] for r in recs) / len(recs)),
            )

timeOfLastSms = {} # todo: compute this from the db instead

class update(object):

    def GET(self):
        """SendPosition for iphone won't use POST

        nor does opengeotracker for android
        """
        i = web.input()

        user = config['sendPositionDeviceMap'][
            i.get('key', i.get('deviceid', None))]

        now = long(time.time() * 1000)

        if 'key' in i:
            d = {
                "source" : "OpenGeoTracker",
                "user" : user,
                "timestamp" : now,
                'longitude': float(i['longitude']),
                'latitude': float(i['latitude']),
                'altitude': float(i['altitude']),
                'bearing': float(i['bearing']),
                'tag': i.get('tag', ''),
                'provider': i['provider'],
                'speed': float(i['speed']),
                'accuracy': float(i['accuracy']),
                }
        else:
            d = { "source" : "SendPosition",
                  "user" : user,
                  "timestamp" : now,
                  "horizAccuracy" : float(i['hacc']),
                  "altitude" : float(i['altitude']),
                  "longitude" : float(i['lon']),
                  "latitude" : float(i['lat']),
                  "velocity" : float(i['speed']),
                  "vertAccuracy" : float(i['vacc']),
                  "heading" : float(i['heading'])
                  }
        return self.finish(d)
    
    def POST(self):

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
        
        return self.finish(d)
    
    def finish(self, d):
        mongo.insert(d, safe=True)
        self.sendUpdates(d)

    def sendUpdates(self, d):
        updateWebClients(d['user'])
        return self.sendSms(d)

    def sendSms(self, d):
        name = describeLocation(d['longitude'], d['latitude'],
                                d.get('horizAccuracy', d.get('accuracy', 0)),
                                d['user'] # this could be redone for each -recipient- user
                                )

        c3po = restkit.Resource('http://bang:9040/')

        tellUsers = set(config['tellUsers'])
        if d['user'] in tellUsers:
            #tellUsers.discard(d['user'])

            now = time.time()
            for u in tellUsers:

                if u in timeOfLastSms:
                    if now < timeOfLastSms[u] + 4.9*60:
                        continue
                timeOfLastSms[u] = now

                c3po.post(path='', payload={
                    'user' : u,
                    'msg' : '%s position is %s %s' % (
                        foafName(d['user']), name, config['smsUrl']),
                    'mode' : 'xmpp'
                },
                          headers={'content-type' :
                                   'application/x-www-form-urlencoded'}
                      )
                # "eta home in 15 mins"

        return jsonlib.dumps({'posName' : name})

class updateTrails(object):
    def POST(self):
        """new client is here; send everyone fresh trails"""
        updateWebClients()
        return '<div>ok</div>'
    GET = POST # webos is sending get for my $.post()

def getUpdateMsg(movingUser=None, query=None):
    trailPoints = {}
    for user in mongo.distinct('user'):

        userQuery = [row for row in (query or [])
                     if row and row['user'] == user]
        if userQuery:
            userQuery = userQuery[0]
        else:
            userQuery = dict(visible=True, query='last 80 points')

        if not userQuery['visible'] or user in ['?', None]:
            continue

        m = re.match(r'last (\d+) point', userQuery['query'])
        if m:
            limit = int(m.group(1))
        else:
            limit = 80

        old = (time.time() - 3*60*60) * 1000
        
        recent = list(mongo.find({'user':user}, sort=[('timestamp', -1)],
                                 limit=limit))
        recent.reverse()
        for r in recent:
            del r['_id']
        if len(recent) > 1 and recent[-2]['timestamp'] < old:
            recent = recent[-4:]
        trailPoints[user] = recent

    if movingUser:
        ctr = trailPoints[movingUser][-1]
    else:
        ctrs = [pts[-1] for pts in trailPoints.values()]
        ctr = {'longitude' : sum(c['longitude'] for c in ctrs)/len(ctrs),
               'latitude' : sum(c['latitude'] for c in ctrs)/len(ctrs)}
    try:
        msg = dict(trailPoints=trailPoints, center=ctr, scale=8.3)
    except Exception:
        log.error("trailPoints=%r", trailPoints)
        raise
    
    return msg

class trails(object):
    def GET(self):
        # polling version of updateWebClients
        web.header('content-type', 'application/json')
        q = json.loads(web.input()['q'])
        return json.dumps(getUpdateMsg(query=q))

map3 = restkit.Resource(config['postUpdates'])
def updateWebClients(movingUser=None):
    map3.post(path='',
              payload=json.dumps(getUpdateMsg(movingUser)),
              headers={"content-type": "application/json"})

class history(object):
    def GET(self):
        web.header('Content-type', 'application/xhtml+xml; charset=UTF-8')

        rows = mongo.find().sort([("timestamp", -1)]).limit(50)

        def closest(row):
            return describeLocation(row['longitude'], row['latitude'], row.get('horizAccuracy', row.get('accuracy', 0)), row['user'])
            try:
                name, meters = closestTarget(row['longitude'], row['latitude'], row['user'])
            except ValueError, e:
                return 'err (%s)' % e
            if meters > 900:
                dist = "%.3f miles" % (meters * milesPerMeter)
            else:
                dist = "%d m" % meters

            return "%s (%s)" % (name, dist)

        
        
        return render.history(
            rows=rows,
            prettyTime=lambda milli: iso8601.tostring(milli / 1000,
                                                      time.altzone # wrong
                                                      ).replace('T', ' '),
            foafName=foafName,
            placeName=placeName,
            closest=closest,
            )


def closestTarget(lng, lat, user):
    """name and meters to the closest known target"""

    mapId = config['userMap'][user]
    locations = readGoogleMapsLocations(mapId)

    g = Geod(ellps='WGS84')
    closest = (None, 0)
    
    for name, target in locations:
        try:
            _, _, dist = g.inv(lng, lat, target[1], target[0])
        except ValueError:
            eps = .0001 # not sure how close Geod breaks
            if (abs(lng - target[1]) < eps and
                abs(lat - target[0]) < eps):
                return name, 0
            else:
                raise
        if closest[0] is None or dist < closest[1]:
            closest = name, dist

    return closest

def describeLocation(lng, lat, horizAccuracy, user):
    name, dist = closestTarget(lng, lat, user)
    if dist < horizAccuracy:
        return "at %s (%dm away)" % (name, dist)
    if dist < 900:
        return "%dm from %s" % (dist, name)
    if dist < 10000:
        return "%.2f miles from %s" % (dist * milesPerMeter, name)
    return placeName(lng, lat)

def foafName(uri):
    # todo
    if not uri:
        return ''
    return config['foafNames'].get(uri, uri)

def placeName(long, lat):
    geonames = restkit.Resource('http://ws.geonames.org/')
    addr = jsonlib.read(geonames.get("findNearestAddressJSON",
                                     lat=lat, lng=long).body_string(), use_float=True)
    if 'address' in addr:
        addr = addr['address']
        return "%s %s, %s %s" % (addr['streetNumber'],
                                 addr['street'] or addr['adminName2'],
                                 addr['placename'],
                                 addr['adminCode1'])
    else:
        pl = jsonlib.read(geonames.get("findNearbyPlaceNameJSON",
                                       lat=lat, lng=long, style='short').body_string(),
                          use_float=True)
        if 'geonames' in pl:
            return pl['geonames'][0]['name']
        else:
            return "no geo %r" % pl
        
    
if __name__ == '__main__':
    sys.argv.append(str(config['port']))
    app.run()

