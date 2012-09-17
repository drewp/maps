#!bin/python
"""
learn about updates from phones. send occasional c3po announcements about them. forward the pings to the web site
"""
from bottle import route, run, request
import json, restkit
from describelocation import describeLocation
site = restkit.Resource("http://localhost:9086/")
config = json.loads(open("priv.json").read())

@route("/newUpdate", method="POST")
def newUpdate():
    """
    this update in the payload has just been added to mongodb
    """
    d = json.load(request.body)

    #sendSms(d)
    pingSite(d)
    
def pingSite(d):
    site.post("/gotNewTrails", payload=json.dumps(d))

def sendSms(d):
    name = describeLocation(config,
                            d['longitude'], d['latitude'],
                            d.get('horizAccuracy', d.get('accuracy', 0)),
                            d['user'] # this could be redone for each -recipient- user
                            )

    c3po = restkit.Resource('http://bang:9040/')

    tellUsers = set(config['tellUsers'])
    if d['user'] in tellUsers:
        #tellUsers.discard(d['user'])

        now = time.time()
        for u in tellUsers:

            if u in timeOfLastSms:
                if now < timeOfLastSms[u] + 4.9*60:
                    continue
            timeOfLastSms[u] = now

            c3po.post(path='', payload={
                'user' : u,
                'msg' : '%s position is %s %s' % (
                    foafName(d['user']), name, config['smsUrl']),
                'mode' : 'xmpp'
            },
                      headers={'content-type' :
                               'application/x-www-form-urlencoded'}
                  )
            # "eta home in 15 mins"

    return jsonlib.dumps({'posName' : name})


run(host='localhost', port=9098)
