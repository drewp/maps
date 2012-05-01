<!DOCTYPE html>
<html>
  <head>
    <title>map</title>
    <meta name="viewport" content="width=320, initial-scale=1.0, user-scalable=yes"/>
    <link rel="Stylesheet" type="text/css" href="bundle.css?v={{bundleCss}}" media="all" >


    <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.js" type="text/javascript"></script> 
    <script src="http://code.jquery.com/mobile/1.1.0/jquery.mobile-1.1.0.js"></script>

    <script type="text/javascript">
      var updates = {{{updatesJson}}};
      var me = {{{me}}};
    </script>

    <script src="bundle.js?v={{bundleJs}}"></script>
<!--    <script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/jquery-ui.min.js"></script>-->

  </head>
  <body class="tundra">
    <table>
      <tr>
        <td>
          <canvas id="mapArea" data-toucharea="true"></canvas>
	  <div>scale: <input id="scale" name="scale" type="range" min="0.1" max="30" step="0.001" data-highlight="true"></div>
        </td>
        <td>
          <div class="controls">
            <div class="section">
              <h2>People</h2>
              <div data-bind="foreach: people">
                <div class="personRow">
                  <div class="user" data-bind="text: label"> </div>
                  <div class="on">
		    <input type="checkbox" data-bind="checked: visible"> Visible
		  </div>
                  <div class="follow"><input type="checkbox" data-bind="checked: follow"> Follow</div>
                  <div class="showing">Showing <input data-role="none" type="text" size="10" data-bind="value: query"></div>
                  <div class="lastSeen">Last seen <span data-bind="text: lastSeen"></span> <span data-bind="text: recentPos"></span></div>
                </div>
              </div>
            </div>
            <div class="section">
              <h2>Map</h2>
              <div>
                <ul>
                  {{#mapIds}}
                  <li>
                    <input data-role="none" type="checkbox" id="map-{{row}}" onclick="toggleMap('{{id}}', this)" autocomplete="no"/> 
                    <label for="map-{{row}}">{{id}} locations</label> <button data-role="none" class="mapRefresh" onclick="reloadMap('{{id}}', this)">Refresh from google</button>
                  </li>
                  {{/mapIds}}
                  <li><input data-role="none" type="checkbox" disabled="disabled"> Openstreetmap layer</li>
                  <li><input data-role="none" type="checkbox" disabled="disabled"> Traffic</li>
                </ul>
              </div>
            </div>

            <div>
              <a href="history">[history]</a>
              <a href="gmap">[googlemap]</a>
            </div>
            <div class="ctl">
              <div id="paramDisplay"></div>
              <div>socket.io: <span id="socketStat"></span></div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
