#!bin/python
"""
query for people's previous update points in mongodb
"""
import json, re, time
from bottle import route, response, run, request
from pymongo import Connection


config = json.loads(open("priv.json").read())
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]

@route("/trails")
def trails():
    q = json.loads(request.query.q)
    return getUpdateMsg(query=q)

def getUpdateMsg(movingUser=None, query=None):
    trailPoints = {}
    for user in mongo.distinct('user'):

        userQuery = [row for row in (query or [])
                     if row and row['user'] == user]
        if userQuery:
            userQuery = userQuery[0]
        else:
            userQuery = dict(visible=True, query='last 80 points')

        if not userQuery['visible'] or user in ['?', None]:
            continue

        m = re.match(r'last (\d+) point', userQuery['query'])
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

    if movingUser:
        ctr = trailPoints[movingUser][-1]
    else:
        ctrs = [pts[-1] for pts in trailPoints.values()]
        ctr = {'longitude' : sum(c['longitude'] for c in ctrs)/len(ctrs),
               'latitude' : sum(c['latitude'] for c in ctrs)/len(ctrs)}
    try:
        msg = dict(trailPoints=trailPoints, center=ctr, scale=8.3)
    except Exception:
        log.error("trailPoints=%r", trailPoints)
        raise
    
    return msg

run(host="0.0.0.0", port=9099)
