#!bin/python
from __future__ import division
"""
query for people's previous update points in mongodb
"""
import json, re, time, logging, datetime, urllib
from bottle import route, response, run, request
from rdflib import Namespace, URIRef, Literal, RDFS
from dateutil.tz import tzutc, tzlocal
from pymongo import Connection
from describelocation import describeLocationFull
logging.basicConfig(level=logging.INFO)
log = logging.getLogger()

MAP = Namespace("http://bigasterisk.com/map#")
XSD = Namespace("http://www.w3.org/2001/XMLSchema#")
sys.path.append("/my/site/magma")
from stategraph import StateGraph

config = json.loads(open("priv.json").read())
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]

@route("/trails")
def trails():
    q = json.loads(request.query.q)
    return getUpdateMsg(query=q)

@route("/graph")
def graph():
    log.debug("start graph")
    g = StateGraph(URIRef("http://bigasterisk.com/map"))

    for user in [URIRef("http://bigasterisk.com/foaf.rdf#drewp"),
                 URIRef("http://bigasterisk.com/kelsi/foaf.rdf#kelsi"),
                 ]:
        log.debug("find points for %s", user)
        pt = list(mongo.find({'user':user}, sort=[('timestamp', -1)], limit=1))
        if not pt:
            continue
        pt = pt[0]
        t = datetime.datetime.fromtimestamp(pt['timestamp'] / 1000,
                                            tzutc()).astimezone(tzlocal())
        g.add((user, MAP['lastSeen'], Literal(t)))

        ago = int(time.time() - pt['timestamp'] / 1000)
        g.add((user, MAP['lastSeenAgoSec'], Literal(ago)))
        g.add((user, MAP['lastSeenAgo'], Literal(
            "%s seconds" % ago if ago < 60 else
            ("%.1f minutes" % (ago / 60) if ago < 3600 else
             ("%.1f hours" % (ago / 3600))))))

        log.debug("describeLocationFull")
        desc, targetUri, targetName, dist = describeLocationFull(
            config,
            pt['longitude'], pt['latitude'],
            pt.get('horizAccuracy', pt.get('accuracy', 0)),
            str(user))
        
        g.add((user, MAP['lastNear'], targetUri))
        g.add((targetUri, RDFS.label, Literal(targetName)))
        g.add((user, MAP['lastDesc'], Literal(desc)))
        if ago < 60*15:
            g.add((user, MAP['recentlyNear'], targetUri))
        log.debug("added %s", user)
        
    response.set_header("content-type", 'application/x-trig')
    ret = g.asTrig()
    log.debug("return graph")
    return ret

def getUpdateMsg(movingUser=None, query=None):
    trailPoints = {}
    print "query %r" % query

    for userQuery in query:
        user = userQuery['user']
        nlQuery = userQuery.get('query', 'last 80 points')

        m = re.match(r'last (\d+) point', nlQuery)
        if m:
            limit = int(m.group(1))
        else:
            limit = 80

        old = (time.time() - 3*60*60) * 1000
        
        recent = list(mongo.find({'user':user}, sort=[('timestamp', -1)],
                                 limit=limit))
        recent.reverse()
        for r in recent:
            del r['_id']
        if len(recent) > 1 and recent[-2]['timestamp'] < old:
            recent = recent[-4:]
        trailPoints[user] = recent

    return dict(trailPoints=trailPoints)

run(server='gevent', host="0.0.0.0", port=9099)
