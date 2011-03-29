static/bundle.js: \
  sendpos/app/assistants/Orbited-local.js \
  sendpos/app/assistants/Orbited-patch.js \
  sendpos/app/assistants/orbited/protocols/stomp/stomp.js \
  sendpos/app/assistants/gury/gury.js \
  sendpos/app/assistants/matrix.js/matrix.js \
  sendpos/app/assistants/RTree/src/rtree.js \
  sendpos/app/assistants/jquery.mousewheel.3.0.2/jquery.mousewheel.min.js \
  sendpos/app/assistants/canvasmap.js
	cat $+ | python jsmin.py > $@
	cp $@ sendpos/bundle.js
#	cat $+ > $@
