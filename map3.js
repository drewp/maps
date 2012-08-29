#!bin/node

var express = require('express');
var http = require('http');
var socketIo = require('socket.io');
var httpProxy = require('http-proxy');
var superagent = require('superagent');
var moment = require('moment');
var fs = require('fs');
var async = require('async');
var Connect = require('connect');
var mongodb = require("mongodb");
var assetManager = require('connect-assetmanager');
var assetHandler = require('connect-assetmanager-handlers');
var Mu = require('Mu');
var shared = require('./shared.js');
Mu.templateRoot = './templates/';

var proxy = new httpProxy.RoutingProxy();

var app = express.createServer();
app.listen(9085);

console.log('users come to http://localhost:9085/');

var prod = process.env.NODE_ENV == "production";
var am = assetManager({
    'js' : {
        path: __dirname + "/",
        route: /\/bundle\.js/,
        dataType: 'javascript',
        files: [
            'parts/node/lib/node_modules/socket.io/node_modules/socket.io-client/dist/' + (prod ? 'socket.io.min.js' : 'socket.io.js'),
            'sendpos/app/assistants/gury/' + (prod ? 'gury.min.js' : 'gury.js'),
            'sendpos/app/assistants/matrix.js/' + (prod ? 'matrix-1.2.0.min.js' : 'matrix.js'),
            'sendpos/app/assistants/RTree/src/rtree.js',
            'sendpos/app/assistants/jquery.mousewheel.3.0.2/jquery.mousewheel.min.js',
            'static/' + (prod ? 'knockout-2.0.0.js' : 'knockout-2.0.0.debug.js'),
	    'static/jquery.toucharea.js',
	    './parts/node/lib/node_modules/moment/min/moment.min.js',
	    'shared.js',
            'backgroundmap.js',
            'sendpos/app/assistants/canvasmap.js',
	    'static/page.js'
        ],
        debug: true, // minifier is breaking things.   !prod,
	postManipulate: [
	    function (file, path, index, isLast, callback) {
		    // minifier bug lets '++new Date' from
		    // socket.io.js into the result, which is a parse error.
		callback(null, file.replace(/\+\+\(new Date\)/mig, 
					    '\+\(\+(new Date))'));
	    }
	]
    },
    'css' : {
        path: __dirname + "/",
        route: /\/bundle\.css/,
        dataType: 'css',
        debug: !prod,
        files: [//"static/jquery-ui-1.8.17.custom/css/smoothness/jquery-ui-1.8.17.custom.css",
		"static/jquery.mobile-1.1.0.css",
		"static/style.css"]
    },
    'cssSendpos' : {
	path: __dirname + "/",
	route: /\/bundle-sendpos.js/,
	dataType: 'javascript',
	files: [
	    "sendpos.js"
	]
    }
});
app.use(am);
app.use(Connect.bodyParser());

var io = socketIo.listen(app);
io.configure(function () {
    io.set('resource', '/socket.io');
    io.set('transports', ['xhr-polling']);
    io.set('log level', 2);
});

io.sockets.on('connection', function (socket) {
    socket.join("mapUpdate");
});

function readConfig() {
    return JSON.parse(fs.readFileSync("priv.json", 'utf8'));
}

var _collection;

function getMapCollection(cb) {

    if (_collection) {
	cb(_collection);
    }

    var config = readConfig();

    var m = config.mongo;
    var client = new mongodb.Db(m.db, new mongodb.Server(m.host, m.port, {}));
    client.open(function (err, pClient) {
        if (err) throw err;
        client.collection(m.collection, function (err, mongo) {
            if (err) throw err;
	    _collection = mongo;
            cb(mongo);
        });
    });
}

function lastUpdates(cb) {
    getMapCollection(function (map) {
        map.ensureIndex({user: 1, timestamp: -1}, {}, function (err, done) {
            if (err) throw err;

            map.distinct('user', function (err, users) {
                if (err) throw err;
                users = users.filter(function (u) { return u && u != "?"; });

                async.map(users, function (u, cb2) {
                    map.findOne({user: u}, {sort: {timestamp:-1}}, cb2);
                }, function (err, updates) {
                    cb(updates);
                });
            });
        });
    });
}

function getLabelForUri(uri) { 
    var config = readConfig();
    return config.foafNames[uri] || uri;
}

app.get("/", function (req, res) { 
    res.header("content-type", "text/html");//application/xhtml+xml");
    superagent.get("http://localhost:9084/places", function (mapIds) {
        lastUpdates(function (updates) {

            updates.forEach(function (u) { 
                u.label = getLabelForUri(u.user);
		u.lastSeen = shared.lastSeenFormat(u.timestamp);
            });

            var j = 0;
            mapIds = mapIds.body.mapIds.map(function (id) { j++; return {id: id, row: j} });
            var ctx = {
                bundleCss: am.cacheHashes['css'],
                bundleJs: am.cacheHashes['js'],
                mapIds: mapIds,
                updates: updates,
                updatesJson: JSON.stringify(updates),
		// should come from x-foaf-agent i think
		me: JSON.stringify('http://bigasterisk.com/foaf.rdf#drewp')
            };
            Mu.render('index', ctx, {cached: process.env.NODE_ENV == "production"}, 
                      function (err, output) {
                          if (err) {
                              throw err;
                          }
                          output.addListener('data', 
                                             function (c) { res.write(c); })
                              .addListener('end', function () { res.end(); });
                      });
        });
    });
});

