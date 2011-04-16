import time, restkit, logging, socket
log = logging.getLogger()

from lxml import etree
_recent = None
def readGoogleMapsLocations():
    global _recent
    now = time.time()
    if _recent is not None and _recent[0] > now - 10*60:
        return _recent[1]
    locs = loadFromGoogle()
    _recent = (now, locs)
    return locs

def loadFromGoogle():
    url = open("priv-googlemaps.url").read().strip()
    t1 = time.time()
    try:
        feed = restkit.Resource(url).get().body_string()
    except socket.gaierror, e:
        try:
            feed = open("priv-googlemaps.cache").read()
        except IOError:
            log.warn(e)
            return []
    log.info("load google map data in %s sec" % (time.time() - t1))
    
    root = etree.fromstring(feed.encode('utf8'))

    #return parseGeoRss(root)
    return parseKml(root)
    

def parseKml(root):
    '''
        <kml xmlns="http://earth.google.com/kml/2.2">
        <Document>
          <Placemark>
            <name>home</name>
            <styleUrl>#style135</styleUrl>
            <Point>
              <coordinates>-122.2,37.5,0.000000</coordinates>
            </Point>
          </Placemark>
    '''
    KML = "http://earth.google.com/kml/2.2"
    ret = []
    for item in root.xpath("/k:kml/k:Document/k:Placemark", namespaces={"k":KML}):
        title = item.find("{%s}name" % KML).text
        coords = item.find("{%s}Point" % KML).find("{%s}coordinates" % KML).text
        print coords
        lng,lat,_ = map(float, coords.split(","))
        ret.append((title, (lat, lng)))
    return ret
    
def parseGeoRss(root):
    ret = []
    for item in root.xpath("/rss/channel/item"):
        '''
          <item>
            <guid isPermaLink="false">00047df9356ac91212e8d</guid>
            <pubDate>Mon, 25 Jan 2010 08:46:43 +0000</pubDate>
            <title>foo</title>
            <author>drewp</author>
            <georss:point>
              37.4 -122.2
            </georss:point>
            <georss:elev>0.000000</georss:elev>
          </item>
        '''
        point = item.find('{http://www.georss.org/georss}point').text
        lat, lng = map(float, point.split())
        ret.append((item.find('title').text, (lat, lng)))
    return ret

