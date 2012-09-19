from __future__ import division

from pyproj import Geod # geopy can do distances too
from locations import readGoogleMapsLocations

milesPerMeter = 0.000621371192237334

def describeLocation(config, lng, lat, horizAccuracy, user):
    name, dist = closestTarget(config, lng, lat, user)
    if dist < horizAccuracy:
        return "at %s (%dm away)" % (name, dist)
    if dist < 900:
        return "%dm from %s" % (dist, name)
    if dist < 10000:
        return "%.2f miles from %s" % (dist * milesPerMeter, name)
    return placeName(lng, lat)

def closestTarget(config, lng, lat, user):
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

def placeName(long, lat):
    geonames = restkit.Resource('http://ws.geonames.org/')
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
        
    
