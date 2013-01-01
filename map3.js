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
var _ = require('underscore');
var Mu = require('Mu');
var shared = require('./static/shared.js');
Mu.templateRoot = './templates/';

var proxy = new httpProxy.RoutingProxy();

var app = express();
var server = http.createServer(app);
server.listen(9085);

console.log('users come to http://localhost:9085/');

var prod = process.env.NODE_ENV == "production";
var am = assetManager({
    'js' : {
        path: __dirname + "/",
        route: /\/bundle\.js/,
        dataType: 'javascript',
        files: [
            'parts/node/lib/node_modules/socket.io/node_modules/socket.io-client/dist/' + (prod ? 'socket.io.min.js' : 'socket.io.js'),
            'static/lib/gury/' + (prod ? 'gury.min.js' : 'gury.js'),
            'static/lib/matrix.js/' + (prod ? 'matrix-1.2.0.min.js' : 'matrix.js'),
            'static/lib/RTree/src/rtree.js',
            'static/lib/jquery.mousewheel.3.0.2/jquery.mousewheel.min.js',
            'static/lib/' + (prod ? 'knockout-2.0.0.js' : 'knockout-2.0.0.debug.js'),
	    'parts/node/lib/node_modules/underscore/underscore.js',
	    'static/lib/jquery.toucharea.js',
		//'static/lib/flexie.min.js',
	    'parts/node/lib/node_modules/moment/min/moment.min.js',
	    'static/shared.js',
            'static/backgroundmap.js',
            'static/canvasmap.js',
	    'static/knockoutuniqueid.js',
	    'static/page.js'
        ],
	stale: false,
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
	stale: false,
        debug: !prod,
        files: [//"static/jquery-ui-1.8.17.custom/css/smoothness/jquery-ui-1.8.17.custom.css",
	    //"static/lib/jquery.mobile-1.2.0.css",
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

var io = socketIo.listen(server);
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
    var client = new mongodb.Db(m.db, 
				new mongodb.Server(m.host, m.port), 
				{safe: true});
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
    return _.extend({label: config.foafNames[uri] || uri}, 
		    config.style[uri] || {});
}

app.get("/", function (req, res) { 
    res.header("content-type", "text/html");//application/xhtml+xml");
    superagent.get("http://localhost:9084/places", function (placesResult) {
        lastUpdates(function (updates) {

            updates.forEach(function (u) { 
		_.extend(u, getLabelForUri(u.user));
		u.lastSeen = shared.lastSeenFormat(u.timestamp);
            });

            var j = 0;
            mapIds = placesResult.body.maps.map(function (m) { 
		j++;
		return {label: m.label, uri: m.uri, row: j} 
	    });
            var ctx = {
                bundleCss: am.cacheHashes['css'],
                bundleJs: am.cacheHashes['js'],
                mapIds: mapIds,
                updates: updates,
                updatesJson: JSON.stringify(updates),
		me: JSON.stringify(req.get("x-foaf-agent"))
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

app.get("/places/*", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9084});
});

app.get("/history", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});
app.get("/gmap", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});
app.get("/trails", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9099});
});

// security trap- don't allow "/static/../secretfile" to work
app.get("/static/(bundle.js)", express.static(__dirname));
app.get("/images/*", express.static(__dirname + "/static/jquery-ui-1.8.17.custom/css/smoothness"));

var internal = express();
internal.listen(9086);
internal.use(express.bodyParser());
console.log('internal connections to http://localhost:9086/');

internal.post("/gotNewTrails", function (req, res) {
    io.sockets.in("mapUpdate").emit("gotNewTrails", req.body);
    res.send("");
});

