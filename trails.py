#!bin/python
"""
query for people's previous update points in mongodb
"""
import json, re, time, logging
from bottle import route, response, run, request
from pymongo import Connection
logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger()


config = json.loads(open("priv.json").read())
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]

@route("/trails")
def trails():
    q = json.loads(request.query.q)
    return getUpdateMsg(query=q)

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

run(host="0.0.0.0", port=9099)
