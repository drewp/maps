#!/usr/bin/python
"""
sudo easy_install -U -Z http://webpy.org/static/web.py-0.32.tar.gz

  
"""
from __future__ import division
import sys, web, time, jsonlib
from xml.utils import iso8601
from web.contrib.template import render_genshi
from pyproj import Geod # geopy can do distances too
import restkit

milesPerMeter = 0.000621371192237334

render = render_genshi('templates', auto_reload=True)

urls = (r'/', 'index',
        r'/history', 'history',
        r'/update', 'update',
        )

app = web.application(urls, globals())

class index(object):
    def GET(self):
        web.header('Content-type', 'application/xhtml+xml; charset=UTF-8')

        f = open("updates.log")
        lastLine = f.readlines()[-1]
        lastUpdate = jsonlib.read(lastLine, use_float=True)

        return render.index(
            lastUpdate=lastUpdate,
            lastTime=iso8601.tostring(lastUpdate['timestamp']/1000,
                               (time.timezone, time.altzone)[time.daylight]),
            name=foafName(lastUpdate['user']),
            )

class update(object):
    def POST(self):

        # {u'horizAccuracy': 1616L, u'timestamp': Decimal('1251629916354'),
        # u'altitude': 0L, u'longitude': Decimal('-120.000000'),
        # u'errorCode': 0L, u'latitude': Decimal('35.000000'),
        # u'velocity': 0L, u'vertAccuracy': 0L,
        # u'heading': 0L, "user": "http://bigasterisk.com/foaf.rdf#drewp"}

        d = web.data().strip()
        if '"errorCode": 0' not in d:
            raise ValueError()
        f = open("updates.log", "a")
        f.write(d+"\n")
        f.close()

        d = jsonlib.read(d, use_float=True)
        name = describeLocation(d['longitude'], d['latitude'],
                                d['horizAccuracy'])

        c3po = restkit.Resource('http://bang:9040/')

        tellUsers = set([
            'http://bigasterisk.com/foaf.rdf#drewp',
            'http://bigasterisk.com/kelsi/foaf.rdf#kelsi',
            ])
        tellUsers.discard(d['user'])

        for u in tellUsers:
            c3po.post(path='', payload={
                'user' : u,
                'msg' : '%s position is %s http://bigast.com/map' % (foafName(d['user']), name),
                'mode' : 'sms'
            },
                      headers={'content-type' :
                               'application/x-www-form-urlencoded'}
                  )
            # "eta home in 15 mins"

        return 'ok'

class history(object):
    def GET(self):
        web.header('Content-type', 'application/xhtml+xml; charset=UTF-8')

        
        f = open("updates.log")
        rows = []
        for line in f:
            rows.append(jsonlib.read(line, use_float=True))
        rows.reverse()

        def closest(row):
            return describeLocation(row['longitude'], row['latitude'], row['horizAccuracy'])
            try:
                name, meters = closestTarget(row['longitude'], row['latitude'])
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


locations = None
def closestTarget(lng, lat):
    """name and meters to the closest known target"""
    global locations
    if locations is None:
        locations = jsonlib.loads(open("locations.json").read(),
                                  use_float=True)['locations']

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

def describeLocation(lng, lat, horizAccuracy):
    name, dist = closestTarget(lng, lat)
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
    return {'http://bigasterisk.com/foaf.rdf#drewp' : 'Drew',
            'http://bigasterisk.com/kelsi/foaf.rdf#kelsi' : 'Kelsi'}[uri]

def placeName(long, lat):
    geonames = restkit.Resource('http://ws.geonames.org/')
    addr = jsonlib.read(geonames.get("findNearestAddressJSON",
                                     lat=lat, lng=long), use_float=True)
    if 'address' in addr:
        addr = addr['address']
        return "%s %s, %s %s" % (addr['streetNumber'],
                                 addr['street'] or addr['adminName2'],
                                 addr['placename'],
                                 addr['adminCode1'])
    else:
        pl = jsonlib.read(geonames.get("findNearbyPlaceNameJSON",
                                       lat=lat, lng=long, style='short'),
                          use_float=True)
        if 'geonames' in pl:
            return pl['geonames'][0]['name']
        else:
            return "no geo %r" % pl
        
    
if __name__ == '__main__':
    sys.argv.append("9033")
    app.run()

