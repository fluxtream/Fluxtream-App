package com.fluxtream.connectors.google_latitude;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.fluxtream.connectors.Connector.UpdateStrategyType;
import com.fluxtream.connectors.annotations.JsonFacetCollection;
import com.fluxtream.connectors.annotations.Updater;
import com.fluxtream.connectors.updaters.AbstractGoogleOAuthUpdater;
import com.fluxtream.connectors.updaters.UpdateInfo;
import com.fluxtream.domain.ApiUpdate;
import com.fluxtream.services.ApiDataService;
import com.fluxtream.services.GuestService;
import com.fluxtream.services.MetadataService;
import com.google.api.client.googleapis.json.JsonCParser;
import com.google.api.client.http.HttpRequest;
import com.google.api.client.http.HttpResponse;
import com.google.api.client.http.HttpTransport;

@Component
@Updater(prettyName = "Google Latitude", value = 2, objectTypes = { LocationFacet.class }, updateStrategyType = UpdateStrategyType.INCREMENTAL)
@JsonFacetCollection(LocationFacetVOCollection.class)
public class GoogleLatitudeUpdater extends AbstractGoogleOAuthUpdater {

	@Autowired
	GuestService guestService;

	@Autowired
	ApiDataService apiDataService;

	public GoogleLatitudeUpdater() {
		super();
	}

	@Override
	public void updateConnectorDataHistory(UpdateInfo updateInfo)
			throws Exception {
		loadHistory(updateInfo, 0, System.currentTimeMillis());
	}

	public void updateConnectorData(UpdateInfo updateInfo) throws Exception {
		ApiUpdate lastSuccessfulUpdate = connectorUpdateService
				.getLastSuccessfulUpdate(updateInfo.apiKey.getGuestId(),
						connector());
		loadHistory(updateInfo, lastSuccessfulUpdate.ts,
				System.currentTimeMillis());
	}

	private void loadHistory(UpdateInfo updateInfo, long from, long to)
			throws Exception {
		HttpTransport transport = this.getTransport(updateInfo.apiKey);
		String key = env.get("google_latitudeApiKey");
		List<LocationFacet> locationList = executeList(updateInfo, transport,
				key, 1000, from, to);
		if (locationList != null && locationList.size() > 0) {
			List<LocationFacet> storedLocations = new ArrayList<LocationFacet>();
			for (LocationFacet locationResource : locationList) {
				if (locationResource.timestampMs==0)
					continue;
				locationResource.start = locationResource.timestampMs;
				locationResource.end = locationResource.timestampMs;

                apiDataService.addGuestLocation(updateInfo.getGuestId(),
						locationResource.timestampMs,
						locationResource.latitude, locationResource.longitude,
                        LocationFacet.Source.GOOGLE_LATITUDE);
				
				storedLocations.add(locationResource);
			}
			Collections.sort(storedLocations);
			LocationFacet oldest = storedLocations.get(0);
            loadHistory(updateInfo, from, oldest.timestampMs);
		}
	}

	private List<LocationFacet> executeList(UpdateInfo updateInfo,
			HttpTransport transport, String key, int maxResults, long minTime,
			long maxTime) throws Exception {
		long then = System.currentTimeMillis();
		String requestUrl = "request url not set yet";
		try {
			transport.addParser(new JsonCParser());
			HttpRequest request = transport.buildGetRequest();
			LatitudeUrl latitudeUrl = LatitudeUrl.forLocation();
			latitudeUrl.maxResults = String.valueOf(maxResults);
			latitudeUrl.granularity = "best";
			latitudeUrl.minTime = String.valueOf(minTime);
			latitudeUrl.maxTime = String.valueOf(maxTime);
			latitudeUrl.put("location", "all");
			request.url = latitudeUrl;
			requestUrl = latitudeUrl.build();
			HttpResponse response = request.execute();
			List<LocationFacet> result = response.parseAs(LocationList.class).items;
			countSuccessfulApiCall(updateInfo.apiKey.getGuestId(),
					updateInfo.objectTypes, then, requestUrl);
			return result;
		} catch (Exception e) {
			countFailedApiCall(updateInfo.apiKey.getGuestId(),
					updateInfo.objectTypes, then, requestUrl);
			throw e;
		}
	}

}
