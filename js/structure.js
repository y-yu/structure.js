/**
 * structure.js
 *
 * MIT Licensed.
 *
 * Copyright 2011 Bartek Szopka (@bartaz)
 */

(function (document, window) {
	'use strict';

	// HELPER FUNCTIONS

	var arrayify = function ( a ) {
		return [].slice.call( a );
	};

	var byId = function ( id ) {
		return document.getElementById(id);
	}

	var $ = function ( selector, context ) {
		context = context || document;
		return context.querySelector(selector);
	};

	var $$ = function ( selector, context ) {
		context = context || document;
		return arrayify( context.querySelectorAll(selector) );
	};

	// PREPARE DOM STRUCTURE

	var structure = byId("structure");
	
	var canvas = document.createElement("div");
	canvas.className = "canvas";
	
	arrayify( structure.childNodes ).forEach(function ( el ) {
		canvas.appendChild(el);
	});
	structure.appendChild(canvas);

	var presentation = function () {

		// HELPER FUNCTIONS
		
		var pfx = (function () {

			var style = document.createElement('dummy').style,
				prefixes = 'Webkit Moz O ms Khtml'.split(' '),
				memory = {};
				
			return function ( prop ) {
				if ( typeof memory[ prop ] === "undefined" ) {

					var ucProp  = prop.charAt(0).toUpperCase() + prop.substr(1),
						props   = (prop + ' ' + prefixes.join(ucProp + ' ') + ucProp).split(' ');

					memory[ prop ] = null;
					for ( var i in props ) {
						if ( style[ props[i] ] !== undefined ) {
							memory[ prop ] = props[i];
							break;
						}
					}

				}

				return memory[ prop ];
			}

		})();

		var css = function ( el, props ) {
			var key, pkey;
			for ( key in props ) {
				if ( props.hasOwnProperty(key) ) {
					pkey = pfx(key);
					if ( pkey != null ) {
						el.style[pkey] = props[key];
					}
				}
			}
			return el;
		}
		
				
		var translate = function ( t ) {
			return " translate3d(" + t.x + "px," + t.y + "px," + t.z + "px) ";
		};
		
		var rotate = function ( r, revert ) {
			var rX = " rotateX(" + r.x + "deg) ",
				rY = " rotateY(" + r.y + "deg) ",
				rZ = " rotateZ(" + r.z + "deg) ";
			
			return revert ? rZ+rY+rX : rX+rY+rZ;
		};
		
		var scale = function ( s ) {
			return " scale(" + s + ") ";
		}
		
		// CHECK SUPPORT
		
		var ua = navigator.userAgent.toLowerCase();
		var structureSupported = ( pfx("perspective") != null ) &&
							   ( ua.search(/(iphone)|(ipod)|(ipad)|(android)/) == -1 );
		
		// DOM ELEMENTS
		
		if (!structureSupported) {
			structure.className = "structure-not-supported";
			return;
		} else {
			structure.className = "";
		}
				
		canvas.classList.add("presentation");		
		
		// SETUP
		// set initial values and defaults
		
		document.documentElement.style.height = "100%";
		
		css(document.body, {
			height: "100%",
			overflow: "hidden"
		});

		var props = {
			position: "absolute",
			transformOrigin: "top left",
			transition: "all 0s ease-in-out",
			transformStyle: "preserve-3d"
		};
		
		css(structure, props);
		css(structure, {
			top: "50%",
			left: "50%",
			perspective: "1000px"
		});
		css(canvas, props); 
		
		// set depth of section structure

		(function sectionDepth ( section, depth ) {
			var children = arrayify(section.childNodes).filter(function ( child ) {
				return child.tagName == "SECTION";
			});

			depth = depth || -1;

			if ($$("section", section).length > 0) {
				depth = children.map(function ( childSection ) {
						return sectionDepth(childSection, depth);
					}).sort(function ( a, b ) {
						return a < b;
					}).shift() || 0;
			}
			depth++;

			children.forEach(function ( childSection ) {
				childSection.depth = depth;
			});

			return depth;
		})(canvas);

		// set transform data

		var setTransform = function ( step, position, depth ) {
			var data	  = step.parentNode.dataset,
				transform = { 
					translate: {
						x: data.x || position.x * 2000,
						y: data.y || position.y * 2000,
						z: data.z || 0
					},
					rotate: {
						x: data.rotateX || 0,
						y: data.rotateY || 0,
						z: data.rotateZ || data.rotate || 0
					},
					scale: data.scale || depth
				};
			
			step.stepData = transform;

			css(step, {
				position: "absolute",
				transform: "translate(-50%, -50%)" +
				translate(transform.translate) +
				rotate(transform.rotate) + 
				scale(transform.scale),
				transformStyle: "preserve-3d"
			});
		};

		// append slide to parent section

		var appendSlide = function ( section, position, depth ) {
			var step	= document.createElement("div");

			step.className = "step";

			arrayify(section.childNodes).filter(function ( c ) {
				return c.nodeType == 1 && c.tagName != "SECTION";
			}).forEach(function ( c ) {
				step.appendChild(section.removeChild(c));
			});

			section.insertBefore(step, section.firstChild);

			setTransform(step, position, depth);
		};

		var priviousDepth = Infinity,
			position = {
				x: 0,
				y: 0
			};
		
		$$("section", canvas).forEach(function ( section ) {
			if (section.depth == priviousDepth) {
				position.y++;
			} else if (section.depth > priviousDepth) {
				position.x++;
			}
			
			appendSlide(section, position, section.depth);

			priviousDepth = section.depth;
		});

		var steps = $$(".step", structure);

		steps.forEach(function ( el, idx ) {
			if ( !el.id ) {
				el.id = "step-" + (idx + 1);
			}
		});

		// making given step active

		var current = {
			translate: { x: 0, y: 0, z: 0 },
			rotate:	{ x: 0, y: 0, z: 0 },
			scale:	 1
		};

		var active = null;
		var hashTimeout = null;

		var select = function ( el ) {
			if ( !el || !el.stepData || el == active) {
				// selected element is not defined as step or is already active
				return false;
			}
			
			// Sometimes it's possible to trigger focus on first link with some keyboard action.
			// Browser in such a case tries to scroll the page to make this element visible
			// (even that body overflow is set to hidden) and it breaks our careful positioning.
			//
			// So, as a lousy (and lazy) workaround we will make the page scroll back to the top
			// whenever slide is selected
			//
			// If you are reading this and know any better way to handle it, I'll be glad to hear about it!
			window.scrollTo(0, 0);
			
			var step = el.stepData;
			
			if ( active ) {
				active.classList.remove("active");
			}
			el.classList.add("active");
			
			structure.className = "step-" + el.id;
			
			// `#/step-id` is used instead of `#step-id` to prevent default browser
			// scrolling to element in hash
			//
			// and it has to be set after animation finishes, because in chrome it
			// causes transtion being laggy
			window.clearTimeout( hashTimeout );
			hashTimeout = window.setTimeout(function () {
				window.location.hash = "#/" + el.id;
			}, 1000);
			
			var target = {
				rotate: {
					x: -parseInt(step.rotate.x, 10),
					y: -parseInt(step.rotate.y, 10),
					z: -parseInt(step.rotate.z, 10)
				},
				translate: {
					x: -step.translate.x,
					y: -step.translate.y,
					z: -step.translate.z
				},
				scale: 1 / parseFloat(step.scale)
			};
			
			// check if the transition is zooming in or not
			var zoomin = target.scale >= current.scale;

			// if presentation starts (nothing is active yet)
			// don't animate (set duration to 0)
			var duration = (active) ? "1s" : "0";
			
			css(structure, {
				// to keep the perspective look similar for different scales
				// we need to 'scale' the perspective, too
				perspective: step.scale * 1000 + "px",
				transform: scale(target.scale),
				transitionDuration: duration,
				transitionDelay: (zoomin ? "500ms" : "0ms")
			});
			
			css(canvas, {
				transform: rotate(target.rotate, true) + translate(target.translate),
				transitionDuration: duration,
				transitionDelay: (zoomin ? "0ms" : "500ms")
			});
			
			current = target;
			active = el;
			
			return el;
		};
		
		var selectPrev = function () {
			var prev = steps.indexOf( active ) - 1;
			prev = prev >= 0 ? steps[ prev ] : steps[ steps.length-1 ];
			
			return select(prev);
		};
		
		var selectNext = function () {
			var next = steps.indexOf( active ) + 1;
			next = next < steps.length ? steps[ next ] : steps[ 0 ];
			
			return select(next);
		};
		
		// EVENTS
		
		document.addEventListener("keydown", function keyControl ( event ) {
			switch( event.keyCode ) {
				case 33: ; // pg up
				case 37: ; // left
				case 38:   // up
					selectPrev();
					break;
				case 9:  ; // tab
				case 32: ; // space
				case 34: ; // pg down
				case 39: ; // right
				case 40:   // down
					selectNext();
					break;
				case 27:
					document.removeEventListener("keydown", keyControl);
					break;
			}
			
		}, false);

		document.addEventListener("click", function ( event ) {
			// event delegation with "bubbling"
			// check if event target (or any of its parents is a link or a step)
			var target = event.target;
			while ( (target.tagName != "A") &&
					(!target.stepData) &&
					(target != document.body) ) {
				target = target.parentNode;
			}
			
			if ( target.tagName == "A" ) {
				var href = target.getAttribute("href");
				
				// if it's a link to presentation step, target this step
				if ( href && href[0] == '#' ) {
					target = byId( href.slice(1) );
				}
			}
			
			if ( select(target) ) {
				event.preventDefault();
			}
		}, false);
		
		var getElementFromUrl = function () {
			// get id from url # by removing `#` or `#/` from the beginning,
			// so both "fallback" `#slide-id` and "enhanced" `#/slide-id` will work
			return byId( window.location.hash.replace(/^#\/?/,"") );
		}
		
		window.addEventListener("hashchange", function () {
			select( getElementFromUrl() );
		}, false);
		
		// START 
		// by selecting step defined in url or first step of the presentation
		select(getElementFromUrl() || steps[0]);
	};

	var currentMode = "not presentation";

	var toggleMode = function () {
		var cleanPresentation = function () {
			var canvas = document.getElementsByClassName("canvas")[0];

			$$(".step", document).forEach(function ( slide ) {
				arrayify(slide.childNodes).map(function ( c ) {
					return slide.removeChild(c);
				}).forEach(function ( c, idx ) {
					slide.parentNode.insertBefore(c, (c.previousSibling || slide.parentNode.firstChild));
				});

				slide.parentNode.removeChild(slide);
			});

			
			arrayify(canvas.style).forEach(function (prop) {
				canvas.style.removeProperty(prop);
			});
			canvas.classList.remove("presentation");

			arrayify(structure.style).forEach(function (prop) {
				structure.style.removeProperty(prop);
			});
			structure.className = "";
		};
	
		if (currentMode == "presentation") {
			cleanPresentation();
			currentMode = "not presentation";
		} else {
			presentation();
			currentMode = "presentation";
		}
	};

	document.addEventListener("keydown", function ( event ) {
		if (event.keyCode == 27) {
			toggleMode();
		}
	}, false);
})(document, window)

