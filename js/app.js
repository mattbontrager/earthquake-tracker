var development = false;

var App = (function() {
	var self,
	oneMonth = (function() {
		return moment.duration({ 'months': 1 });
	}()),
	oneWeek = (function() {
		return moment.duration({ 'weeks': 1 });
	}()),
	oneDay = (function() {
		return moment.duration({ 'days': 1 });
	}()),
	oneMonthAgo = function() {
		return moment().subtract(oneMonth).format('YYYY-MM-DD');
	},
	oneWeekAgo = function() {
		return moment().subtract(oneWeek).format('YYYY-MM-DD');
	},
	oneDayAgo = function() {
		return moment().subtract(oneDay).format('YYYY-MM-DD');
	},
	today = function() {
		return moment().format('YYYY-MM-DD');
	},
	$appNav = $('#app-nav'),
	$button = $('button'),
	$appNavButton = $('.app-nav').find('button'),
	$infoNavButton = $('.info-nav').find('button'),
	$form = $('form'),
	$formButton = $form.find('button'),
	inputs = $form.find('input'),
	selects = $form.find('select'),
	$mapContainer = $('#map-container'),
	mininumMagnitude = 0,
	maximumMagnitude = 10,
	computeStartTime = function(newStartTime) {
		var toReturn;
		if (!newStartTime) {
			/**
			 * set default if no user input or on first run
			 * @type {momentObject}
			 */
			toReturn = oneMonthAgo();
		}
		switch (newStartTime) {
			case "days":
				toReturn = oneDayAgo();
				break;
			case "weeks":
				toReturn = oneWeekAgo();
				break;
			case "months":
				toReturn = oneMonthAgo();
		}
		return toReturn;
	},
	startTime = computeStartTime(),
	endTime = today(),
	quantity = 250,
	mapTilesURL = 'http://{s}.tiles.mapbox.com/v3/mattbontrager.jldf7gcc/{z}/{x}/{y}.png',
	earthquakeAPIUrlPrepend = 'http://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson';

	return {
		earthquakes: [],
		eqMap: '',
		geoJsonLayer: '',
		init: function appInit() {
			!!development && console.log('in appInit');
			self = (!self) ? this : self;

			// bind DOM handlers
			self.uiBindings();

			$.when(self.getEarthquakes()).then(function getEarthquakesSuccess() {
				// ensure map is visible in DOM so leaflet can attach to it
				self.showMapContainer();

				/**
				 * instantiate eqMap on first run,
				 * refer to it every other time it is called
				 * @type {leafletMapObject}
				 */
				self.eqMap = (!self.eqMap) ? self.eqMap = L.map('map', {
					zoom: 2,
					minZoom: 2,
					maxZoom: 18,
				}).setView([38.889931, -77.009003], 3) : self.eqMap;


				/**
				 * add the mapbox map tiles
				 */
				L.tileLayer(mapTilesURL, {
					maxZoom: 18,
					detectRetina: true
				}).addTo(self.eqMap);

				/**
				 * earthquakes have been called and stored in array;
				 * process map layers from earthquake information
				 */
				self.processLayers();
			}).catch(function getEarthquakesFail(err) {
				!!development && console.error('getEarthquakes fail: ', err);
				throw new Error(err);
			});
		},
		getApiURL: function getApiURL() {
			// dynamically generate the api url based on user input
			!!development && console.log('in getApiURL');
			return 'http://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=' + startTime + '&endtime=' + endTime + '&minmagnitude=' + mininumMagnitude + '&maxmagnitude=' + maximumMagnitude + '&limit=' + quantity + '&eventtype=earthquake';
		},
		showMapContainer: function showMapContainer() {
			// method to ensure map container is visible
			// to keep functionality modular
			!!development && console.log('in showMapContainer');
			$mapContainer.siblings().hide().end().fadeIn();
		},
		getEarthquakes: function getEarthquakes() {
			// using a promise to maintain chronology
			// of application logic in tact
			return $.Deferred(function(gedfd) {
				!!development && console.log('in getEarthquakes');
				var quakeApiUrl = self.getApiURL();

				!!development && console.log('quakeApiUrl: ', quakeApiUrl);
				$.getJSON(quakeApiUrl).done(function quakeReturnSuccess(data) {
					!!development && console.log('data: ', data);
					if (!data) {
						var msg = 'finished calling all quakes. no return';
						!!development && console.warn(msg);
						gedfd.reject(msg);
					} else {
						// clear all stored earthquakes
						self.earthquakes.length = 0;

						$.each(data.features, function(i, quake) {
							self.earthquakes.push(quake);
						});

						if (development) {
							window.Earthquakes = self.earthquakes;
						}
						gedfd.resolve();
					}
				}).fail(function(err) {
					throw new Error(err);
				});
			}).promise();
		},
		processLayers: function processLayers() {
			!!development && console.log('in processLayers');
			// ensure there are earthquakes to process

			if (self.geoJsonLayer !== '') {
				self.eqMap.removeLayer(self.geoJsonLayer);
				self.geoJsonLayer = '';
			}

			self.geoJsonLayer = L.geoJson(self.earthquakes, {
				onEachFeature: function(feature, layer) {
					var eqTime = moment(parseInt(feature.properties.time, 10)),
						popupContent = '<p style="font-weight: bold;">Magnitude: ' + parseFloat(feature.properties.mag) + '</p><p>Time: ' + eqTime.fromNow() + '</p><p>' + feature.properties.place + '</p><p><a href="' + feature.properties.url + '" target="_blank">View this on USGS</a></p>';
					layer.bindPopup(popupContent);
				},
				pointToLayer: function(feature, latlng) {
					var mag = Math.round(Math.floor(parseFloat(feature.properties.mag))),
						tinyIcon = L.Icon.extend({
							options: {
								shadowUrl: "images/marker-shadow.png",
								iconSize: [25, 39],
								iconAnchor: [12, 36],
								shadowSize: [41, 41],
								shadowAnchor: [12, 38],
								popupAnchor: [0, -30]
							}
						}),
						redIcon = new tinyIcon({ iconUrl: "images/marker-red.png" }),
						blueIcon = new tinyIcon({ iconUrl: "images/marker-blue.png" }),
						yellowIcon = new tinyIcon({ iconUrl: "images/marker-yellow.png" });

					if (mag < 5) {
						return L.marker(latlng, { icon: blueIcon });
					} else if ((mag > 4) && (mag < 7)) {
						return L.marker(latlng, { icon: yellowIcon });
					} else if (mag > 6) {
						return L.marker(latlng, { icon: redIcon });
					} else {
						return L.marker(latlng, { icon: blueIcon });
					}
				},
				filter: function(feature, layer) {
					var mag = Math.round(Math.floor(parseFloat(feature.properties.mag))),
						earthquakeTime = moment(parseInt(feature.properties.time, 10));

					return ((mag >= mininumMagnitude) && (mag <= maximumMagnitude) && (earthquakeTime.isSameOrAfter(startTime) <= 1)) ? true : false;
				}
			});

			self.geoJsonLayer.addTo(self.eqMap);

			var $mapButton = $('.app-nav').find('.mapButton');

			$mapButton.siblings().removeClass('active');
			$mapButton.addClass('active');

			self.showMapContainer();
		},
		resetMapSize: function resetMapSize($toReveal) {
			// required to have leaflet map continue
			// to fill screen when orientation or window
			// size is changed
			!!development && console.log('in resetMapSize');
			$toReveal.fadeIn(function() {
				self.eqMap.invalidateSize();
			});
		},
		clearForm: function clearForm() {
			!!development && console.log('in clearForm');
			selects.val(0);
		},
		addErrorBorder: function addErrorBorder(elem) {
			!!development && console.log('in addErrorBorder', elem);
			/**
			 * TODO: make it a pulsing red border by adding class
			 */

			elem.addClass('error-message-pulse');
		},
		removeErrorBorder: function removeErrorBorder(elem) {
			!!development && console.log('in removeErrorBorder', elem);
			elem.removeClass('error-message-pulse');
		},
		createErrorMessageContainer: function createErrorMessageContainer(msg) {
			!!development && console.log('in createErrorMessageContainer');
			return $('<p />', {
				class: 'error-message',
				text: msg
			});
		},
		insertErrorMessage: function insertErrorMessage(errorElem, errorMsg) {
			!!development && console.log('in insertErrorMessage', errorElem);
			errorMsg.insertAfter(errorElem);
		},
		formErrorMessage: function formErrorMessage(elem, msg) {
			!!development && console.log('in formErrorMessage... element: ' + elem + '\r\n error: ' + msg);
			self.insertErrorMessage(elem, self.createErrorMessageContainer(msg));
		},
		uiBindings: function uiBindings() {
			!!development && console.log('in uiBindings');

			//* handle app navigation */
			$appNavButton.off('click').on('click', function(e) {
				e.preventDefault();
				e.stopPropagation();

				var $me = $(e.target),
					method = $me.data('method'),
					elementID = $me.attr('id'),
					idToReveal = $me.data('id'),
					$toReveal = $('#' + idToReveal);

				if (elementID !== 'home') {
					$me.siblings().removeClass('active');
					$me.addClass('active');

					$toReveal.siblings().hide();

					if (idToReveal === 'map-container') {
						self.resetMapSize($toReveal);
					} else if (idToReveal === 'info-container') {
						!!development && console.log('going to reveal info-container');

						/**
						 * ensure first article appears first
						 * regardless of where they left off
						 */

						var $firstArticle = $('#before'),
							$sibsToHide = $firstArticle.siblings().not('nav'),
							$buttonToActivate = $infoNavButton.first(),
							$buttonsToDeactivate = $buttonToActivate.siblings();

						$buttonsToDeactivate.removeClass('active');
						$buttonToActivate.addClass('active');
						$sibsToHide.hide();
						$firstArticle.show();
						$toReveal.fadeIn();
					} else {
						$toReveal.fadeIn();
					}
				}
			});

			//* handle information section navigation */
			$infoNavButton.off('click').on('click', function(e) {
				e.preventDefault();
				e.stopPropagation();

				var $me = $(e.target),
					idToReveal = $me.data('id'),
					$toReveal = $('#' + idToReveal),
					$toHide = $toReveal.siblings().not('nav');

				/**
				 * remove active class from sibling nav elements
				 * add active class to active nav element
				 */
				$me.siblings().removeClass('active').end().addClass('active');
				// $me.addClass('active');

				// hide sibling articles
				$toHide.hide();

				// reveal selected article
				$toReveal.fadeIn();
			});

			//* handle form submission or clear */
			$formButton.off('click').on('click', function(e) {
				e.preventDefault();
				e.stopPropagation();

				var $me = $(e.target),
					method = $me.data('method'),
					$lowMag = $('#low_mag'),
					$highMag = $('#high_mag'),
					$timeRange = $('#time_range'),
					$quantity = $('#quantity'),
					lowMagVal = ($lowMag.val() > 0) ? $lowMag.val() : undefined,
					highMagVal = ($highMag.val() > 0) ? $highMag.val() : undefined,
					timeRangeVal = ($timeRange.val() !== "0") ? $timeRange.val() : undefined,
					quantityVal = $quantity.val();


				if (method === 'clear') {
					self.clearForm();
				} else if (method === 'submit') {
					if (!lowMagVal) {
						self.formErrorMessage($lowMag, 'Please choose a minimum magnitude');
					} else if (!highMagVal) {
						self.formErrorMessage($highMag, 'Please choose a maximum magnitude');
					} else if (!timeRangeVal) {
						self.formErrorMessage($timeRange, 'Please choose a time frame');
					} else {
						mininumMagnitude = parseInt(lowMagVal, 10);
						maximumMagnitude = parseInt(highMagVal, 10);
						quantity = parseInt(quantityVal, 10);
						!!development && console.log('startTime before: ', startTime);
						startTime = computeStartTime(timeRangeVal);
						!!development && console.log('startTime after: ', startTime);
						var $errorMsgs = $form.find('.error-message');
						$errorMsgs.remove();
						self.init();
					}
				}
			});
		}
	};
}());

$(function() {
	!!development && console.log('starting app');
	App.init();
});
