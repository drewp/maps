from __future__ import division

import urllib
from pyproj import Geod # geopy can do distances too
from locations import readGoogleMapsLocations
from rdflib import URIRef
from remember.memoize import memoize
import restkit, json, logging
log = logging.getLogger()

milesPerMeter = 0.000621371192237334
geod = Geod(ellps='WGS84')

def metersFromHome(config, user, lng, lat):
    locs = readGoogleMapsLocations(config['userMap'][str(user)])
    for name, pt in locs:
        if name == 'home':
            break
    else:
        raise ValueError("unknown 'home' location for %s" % user)
    _, _, m = geod.inv(lng, lat, pt[1], pt[0])
    return m

def describeLocation(config, lng, lat, horizAccuracy, user):
    desc, _, _, _ = describeLocationFull(config, lng, lat, horizAccuracy, user)
    return desc

def describeLocationFull(config, lng, lat, horizAccuracy, user):
    name, dist = closestTarget(config, lng, lat, user)

    mapUri = URIRef("http://bigasterisk.com/map/%s" % config['userMap'][str(user)])
    targetUri = URIRef("%s/locations/%s" % (mapUri, urllib.quote(name)))

    if dist < horizAccuracy:
        desc = "at %s (%dm away)" % (name, dist)
    elif dist < 900:
        desc = "%dm from %s" % (dist, name)
    elif dist < 10000:
        desc = "%.2f miles from %s" % (dist * milesPerMeter, name)
    else:
        desc = placeName(lng, lat)
        targetUri = URIRef("http://bigasterisk.com/map#geocoded")
        dist = None
        name = None
    return desc, targetUri, name, dist

def closestTarget(config, lng, lat, user):
    """name and meters to the closest known target"""

    mapId = config['userMap'][user]
    locations = readGoogleMapsLocations(mapId)

    closest = (None, 0)
    
    for name, target in locations:
        try:
            _, _, dist = geod.inv(lng, lat, target[1], target[0])
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

@memoize(cache_size=64)
def placeName(long, lat):
    geonames = restkit.Resource('http://ws.geonames.org/')
    log.info("going to ws.geonames.org for %s" % ((long,lat),))
    addr = json.loads(geonames.get("findNearestAddressJSON",
                                   lat=lat, lng=long).body_string())
    if 'address' in addr:
        addr = addr['address']
        return "%s %s, %s %s" % (addr['streetNumber'],
                                 addr['street'] or addr['adminName2'],
                                 addr['placename'],
                                 addr['adminCode1'])
    else:
        pl = json.loads(geonames.get("findNearbyPlaceNameJSON",
                                     lat=lat, lng=long,
                                     style='short').body_string())
        if 'geonames' in pl:
            return pl['geonames'][0]['name']
        else:
            return "no geo %r" % pl
        
    
