<!DOCTYPE html>
<html>
  <head>
    <title>map</title>
    <meta name="viewport" content="initial-scale=1.0, user-scalable=no"/>
    <link rel="Stylesheet" type="text/css" href="bundle.css?v={{bundleCss}}" media="all" >


    <script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.js" type="text/javascript"></script>
    <!-- /lib/jquery-2.0.3.min.js -->

    <script type="text/javascript">
      var updates = {{{updatesJson}}};
      var me = {{{me}}};
    </script>

    <script src="bundle.js?v={{bundleJs}}"></script>
<!--    <script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/jquery-ui.min.js"></script>-->

  </head>
  <body class="tundra">
    <canvas id="mapArea"></canvas>
    <div id="log"></div>

    <div id="scaleArea">scale: <input id="scale" name="scale" type="range" min="0.1" max="30" step="0.001" orientation="vertical" data-highlight="true"></div>


    <div class="controls">
      <h1 id="settings">Settings</h1>
      <div id="controls-collapse">
      <div class="section">
	<h2>People</h2>
	<div data-bind="foreach: people">
	  <div class="personRow">
	    <div class="user" data-bind="text: label"> </div>

	    <fieldset data-role="controlgroup" data-type="horizontal">
	      <div class="ui-radio">
	        <input type="radio" data-which="off" data-bind="uniqueId: $data, checked: mode" value="off" />
	        <label data-which="off" data-bind="uniqueFor: $data">Off</label>
	      </div>
              <div class="ui-radio">
	        <input type="radio" data-which="vis" data-bind="uniqueId: $data, checked: mode" value="visible" />
	        <label data-which="vis" data-bind="uniqueFor: $data">Visible</label>
	      </div>
              <div class="ui-radio">
	        <input type="radio" data-which="frame" data-bind="uniqueId: $data, checked: mode" value="frame" />
	        <label data-which="frame" data-bind="uniqueFor: $data">Always in view</label>
	      </div>
	    </fieldset>

	    <div class="showing">Showing <input data-role="none" type="text" size="10" data-bind="value: query"></div>
	    <div class="lastSeen">Last seen <span data-bind="text: lastSeen"></span> <span data-bind="text: recentPos"></span></div>
	  </div>
	</div>
      </div>
<!--<div class="section">
<h2>Places always in view</h2>
<ul>
<li>home <button>remove</button></li>
<li><input type="text"> autocomplete <button disabled="disabled">Add</button></li>
</ul>
<h2>Add place</h2>
<p>I am currently at <input type="text"> <button>Add to <span>perttula</span> map</button></p>
</div>-->
      <div class="section">
	<h2>Map</h2>
	<div>
	  <ul>
	    {{#mapIds}}
	    <li>
	      <input data-role="none" type="checkbox" id="map-{{row}}" onclick="toggleMap('{{label}}', this)" autocomplete="no"/> 
              <label for="map-{{row}}">{{label}} locations</label>
              <a href="{{editLink}}">Edit</a>
              <button data-role="none" class="mapRefresh" onclick="reloadMap('{{label}}', this)">Refresh from google</button>
                </li>
		{{/mapIds}}
		<li><input data-role="none" type="checkbox" disabled="disabled"> Openstreetmap layer</li>
		<li><input data-role="none" type="checkbox" disabled="disabled"> Traffic</li>
	      </ul>
	    </div>
	  </div>

	  <div>
	    <a data-ajax="false" href="history/">History</a>
	    <a data-ajax="false" href="gmap">[googlemap]</a>
	  </div>
          <div>
            <a href="logout">Logout</a>
          </div>
	  <div class="ctl">
	    <div id="paramDisplay"></div>
	  </div>
</div>

	</div>


  </body>
</html>