app.get("/sendpos", function (req, res) {
    res.header("content-type", "application/xhtml+xml");
    Mu.render("sendpos", {}, {cached: process.env.NODE_ENV == "production"}, 
              function (err, output) {
                  if (err) {
                      throw err;
                  }
                  output.addListener('data', 
                                     function (c) { res.write(c); })
                      .addListener('end', function () { res.end(); });
              });
});

app.get("/places", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9084});
});

app.get("/history", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});
app.get("/gmap", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});
app.get("/trails", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});

function insertPoint(doc, onSuccess) {
    if (!doc.timestamp) {
	doc.timestamp = +new Date();
    }
    getMapCollection(function (coll) {
	coll.insert(doc, {safe: true}, function (err, objects) {
	    // I haven't ported all the update parts, so we use the
	    // python server for that
	    client = http.createClient(9033, 'localhost');
	    var request = client.request('POST', '/update?ping=1', 
					 {'content-length':'0'});
	    request.end();
	    request.on('response', function (response) {
		if (response.statusCode != 200) {
		    console.log("ping said");
		    console.log(response.statusCode);
		    response.on('data', function (chunk) {
			console.log('BODY: ' + chunk);
		    });
		}
		onSuccess();
	    });
	});
    });
}

app.post("/webform1.aspx", function (req, res) {
    /* as sent by https://play.google.com/store/apps/details?id=com.jeff.android.atracker */
    console.log(req.body);
    var fields = req.body.postStuff.trimRight().split(',')
    var doc = {
	user: req.body.postName.trim(),
	longitude: parseFloat(fields[0]),
	latitude: parseFloat(fields[1]),
	smsUTC: +new Date(req.body.smsUTC + " GMT"),
	field3: fields[3],
	field4: fields[4],
    }
    insertPoint(doc, function () { res.end(); });
});

app.post("/myTracking", function (req, res) {
    /* as sent by https://play.google.com/store/apps/details?id=com.wiebej.gps2mytracking
       
       configuration in there:
          server: http://10.1.0.1:9085/
          server side form: myTracking
          user name: (foaf with %23 instead of #)
          time before logging: 10
          distance before logging: 5
          start on boot: yes
     */
    var doc = {
	user: req.query.name,
	latitude: parseFloat(req.query.latitude),
	longitude: parseFloat(req.query.longitude),
	altitude: parseFloat(req.query.alt),
	speed: parseFloat(req.query.speed),
	crs: parseFloat(req.query.crs),
	source: "GPS2MyTracking",
	smsUTC: req.query.smsUTC
    };
    console.log(doc);
    insertPoint(doc, function () { res.end(); });
});

app.post("/gprmc/Data", function (req, res) {
    /*
      note in GPS2OpenGTS android, you have to escape your own account
      name as a query param, # -> %23
      
      http://aprs.gids.nl/nmea/#rmc
    */

    function toDeg(nmea, dir) {
	// http://aprs.gids.nl/nmea/#rmc like 4916.45 N -> 49deg 16.45min
	var degMin = nmea / 100;
	var deg = Math.floor(degMin);
	var min = (degMin - deg) * 100;
	var sign = (dir == "W" || dir == "S") ? -1 : 1;
	return sign * (deg + min / 60);
    }

    function metersPerSecFromKnots(knots) {
	return knots * .514444;
    }
    
    var cksum = req.query.gprmc.split("*");
    var fields = cksum[0].split(",");
    console.log(fields);
    if (fields[0] != "$GPRMC") {
	throw new Error("unknown gprmc format: "+req.query.gprmc);
    }
    if (fields[2] != "A") {
	throw new Error("bad gprmc validity: "+req.query.gprmc);
    }

    var doc = {
	user: req.query.acct,
	gprmcTime: {time: fields[1], date: fields[9]},
	latitude: toDeg(parseFloat(fields[3]), fields[4]),
	longitude: toDeg(parseFloat(fields[5]), fields[6]),
	velocity: metersPerSecFromKnots(parseFloat(fields[7])),
	bearing: parseFloat(fields[8]),
	variation: {degrees: parseFloat(fields[10] || "0"), dir: fields[11]},
	source: "GPS2OpenGTS"
    };
    console.log(doc);
    insertPoint(doc, function () { res.end(); });
});

// security trap- don't allow "/static/../secretfile" to work
app.get("/static/(bundle.js)", express.static(__dirname));
app.get("/images/*", express.static(__dirname + "/static/jquery-ui-1.8.17.custom/css/smoothness"));

var internal = express.createServer();
internal.listen(9086);
internal.use(express.bodyParser());
console.log('internal connections to http://localhost:9086/');

internal.post("/gotNewTrails", function (req, res) {
    io.sockets.in("mapUpdate").emit("gotNewTrails", req.body);
    res.send("");
});

