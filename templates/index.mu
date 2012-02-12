<html xmlns="http://www.w3.org/1999/xhtml"
xmlns:py="http://genshi.edgewall.org/">
  <head>
    <title>map</title>
    <meta name="viewport" content="width=320; initial-scale=1.0; minimum-scale: .01; user-scalable=yes"/>

    <style type="text/css">
      /* <![CDATA[ */
body {
 font-family: sans;
font-size: 11px;
}
      .ctl input {
	  width: 300px;
      }
      #mapArea {
	  width: 600px;
	  height: 600px;
	  background: #dddbf4;
      }
@media screen and (max-device-width: 480px) {
      #mapArea {
	  width: 310px;
	  height: 310px;
      }
}

      .ui-slider-horizontal {
	  height: 20px;
	  width: 250px;
	  display: inline-block;
      }
.personRow:after {
    content: ".";
    display: block;
    height: 0;
    clear: both;
    visibility: hidden;
}
.personRow > .user {
    background: #ccc;
    font-size: 120%;
    font-weight: bold;
    padding: 3px;
  }
  .personRow > .on  {float:left; width: 65px;}
.personRow > .showing  {}
.personRow > .follow  {float:left; width: 70px;}
.personRow > .xlastSeen:after {
    content: ".";
    display: block;
    height: 0;
    clear: both;
    visibility: hidden;
}

.section {
 background: #eee;
width: 335px;
}

.controls {
 float:right;
}
table td {
 vertical-align: top;
}

.mapRefresh {
    font-size: 80%;
}
      /* ]]> */
    </style>

    <link rel="Stylesheet" type="text/css" href="bundle.css?v={{bundleCss}}" media="all" />

  </head>
  <body class="tundra">
    <table>
      <tr>
        <td>
          <canvas id="mapArea"/>
        </td>
        <td>
          <div class="controls">
            <div class="section">
              <h2>People</h2>
              <div data-bind="foreach: people">
                <div class="personRow">
                  <div class="user" data-bind="text: label"> </div>
                  <div class="on"><input type="checkbox" data-bind="checked: visible"/> Visible</div>
                  <div class="follow"><input type="checkbox" data-bind="checked: follow"/> Follow</div>
                  <div class="showing">Showing <input type="text" size="10" data-bind="value: query"/></div>
                  <div class="lastSeen">Last seen <span data-bind="text: lastSeen"/> <span data-bind="text: recentPos"></span></div>
                </div>
              </div>
            </div>
            <div class="section">
              <h2>Map</h2>
              <div>
                <ul>
                  {{#mapIds}}
                  <li>
                    <input type="checkbox" id="map-{{row}}" autocomplete="off" onclick="toggleMap('{{id}}', this)"/> 
                    <label for="map-{{row}}">{{id}} locations</label> <button class="mapRefresh" onclick="reloadMap('{{id}}', this)">Refresh from google</button>
                  </li>
                  {{/mapIds}}
                  <li><input type="checkbox" disabled="yes"/> Openstreetmap layer</li>
                  <li><input type="checkbox" disabled="yes"/> Traffic</li>
                </ul>
              </div>
            </div>

            <div>
              <a href="history">[history]</a>
              <a href="gmap">[googlemap]</a>
            </div>
            <div class="ctl">
              <div>scale: <span id="scale"/></div>
              <div id="paramDisplay"/>
              <div>socket.io: <span id="socketStat"/></div>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.js" type="text/javascript"></script> 
    <script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/jquery-ui.min.js"></script>
    <script type="text/javascript" src="bundle.js?v={{bundleJs}}"></script>

    <script type="text/javascript">
      // <![CDATA[
      var toggleMap, reloadMap;
      $(function () {
          var m = makeMap('mapArea', {useStomp:false, trailUri: "trails"});
          toggleMap = function (id, elem) {
              var check = $(elem).closest("li").find("input")[0];
              if (check.checked) {
                  m.places.addPlaces(id);
              } else {
                  m.places.removePlaces(id);
              }
          };
          reloadMap = function (id, elem) {
              var check = $(elem).closest("li").find("input")[0];
              check.checked = true
              m.places.reloadPlaces(id);
          };

          // "user prefs"
          $("input").each(function (i, elem) { 
              if (elem.getAttribute("onclick") == "toggleMap('Perttula', this)") {
                  $(elem).click(); 
                  toggleMap('Perttula', elem);
              } 
          });

          var socket = io.connect('/map/', {resource: "map/socket.io"});

          function recentPosMessage(update) {
              return ", velocity "+update.velocity+", altitude "+update.altitude;
          }

          var updates = {{{updatesJson}}};
          var people = updates.map(function (u) {
              var p = {
                  label: u.label,
                  visible: ko.observable(true),
                  follow: ko.observable(false),
                  query: ko.observable("last 50 points"),
                  lastSeen: ko.observable(u.timestamp),
                  recentPos: ko.observable(recentPosMessage(u))
              };
              p.visible.subscribe(function (newValue) {
                  console.log(p.label, newValue);
              });
              return p;

          });
          
          ko.applyBindings({people: people});
          
          var stat = function (t) { $("#socketStat").text(t); };
          stat("startup");
          socket.on('reconnect_failed', function (r) { stat("reconnect failed"); });
          socket.on("error", function (r) { stat("error "+r); });
          socket.on("connecting", function (how) { stat("connected via "+how); });
          socket.on("disconnect", function () { stat("disconnected"); });
          socket.on("connect_failed", function (r) { stat("connect failed: "+r); })

	  socket.of("").on("gotNewTrails", function (r) { m.gotNewTrails(r); });
      });
      // ]]>
    </script>
  </body>
</html>
