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

class updateTrails(object):
    def POST(self):
        """new client is here; send everyone fresh trails"""
        updateWebClients()
        return '<div>ok</div>'
    GET = POST # webos is sending get for my $.post()

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


def foafName(uri):
    # todo
    if not uri:
        return ''
    return config['foafNames'].get(uri, uri)

if __name__ == '__main__':
    sys.argv.append(str(config['port']))
    app.run()

