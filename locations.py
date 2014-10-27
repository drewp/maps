import time, restkit, logging, socket, json
log = logging.getLogger()

from lxml import etree
_recent = {}
def readGoogleMapsLocations(id, forceReload=False):
    now = time.time()
    if (_recent.get(id) is not None and
        _recent[id][0] > now - 10*60 and
        not forceReload):
        return _recent[id][1]
    locs = loadFromGoogle(id)
    _recent[id] = (now, locs)
    return locs

def loadMappings():
    return json.loads(open("priv.json").read())['googleMaps']
    

def listMapIds():
    mappings = loadMappings()
    return [m['id'] for m in mappings]

def loadFromGoogle(id):
    for m in loadMappings():
        if m['id'] == id:
            if 'kml' in m:
                url = m['kml']
            else:
                url = "https://maps.google.com/maps/ms?ie=UTF8&hl=en&vps=1&jsv=200b&msa=0&output=kml&msid=%s" % m['msid']
            break
    else:
        raise ValueError("no matches for id %r" % id)
    t1 = time.time()

    feed = restkit.Resource(url).get().body_string()
    log.info("load google map data, %s bytes in %s sec" % (len(feed), time.time() - t1))
    root = etree.fromstring(feed.encode('utf8'))

    #return parseGeoRss(root)
    return parseKml(root) or parseKmlOld(root)
    

def parseKml(root):
    '''
    'new My Maps' from 2014:
    <kml xmlns='http://www.opengis.net/kml/2.2'>
        <Document>
                <name>locs</name>
                <Folder>
                        <Placemark>
                                <name>home</name>
                                <Point>
                                        <coordinates>-123,45,0.0</coordinates>
                                </Point>
                        </Placemark>
    '''
    KML = "http://www.opengis.net/kml/2.2"
    ret = []
    for item in root.xpath("/k:kml/k:Document/k:Folder/k:Placemark", namespaces={"k":KML}):
        title = item.find("{%s}name" % KML).text
        coords = item.find("{%s}Point" % KML).find("{%s}coordinates" % KML).text
        lng,lat,_ = map(float, coords.split(","))
        ret.append((title, (lat, lng)))
    return ret

def parseKmlOld(root):
    '''
    My Maps, unupgraded:
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

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG)
    print loadFromGoogle('Perttula')
