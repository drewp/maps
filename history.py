from bottle import route, run, request, static_file
import json, time, traceback, re
from pymongo import Connection
config = json.loads(open("priv.json").read())
m = config['mongo']
mongo = Connection(m['host'], m['port'])[m['db']][m['collection']]

@route(r"<path:re:/(|gui\.js)>")
def index(path):
    return static_file(path.lstrip('/') or "history.html", ".")

@route('/events')
def events():
    spec = {}
    if request.query.userSubstr.strip():
        spec['user'] = re.compile(re.escape(request.query.userSubstr),
                                  re.IGNORECASE)
    
    return {'events': list(mongo.find(spec,
                                      sort=[('recv_time', -1)],
                                      limit=100,
                                      fields={'_id':0},
                                  ))}

    
run(host='0.0.0.0', port=9034, server='cherrypy')
