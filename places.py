#!bin/python

from locations import readGoogleMapsLocations, listMapIds
import json
from urllib import urlencode
from bottle import route, response, run, request

@route('/places')
def places():
    return {'maps' : [{
        'label': x,
        'uri': '//bigasterisk.com/map/places/map?' + urlencode([('m', x)]),
        } for x in listMapIds()]}

@route('/places/map')
def placesMap():
    locs = readGoogleMapsLocations(request.query['m'],
                                   bool(request.query.get('forceReload', '')))
    return {'places': locs}


run(host="0.0.0.0", port=9084)
