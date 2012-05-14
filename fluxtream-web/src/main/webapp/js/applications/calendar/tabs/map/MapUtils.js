define(["applications/calendar/tabs/map/MapConfig"], function(Config) {

    function addGPSData(map,gpsData){
        map.gpsPositions = [];
        map.gpsTimestamps = [];
        var minLat = 90; //initialized to the largest valid latitude
        var maxLat = 0; //initialized to the smallest valid latitude
        var minLng = 180; //initialized to the largest valid longitude
        var maxLng = -180; //initialized to the smallest valid longitude
        for (var i = 0; i < gpsData.length; i++){
            var lat = gpsData[i].position[0];
            var lng = gpsData[i].position[1];
            map.gpsPositions[i] = new google.maps.LatLng(lat,lng);
            map.gpsTimestamps[i] = gpsData[i].start;
            if (lat < minLat)
                minLat = lat;
            if (lat > maxLat)
                maxLat = lat;
            if (lng < minLng)
                minLng = lng;
            if (lng > maxLng)
                maxLng = lng;
        }
        map.gpsLine = new google.maps.Polyline({map:map, path:map.gpsPositions});
        map.gpsBounds = new google.maps.LatLngBounds(new google.maps.LatLng(minLat,minLng), new google.maps.LatLng(maxLat,maxLng));
    }

    function addData(map,connectorData, connectorInfoId, clickable){
        switch (connectorInfoId){
            case "sms_backup-sms":
            case "sms_backup-call_Calendar":
            case "twitter-dm":
            case "twitter-tweet":
            case "twitter-mention":
            case "google_calendar":
            case "toodledo-task":
            case "fitbit-sleep":
            case "withings-bpm":
            case "picasa":
            case "flickr":
            case "lastfm-recent_track":
                break;
            default:
                return false;
        }
        map.markers[connectorInfoId] = addItemsToMap(map,connectorData,clickable);
        return map.markers[connectorInfoId] != null;
    }

    function addItemsToMap(map,items,clickable){
        var markerArray = new Array();
        for (var i = 0; i < items.length; i++){
            markerArray[markerArray.length] = addItemToMap(map,items[i],clickable);
        }
        if (markerArray.length == 0)
            markerArray = null;
        return markerArray;
    }

    //creates a marker with extended functionality
    function addItemToMap(map,item,clickable){
        var category;
        switch (item.type){
            case "sms_backup-sms":
            case "sms_backup-call_Calendar":
            case "twitter-dm":
            case "twitter-tweet":
            case "twitter-mention":
                category = Config.getConfig().SOCIAL_CATEGORY;
                break;
            case "google_calendar":
            case "toodledo-task":
                category = Config.getConfig().MIND_CATEGORY;
                break;
            case "fitbit-sleep":
            case "withings-bpm":
                category = Config.getConfig().BODY_CATEGORY;
                break;
            case "picasa":
            case "flickr":
            case "lastfm-recent_track":
                category = Config.getConfig().MEDIA_CATEGORY;
                break;
            default:
                return false;
        }
        var start = item.start;
        var end = item.end;
        if (start > map.gpsTimestamps[map.gpsTimestamps.length - 1] || (end == null && start < map.gpsTimestamps[0]))
            return;
        var marker = new google.maps.Marker({map:map, position:map.getLatLngOnGPSLine(start), icon:category.icon, shadow:category.shadow});
        marker._oldSetMap = marker.setMap;
        marker.targetMap = null;
        marker.setMap = function(newMap){
            if (marker.line != null && marker.line === map.currentHighlightedLine){
                if (newMap == null){
                   map.currentHighlightedLine.setMap(null);
                }
                else if(map == newMap){
                    map.currentHighlightedLine.setMap(map);
                }
            }
            else{
                marker.line = null;
            }
            marker.targetMap = newMap;
            if (!marker.hidden)
                marker._oldSetMap(newMap);
        }
        marker.hidden = false;
        marker.hideMarker = function(){
            if (!marker.hidden){
                marker.hidden = true;
                marker._oldSetMap(null);
            }
        }
        marker.showMarker = function(){
            if (marker.hidden){
                marker.hidden = false;
                marker._oldSetMap(marker.targetMap);
            }
        }
        marker.doHighlighting = function(){
            if (map.currentHighlightedLine != null){
                map.currentHighlightedLine.setMap(null);
                map.currentHighlightedLine = null
            }
            if (end != null){
                map.currentHighlightedLine = map.createPolyLineSegment(start, end, {strokeColor:"orange", zIndex: 100});
                marker.line = map.currentHighlightedLine;
                if (map.gpsLine.getMap() == null)
                    map.currentHighlightedLine.setMap(null);
            }
        }
        if (!clickable)
            return marker;
        google.maps.event.addListener(marker, "click", function(){
            map.connectorSelected = item.type;
            var tooltip = $("#" + item.type + "_" + item.id).html();
            if (tooltip == null)
                tooltip = "no description available";
            map.infoWindow.setContent(tooltip);
            map.infoWindow.open(map,marker);
            marker.doHighlighting();
        });
        return marker;
    }

    function highlightTimespan(map, start,end){
        if (map.highlightSection != null){
            map.highlightSection.setMap(null);
            map.highlightSection = null;
        }
        if (start <= map.gpsTimestamps[0] && end >= map.gpsTimestamps[map.gpsTimestamps.length - 1]){
            map.gpsLine.setOptions({strokeColor: "black"});
            return;
        }
        map.gpsLine.setOptions({strokeColor: "grey"});
        highlightSection = map.createPolyLineSegment({strokeColor:"black", zIndex: 99});
    }

    function getFirstIndexAfter(map, time){
        var endIndex;
        for (endIndex = 0; endIndex < map.gpsTimestamps.length && map.gpsTimestamps[endIndex] < time; endIndex++);
        return endIndex;
    }

    function getFirstIndexBefore(map, time){
        if (time <= map.gpsTimestamps[0])
            return -1;
        var endIndex;
        for (endIndex = 1; endIndex < map.gpsTimestamps.length && map.gpsTimestamps[endIndex] < time; endIndex++);
        return endIndex - 1;
    }

    function createPolyLineSegment(map, start, end, options){
        options.map = map;
        var newPoints = new Array();
        newPoints[0] = map.getLatLngOnGPSLine(start);
        var startIndex = map.getFirstIndexAfter(start);
        var endIndex = map.getFirstIndexBefore(end);
        for (var i = 0; i + startIndex <= endIndex; i++){
            newPoints[i+1] = map.gpsPositions[i+startIndex];
        }
        newPoints[newPoints.length] = map.getLatLngOnGPSLine(end);
        options.path = newPoints;
        return new google.maps.Polyline(options);
    }

    function getLatLngOnGPSLine(map,time){
        if (time <= map.gpsTimestamps[0])
            return map.gpsPositions[0];
        if (time >= map.gpsTimestamps[map.gpsTimestamps.length - 1])
            return map.gpsPositions[map.gpsPositions.length-1];
        var endIndex;
        for (endIndex = 1; endIndex < map.gpsTimestamps.length && map.gpsTimestamps[endIndex] < time; endIndex++);
        var startIndex = endIndex - 1;
        var percentThrough = (time - map.gpsTimestamps[startIndex]) / (map.gpsTimestamps[endIndex] - map.gpsTimestamps[startIndex]);
        var lat = (map.gpsPositions[endIndex].lat() - map.gpsPositions[startIndex].lat()) * percentThrough + map.gpsPositions[startIndex].lat();
        var lon = (map.gpsPositions[endIndex].lng() - map.gpsPositions[startIndex].lng()) * percentThrough + map.gpsPositions[startIndex].lng();
        return new google.maps.LatLng(lat,lon);
    }

    function zoomOnTimespan(map, start,end){
        var minLat, maxLat, minLng, maxLng;
        var startPoint = map.getLatLngOnGPSLine(start);
        var endPoint = map.getLatLngOnGPSLine(end);
        if (startPoint.lat() < endPoint.lat()){
            minLat = startPoint.lat();
            maxLat = endPoint.lat();
        }
        else{
            minLat = endPoint.lat();
            maxLat = startPoint.lat();
        }
        if (startPoint.lng() < endPoint.lng()){
            minLng = startPoint.lng();
            maxLng = endPoint.lng();
        }
        else{
            minLng = endPoint.lng();
            maxLng = endPoint.lng();
        }

        var startIndex = map.getFirstIndexAfter(start);
        var endIndex = map.getFirstIndexBefore(end);

        for (var i = startIndex; i < endIndex; i++){
            if (map.gpsPositions[i].lat() < minLat)
                minLat = map.gpsPositions[i].lat();
            else if (map.gpsPositions[i].lat() > maxLat)
                maxLat = map.gpsPositions[i].lat();
            if (map.gpsPositions[i].lng() < minLng)
                minLng = map.gpsPositions[i].lng();
            else if (map.gpsPositions[i].lng() > maxLng)
                maxLng = map.gpsPositions[i].lng();
        }
        map.fitBounds(new google.maps.LatLngBounds(new google.maps.LatLng(minLat,minLng), new google.maps.LatLng(maxLat,maxLng)));
    }

    function zoomOnPoint(map, point){
        map.setCenter(point);
        map.setZoom(18);
    }

    function hideData(map,connectorId){
        if (map.markers[connectorId] == null)
            return;
        if (map.connectorSelected == connectorId){
            map.infoWindow.close();
            map.connectorSelected = null;
        }
        for (var i = 0; i < map.markers[connectorId].length; i++){
            map.markers[connectorId][i].setMap(null);
        }
    }

    function showData(map,connectorId){
        if (map.markers[connectorId] == null)
            return;
        for (var i = 0; i < map.markers[connectorId].length; i++){
            map.markers[connectorId][i].setMap(map);
        }
    }

    function hideGPSData(map){
        map.gpsLine.setMap(null);
        if (map.currentHighlightedLine != null)
            map.currentHighlightedLine.setMap(null);
        if (map.highlightSection != null)
            map.highlightSection.setMap(null);
    }

    function showGPSData(map){
        map.gpsLine.setMap(map);
        if (map.currentHighlightedLine != null)
            map.currentHighlightedLine.setMap(map);
        if (map.highlightSection != null)
            map.highlightSection.setMap(map);
    }

    //Image display overlay definition
    function ImageDisplayOverlay(map,latlng,imgUrl){
        this._map = map;
        this._latlng = latlng;
        this._imgUrl = imgUrl;
        this._img = null;

        this.setMap(map);
    }
    ImageDisplayOverlay.prototype = new google.maps.OverlayView();
    ImageDisplayOverlay.prototype.onAdd = function() {
        this._img = document.createElement("div");
        this._img.style.position = "absolute";
        this._img.style.width = "64px";
        this._img.style.height = "64px";
        img = document.createElement("img");
        img.style.position = "relative";
        img.className = "mapImageOverlay";
        img.src = this._imgUrl;
        this._img.appendChild(img);
        this.getPanes().overlayLayer.appendChild(this._img);
    }
    ImageDisplayOverlay.prototype.onRemove = function() {
        this._img.parentNode.removeChild(this._img);
        this._img = null;
    }
    ImageDisplayOverlay.prototype.draw = function() {
        var overlayProjection = this.getProjection();
        var position = this.getProjection().fromLatLngToDivPixel(this._latlng);
        this._img.style.left = position.x - 32 + "px";
        this._img.style.top = position.y - 32 + "px";
    }

    return {
        newMap: function(center,zoom,divId,hideControls){ //creates and returns a google map with extended functionality
            var options = {
                zoom : zoom,
                center: center,
                scrollwheel : true,
                streetViewControl : false,
                mapTypeId : google.maps.MapTypeId.ROADMAP
            };
            if (hideControls){
                options.disableDefaultUI = true;
            }
            var map = new google.maps.Map(document.getElementById(divId),options);
            map.infoWindow = new google.maps.InfoWindow();
            map.currentHighlightedLine = null;
            map.highlightSection = null;
            map.connectorSelected = null;
            map.markers = {};
            map.addGPSData = function(gpsData){addGPSData(map,gpsData)};
            map.addData = function(connectorData, connectorInfoId,clickable){return addData(map,connectorData, connectorInfoId,clickable)};
            map.getLatLngOnGPSLine = function(time){return getLatLngOnGPSLine(map,time)};
            map.createPolyLineSegment = function(start,end,options){return createPolyLineSegment(map,start,end,options)};
            map.getFirstIndexAfter = function(time){return getFirstIndexAfter(map,time)};
            map.getFirstIndexBefore = function(time){return getFirstIndexBefore(map,time)};
            map.zoomOnTimespan = function(start,end){zoomOnTimespan(map,start,end)};
            map.highlightTimespan = function(start,end){highlightTimespan(map,start,end)};
            map.showData = function(connectorId){showData(map,connectorId)};
            map.hideData = function(connectorId){hideData(map,connectorId)};
            map.showGPSData = function(){showGPSData(map)};
            map.hideGPSData = function(){hideGPSData(map)};
            map.addItem = function(item,clickable){return addItemToMap(map,item,clickable)}
            map.zoomOnPoint = function(point){zoomOnPoint(map,point)};
            return map;
        }
    }
});