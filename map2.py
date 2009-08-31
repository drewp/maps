#!/usr/bin/python
"""
sudo easy_install -U -Z http://webpy.org/static/web.py-0.32.tar.gz

  
"""
from __future__ import division
import sys, web, time, os, urllib,jsonlib
from xml.utils import iso8601
from web.contrib.template import render_genshi

render = render_genshi('templates', auto_reload=True)

urls = (r'/', 'index',
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
            )

class update(object):
    def POST(self):

        # {u'horizAccuracy': 1616L, u'timestamp': Decimal('1251629916354'),
        # u'altitude': 0L, u'longitude': Decimal('-120.000000'),
        # u'errorCode': 0L, u'latitude': Decimal('35.000000'),
        # u'velocity': 0L, u'vertAccuracy': 0L,
        # u'heading': 0L}

        f = open("updates.log", "a")
        f.write(web.data()+"\n")
        f.close()

        return 'ok'
    
if __name__ == '__main__':
    sys.argv.append("9033")
    app.run()

