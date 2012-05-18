define(["core/Application", "core/FlxState", "applications/calendar/Builder", "libs/bootstrap-datepicker"], function(Application, FlxState, Builder) {

	var Calendar = new Application("calendar", "Candide Kemmler", "icon-calendar");

    Calendar.currentTabName = Builder.tabs["DAY"][0];
    Calendar.currentTab = null;
    Calendar.tabState = null;
    Calendar.digest = null;
    Calendar.timeUnit = "DAY";

	var start, end;
	
	Calendar.setup = function() {
		$(".menuNextButton").click(function(e) {
			fetchState("/nav/incrementTimespan.json"); });
		$(".menuPrevButton").click(function(e) {
			fetchState("/nav/decrementTimespan.json"); });
		$(".menuTodayButton").click(function(e) {
			Calendar.timeUnit = "DAY";
			var t = Builder.tabExistsForTimeUnit(Calendar.currentTabName, Calendar.timeUnit)?Calendar.currentTabName:Builder.tabs[Calendar.timeUnit][0];
			Calendar.currentTabName = t;
			Builder.createTimeUnitsMenu(Calendar);
			Builder.createTabs(Calendar);
			fetchState("/nav/setToToday.json");
		});
	};
	
	Calendar.initialize = function () {
		_.bindAll(this);

        FlxState.router.route(/^app\/calendar(\/?)(.*?)$/, "", function() {
            var parse_url = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
            var result = parse_url.exec(window.location.href);
            var names = [ 'url', 'scheme', 'slash', 'host', 'port', 'path' ];
            var i;
            var parts = {};
            for (i = 0; i < names.length; i += 1)
                parts[names[i]] = result[i];
            console.log("path: " + parts.path);
            var pathElements = parts.path.split("/");
            if (pathElements.length<3)
                App.invalidPath();
            var splits = {};
            var splitNames = ["app", "appName", "tabName", "timeUnit"];
            for (i = 0; i < pathElements.length; i += 1)
                splits[splitNames[i]] = pathElements[i];
            var validTab = _.include(["clock","map","diary","photos","list","timeline"], splits.tabName),
                validTimeUnit = _.include(["date","week","month","year"], splits.timeUnit);
            if (validTab && validTimeUnit) {
                var tab = Builder.tabExistsForTimeUnit(splits.tabName, Calendar.timeUnit)?splits.tabName:Builder.tabs[Calendar.timeUnit][0];
                switch (splits.timeUnit) {
                    case "date":
                        var date = pathElements[4];
                        Calendar.render(tab + "/date/" + date);
                        break;
                    case "week":
                        var year = pathElements[4],
                            week = pathElements[5];
                        Calendar.render(tab + "/week/" + year + "/" + week);
                        break;
                    case "month":
                        var year = pathElements[4],
                            month = pathElements[5];
                        Calendar.render(tab + "/month/" + year + "/" + month);
                        break;
                    case "year":
                        var year = pathElements[4];
                        Calendar.render(tab + "/year/" + year);
                        break;
                }
            } else
                App.invalidPath();
        });
    };
		
	Calendar.renderState = function(state, force) {
		if (!force&&FlxState.getState("calendar")===state) {
			return;
		}
		if (state==null||state==="") {
			Builder.createTimeUnitsMenu(Calendar);
			Builder.createTabs(Calendar);
			fetchState("/nav/setToToday.json");
            return;
		}
		var splits = state.split("/");
		Calendar.currentTabName = splits[0];
        if (!Builder.isValidTabName(splits[0])) {
            App.invalidPath();
            return;
        }
        if (!Builder.isValidTimeUnit(splits[1])) {
            App.invalidPath();
            return;
        }
        Calendar.timeUnit = toTimeUnit(splits[1]);
		var nextTabState = state.substring(splits[0].length+1);
        var w = Builder.tabExistsForTimeUnit(Calendar.currentTabName, Calendar.timeUnit)?Calendar.currentTabName:Builder.tabs[Calendar.timeUnit][0];
        Calendar.currentTabName = w;
        Builder.createTabs(Calendar);
        if (Calendar.tabState==nextTabState) {
			// time didn't change
			Builder.updateTab(Calendar.digest, Calendar);
			FlxState.router.navigate("app/calendar/" + state);
			FlxState.saveState("calendar", state);
			return;
		} else {
            Builder.createTimeUnitsMenu(Calendar);
            if ("DAY"===Calendar.timeUnit) {
				fetchState("/nav/setDate.json?date=" + splits[2]);
			} else if ("WEEK"===Calendar.timeUnit) {
				fetchState("/nav/setWeek.json?year=" + splits[2] + "&week=" + splits[3]);
			} else if ("MONTH"===Calendar.timeUnit) {
				fetchState("/nav/setMonth.json?year=" + splits[2] + "&month=" + splits[3]);
			} else if ("YEAR"===Calendar.timeUnit) {
				fetchState("/nav/setYear.json?year=" + splits[2]);
			}
		}
	};
	
	function fetchState(url) {
		$(".calendar-navigation-button").toggleClass("disabled");
		$(".loading").show();
		$("#tabs").css("opacity", ".3");
		$.ajax({ url:url,
			success : function(response) {
				if (Calendar.currentTab) {
					Calendar.currentTab.saveState();
				}
				Calendar.tabState = response.state;
				FlxState.router.navigate("app/calendar/" + Calendar.currentTabName + "/" + response.state);
				FlxState.saveState("calendar", Calendar.currentTabName + "/" + response.state);
				$("#currentTimespanLabel span").html(response.currentTimespanLabel);
				if (Calendar.timeUnit==="DAY") {
					setDatepicker(response.state.split("/")[1]);
				}
				fetchCalendar("/api/calendar/all/" + response.state);
			},
			error : function() {
				alert("error");
			}
		});
	}
	
	function setDatepicker(currentDate) {
		$("#datepicker").attr("data-date", currentDate);
		$("#datepicker").unbind("changeDate");
		$("#datepicker").datepicker().on(
			"changeDate", function(event) {
				var curr_date = event.date.getDate();
				var curr_month = event.date.getMonth() + 1;
				var curr_year = event.date.getFullYear();
				var formatted = curr_year + "-" + curr_month + "-" + curr_date;
				fetchState("/nav/setDate.json?date=" + formatted);
				$(".datepicker").hide();
			}
		);
	}
	
	function fetchCalendar(url) {
		$.ajax({ url: url,
			success : function(response) {
				$("#modal").empty();
                if (Calendar.timeUnit==="DAY")
                    handleCityInfo(response);
                else
                    $("#mainCity").empty();
                Calendar.digest = response;
				Builder.updateTab(response, Calendar);
				$("#tabs").css("opacity", "1");
				$(".calendar-navigation-button").toggleClass("disabled");
				$(".loading").hide();
			},
			error: function() {
				alert("error fetching calendar");
			}
		});
	}

    function handleCityInfo(digestInfo) {
        $("#mainCity").empty();
        if (digestInfo.cities&&digestInfo.cities.length>0) {
            $("#mainCity").html(cityLabel(digestInfo.cities[0]) +
                                temperaturesLabel(digestInfo))
        }
    }

    function ephemerisLabel(digestInfo) {
        var sunriseH = Math.floor(digestInfo.solarInfo.sunrise/60);
        var sunriseM = digestInfo.solarInfo.sunrise%60;
        var sunsetH = Math.floor(digestInfo.solarInfo.sunset/60);
        var sunsetM = digestInfo.solarInfo.sunset%60;
        if (sunriseM<10) sunriseM = "0" + sunriseM;
        if (sunsetM<10) sunsetM = "0" + sunsetM;
        return "<span class=\"ephemeris\"><i class=\"flx-pict-sun\">&nbsp;</i><span>" + sunriseH + ":" + sunriseM + " am"+
               "</span>&nbsp;<i class=\"flx-pict-moon\">&nbsp;</i><span>" + sunsetH + ":" + sunsetM + " pm</span></span>";
    }

    function temperaturesLabel(digestInfo) {
        if (digestInfo.maxTempC == -10000) {
            return "";
        }
        else if (digestInfo.settings.temperatureUnit != "CELSIUS") {
            return ephemerisLabel(digestInfo) + "<i class=\"flx-pict-temp\">&nbsp;</i>"
                       + "<span class=\"ephemeris\" style=\"font-weight:normal;\">&nbsp;"
                       + digestInfo.minTempF
                       + " / "
                       + digestInfo.maxTempF
                       + "&deg;F"
                + "</span>";
        }
        else {
            return ephemerisLabel(digestInfo) + "<i class=\"flx-pict-temp\">&nbsp;</i>"
                       + "<span class=\"ephemeris\" style=\"font-weight:normal;\">&nbsp;"
                       + digestInfo.minTempC
                       + " / "
                       + digestInfo.maxTempC
                       + "&deg;C"
                + "</span>";
        }
    }

    function cityLabel(cityInfo) {
        var s = "";
        s += cityInfo.name;
        if (cityInfo.state) s += ", " + cityInfo.state;
        s += ", " + cityInfo.country;
        //if (traveling)
        //    s += " <i>- on holiday</i>";
        //if (FlxState.cities.length>20)
        //    s += " <i>- in transit</i>";
        return s;
    }

    function toTimeUnit(urlTimeUnit) {
		if (urlTimeUnit==="date") return "DAY";
		return urlTimeUnit.toUpperCase();
	}

    Calendar.dateChanged = function(date, rangeType) {
        // date is expected to be midnight at the start of the range, in seconds since the epoch (UTC)
        // rangeType is expected to be either "day" or "week"
        console.log("Calendar.dateChanged(" + date + ", " + rangeType + ")");
    };

	return Calendar;
	
});