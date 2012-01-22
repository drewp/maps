#!bin/python

from locations import readGoogleMapsLocations, listMapIds
import web, json

class places(object):
    def GET(self):
        web.header('content-type', 'application/json')
        i = web.input()
        if 'map' not in i:
            return json.dumps(dict(mapIds=listMapIds()))
        locs = readGoogleMapsLocations(i['map'], bool(i.get('forceReload', '')))
        return json.dumps(locs)

app = web.application((r'/places', 'places'), globals(), autoreload=False)
if __name__ == '__main__':
    app.run()
