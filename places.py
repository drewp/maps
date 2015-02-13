#!bin/python

from locations import readGoogleMapsLocations, listMapIds
import json
from urllib import urlencode
from bottle import route, response, run, request
import logging

logging.basicConfig(level=logging.INFO)

@route('/places')
def places():
    return {'maps' : [{
        'label': x,
        'uri': '//bigasterisk.com/map/places/map?' + urlencode([('m', x)]),
        } for x in listMapIds()]}

@route('/places/map')
def placesMap():
    ret = readGoogleMapsLocations(request.query['m'],
                                  bool(request.query.get('forceReload', '')))
    return ret


run(host="0.0.0.0", port=9084)
