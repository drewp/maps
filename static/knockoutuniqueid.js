
// http://stackoverflow.com/questions/9233176/unique-ids-in-knockout-js-templates
ko.bindingHandlers.uniqueId = {
    /*
      data-bind="uniqueId: $data" to stick a new id on $data and
      use it as the html id of the element. 
      
      data-which="foo" (optional) adds foo to the id, to separate
      it from other ids made from this same $data.
    */
    counter: 0,
    _ensureId: function (value, element) {
	
	if (value.id === undefined) {
	    value.id = "elem" + (++ko.bindingHandlers.uniqueId.counter);
	}

	var id = value.id, which = element.getAttribute("data-which");
	if (which) {
	    id += "-" + which;
	}
	return id;
    },
    init: function(element, valueAccessor) {
        var value = valueAccessor();
        element.id = ko.bindingHandlers.uniqueId._ensureId(value, element);
    },
};

ko.bindingHandlers.uniqueFor = {
    /*
      data-bind="uniqueFor: $data" works like uniqueId above, and
      adds a for="the-new-id" attr to this element.
      
      data-which="foo" (optional) works like it does with uniqueId.
    */
    init: function(element, valueAccessor) {
        element.setAttribute(
	    "for", ko.bindingHandlers.uniqueId._ensureId(valueAccessor(),
							 element));
    } 
};
