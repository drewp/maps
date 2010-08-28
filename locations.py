import time, restkit, logging
log = logging.getLogger()

from lxml import etree
def readGoogleMapsLocations():
    ret = []
    url = open("priv-googlemaps.url").read().strip()
    t1 = time.time()
    feed = restkit.Resource(url).get().body
    log.info("load google map data in %s sec" % (time.time() - t1))
    
    root = etree.fromstring(feed.encode('utf8'))
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

