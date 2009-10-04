#!/usr/bin/python
"""
sudo easy_install -U -Z http://webpy.org/static/web.py-0.32.tar.gz

  
"""
from __future__ import division
import sys, web, time, os, urllib,jsonlib
from xml.utils import iso8601
from web.contrib.template import render_genshi
import restkit

# svn checkout http://geopy.googlecode.com/svn/branches/reverse-geocode geopy
sys.path.append('/my/site/maps/geopy/build/lib.linux-x86_64-2.6')
from geopy import geocoders

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
        lastUpdate = jsonlib.read(lastLine)

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

        d = jsonlib.read(d)
        name = placeName(d['latitude'], d['longitude'])

        c3po = restkit.Resource('http://bang:9040/')

        tellUsers = set([
            'http://bigasterisk.com/foaf.rdf#drewp',
            'http://bigasterisk.com/kelsi/foaf.rdf#kelsi',
            ])
        tellUsers.discard(d['user'])

        for u in tellUsers:
            c3po.post(path='', payload={
                'user' : u,
                'msg' : '%s position is %s' % (foafName(d['user']), name),
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
            rows.append(jsonlib.read(line))
        rows.reverse()
        return render.history(
            rows=rows,
            prettyTime=lambda milli: iso8601.tostring(milli / 1000,
                                                      time.altzone # wrong
                                                      ).replace('T', ' '),
            foafName=foafName,
            )

def foafName(uri):
    # todo
    if not uri:
        return ''
    return {'http://bigasterisk.com/foaf.rdf#drewp' : 'Drew',
            'http://bigasterisk.com/kelsi/foaf.rdf#kelsi' : 'Kelsi'}[uri]

def placeName(lat, long):
    return geocoders.GeoNames().reverse((lat, long))[0]

    
if __name__ == '__main__':
    sys.argv.append("9033")
    app.run()

