function Places() {
    /*
      all the location points that are loaded. When the point change,
      we fire window.locationsChanged
    */
    var self = this;
    var placeCenters = new RTree(); // place center points -> place obj

    var loadedPlaces = []; // [{id: "", places: []}]

    function rebuild() {
        placeCenters = new RTree();
        $.each(loadedPlaces, function (i2, lp) {
            $.each(lp.places, function (i, pl) {
	        var box = {x: pl[1][1], y: pl[1][0], w: .0001, h:.0001};
                
	        placeCenters.insert(box, {
                    label: pl[0], 
                    order: i, 
                    worldPoint: Point(pl[1][1], pl[1][0])});
            });
        });
        $(window).trigger("locationsChanged");
    }

    this.getIds = function (cb) {
        $.getJSON("places", function (result) {
            cb(result.mapIds);
        });
    };

    this.addPlaces = function (id, forceReload) {
        if (self.showingPlaces(id)) return;
        $.getJSON("places/map", {m: id, forceReload: forceReload ? "1" : ""}, 
                  function (result) {
                      loadedPlaces.push({id: id, places: result.places});
                      rebuild();
                  });
    };
    this.removePlaces = function (id) {
        loadedPlaces = loadedPlaces.filter(function (e) { return e.id != id; });
        rebuild();
    };
    this.showingPlaces = function (id) {
        return loadedPlaces.some(function (e) { return e.id == id; });
    };
    this.reloadPlaces = function (id) {
        // caller needs to note that this always adds the places
        if (self.showingPlaces(id)) {
            self.removePlaces(id);
        }
        self.addPlaces(id, true);
    };
    this.worldExtent = function () {

    };
    this.search = function (worldView) {
        return placeCenters.search(worldView);
    };

}