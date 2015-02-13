#!bin/python
from __future__ import division
"""
query for people's previous update points in mongodb
"""
import json, re, time, logging, datetime, sys
#import gevent.monkey
#gevent.monkey.patch_all()
from bottle import route, response, run, request
from rdflib import Namespace, URIRef, Literal, RDFS
from dateutil.tz import tzutc, tzlocal
from pymongo import Connection
from describelocation import describeLocationFull, metersFromHome
logging.basicConfig(level=logging.INFO)
log = logging.getLogger()

MAP = Namespace("http://bigasterisk.com/map#")
XSD = Namespace("http://www.w3.org/2001/XMLSchema#")
sys.path.append("/my/site/magma")
from stategraph import StateGraph

config = json.loads(open("priv.json").read())
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]
mongo.ensure_index([('recv_time', 1)])

TIME_SORT = ('timestamp', -1)
def pt_sec(pt): return pt['timestamp']

if 0:
    # owntracks is stalling on the 'tst' time value, but sending mostly ok data
    TIME_SORT = ('recv_time', -1)
    def pt_sec(pt): return pt['recv_time']
    

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
        pt = list(mongo.find({'user':user}, sort=[TIME_SORT], limit=1))
        if not pt:
            continue
        pt = pt[0]
        t = datetime.datetime.fromtimestamp(
            pt_sec(pt), tzutc()).astimezone(tzlocal())
        g.add((user, MAP['lastSeen'], Literal(t)))

        ago = int(time.time() - pt_sec(pt))
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
        g.add((user, MAP['distanceToHomeM'], Literal(metersFromHome(
            config, user, pt['longitude'], pt['latitude']))))
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

    now = time.time()
    for userQuery in query:
        user = userQuery['user']
        nlQuery = userQuery.get('query', 'last 80 points')

        m = re.match(r'last (\w+) point', nlQuery)
        if m:
            limit = int(m.group(1))
        else:
            limit = 80
        spec = {'user':user}
        m = re.match(r'last (\w+) hour', nlQuery)
        if m:
            spec['timestamp'] = {'$gt' : now - float(m.group(1)) * 3600}

        
        recent = list(mongo.find(spec, sort=[TIME_SORT],
                                 limit=limit))
        recent.reverse()
        #recent = filter_stale(recent)
           
        #old = (now - 20*60*60)
        #if len(recent) > 1 and pt_sec(recent[-2]) < old:
        #    recent = recent[-4:]
            
        for r in recent:
            del r['_id']
            r['t_ms'] = int(pt_sec(r) * 1000)
            del r['timestamp']
            del r['recv_time']
        trailPoints[user] = recent

    return dict(trailPoints=trailPoints)

def filter_stale(recent):
    keep = []
    for r in recent:
        if 'recv_time' not in r or (
                r['recv_time'] - int(r['timestamp']) < 1500):
            keep.append(r)
    return keep

run(server='cherrypy',
    host="0.0.0.0", port=9099)
