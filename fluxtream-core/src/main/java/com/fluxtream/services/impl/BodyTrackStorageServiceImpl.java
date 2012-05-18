package com.fluxtream.services.impl;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Hashtable;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

import com.fluxtream.services.impl.converters.Converter;
import org.apache.commons.lang.StringUtils;
import org.apache.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fluxtream.Configuration;
import com.fluxtream.TimeInterval;
import com.fluxtream.TimeUnit;
import com.fluxtream.connectors.Connector;
import com.fluxtream.connectors.ObjectType;
import com.fluxtream.domain.AbstractFacet;
import com.fluxtream.domain.ApiKey;
import com.fluxtream.services.ApiDataService;
import com.fluxtream.services.BodyTrackStorageService;
import com.fluxtream.services.GuestService;
import com.fluxtream.services.MetadataService;
import com.fluxtream.utils.HttpUtils;

@Service
public class BodyTrackStorageServiceImpl implements BodyTrackStorageService {

	static Logger LOG = Logger.getLogger(BodyTrackStorageServiceImpl.class);

	@Autowired
	Configuration env;

	@Autowired
	GuestService guestService;

	@Autowired
	ApiDataService apiDataService;

	@Autowired
	MetadataService metadataService;

    private Hashtable<String, Converter> converters = new Hashtable<String, Converter>();

	@Override
	public void storeApiData(long guestId, List<AbstractFacet> facets) {

		Connector bodytrackConnector = Connector.getConnector("bodytrack");
		ApiKey bodytrackApiKey = guestService.getApiKey(guestId,
				bodytrackConnector);
		if (bodytrackApiKey == null)
			return;

		String user_id = guestService.getApiKeyAttribute(guestId,
				bodytrackConnector, "user_id");
		String host = guestService.getApiKeyAttribute(guestId,
				bodytrackConnector, "host");

		Map<String, List<AbstractFacet>> facetsByDeviceNickname = sortFacetsByDeviceNickname(facets);
		Iterator<String> eachDeviceName = facetsByDeviceNickname.keySet().iterator();
		while (eachDeviceName.hasNext()) {
			String deviceName = (String) eachDeviceName.next();
			storeDeviceData(guestId, user_id, host, facetsByDeviceNickname,
					deviceName);
		}

	}

	private void storeDeviceData(long guestId, String user_id, String host,
			Map<String, List<AbstractFacet>> facetsByDeviceNickname,
			String deviceName) {
		Map<String, String> params = new HashMap<String, String>();
		params.put("dev_nickname", deviceName);
		Map<String, String> channelNamesMapping = getChannelNamesMapping(deviceName);
		params.put("channel_names", makeJSONArray(channelNamesMapping.values(), true));
		List<AbstractFacet> deviceFacets = facetsByDeviceNickname.get(deviceName);
		List<String> channelValues = extractChannelValuesFromFacets(
				channelNamesMapping, deviceFacets);
		String jsonArray = makeJSONArray(channelValues, false);
		System.out.println("jsonArray: " + jsonArray);
		params.put("data", jsonArray);

		try {
			String result = HttpUtils.fetch("http://" + host + "/users/"
					+ user_id + "/upload", params, env);
			if (result.toLowerCase().startsWith("awesome")) {
				LOG.info("Data successfully uploaded to BodyTrack: guestId: "
						+ guestId);
			} else {
                LOG.warn("Could not upload data to BodyTrack data store: "
						+ result);
			}
		} catch (Exception e) {
            LOG.warn("Could not upload data to BodyTrack data store: "
					+ e.getMessage());
		}
	}

	private List<String> extractChannelValuesFromFacets(
			Map<String, String> channelNamesMapping,
			List<AbstractFacet> deviceFacets) {
		List<String> channelValues = new ArrayList<String>();
		for (AbstractFacet deviceFacet : deviceFacets) {
			Iterator<String> eachFieldName = channelNamesMapping.keySet().iterator();
			StringBuilder sb = new StringBuilder();
			sb.append("[");
			sb.append(deviceFacet.start/1000);
			while (eachFieldName.hasNext()) {
				String fieldName = (String) eachFieldName.next();
                try {
                    Field field;
                    if (channelNamesMapping.get(fieldName).startsWith("#")) {
                        String converterName = channelNamesMapping.get(fieldName).substring(1);
                        if (!converterName.equalsIgnoreCase("NOOP")) {
                            Converter converter = getConverter(converterName);
                            sb.append(",");
                            field = deviceFacet.getClass().getField(fieldName);
                            Object channelValue = field.get(deviceFacet);
                            sb.append(converter.convert(deviceFacet));
                            continue;
                        }
                    }
                    sb.append(",");
					field = deviceFacet.getClass().getField(fieldName);
					Object channelValue = field.get(deviceFacet);
					if (channelValue instanceof java.util.Date)
						sb.append(((java.util.Date)channelValue).getTime());
					else
						sb.append(channelValue.toString());
				} catch (Exception e) {
					throw new RuntimeException("No such Field: " + fieldName);
				}
			}
			sb.append("]");
			channelValues.add(sb.toString());
		}
		return channelValues;
	}

    private Converter getConverter(final String converterName) {
        if (converters.get(converterName)==null) {
            try {
                Class converterClass = Class.forName("com.fluxtream.services.impl.converters." + converterName);
                converters.put(converterName, (Converter)converterClass.newInstance());
            }
            catch (ClassNotFoundException e) {
                LOG.error("Can't find converter class " + converterName, e);
            }
            catch (Exception e) {
                LOG.error("EXCEPTION_DESCRIPTION_HERE", e);
            }
        }
        return converters.get(converterName);
    }

    private String makeJSONArray(Collection<String> values, boolean addQuotes) {
		StringBuilder sb = new StringBuilder("[");
		Iterator<String> eachChannelName = values.iterator();
		for (int i=0; eachChannelName.hasNext(); i++) {
			String channelName = (String) eachChannelName.next();
			if (i>0) sb.append(",");
			if (addQuotes)
				sb.append("\"").append(channelName).append("\"");
			else
				sb.append(channelName);
		}
		sb.append("]");
		return sb.toString();
	}

	private Map<String,String> getChannelNamesMapping(String deviceName) {
		String[] channelNamesMappings = env.bodytrackProperties.getStringArray(deviceName);
		Map<String,String> mappings = new HashMap<String,String>();
		for (String mapping : channelNamesMappings) {
			String[] terms = StringUtils.split(mapping, ":");
            if (terms[1].startsWith("#")) {
                String converterName = terms[1].substring(1);
                String bodytrackChannelName = getConverter(converterName).getBodytrackChannelName();
                mappings.put(terms[0], bodytrackChannelName);
            } else
    			mappings.put(terms[0], terms[1]);
		}
		return mappings;
	}

	private Map<String, List<AbstractFacet>> sortFacetsByDeviceNickname(List<AbstractFacet> facets) {
		Map<String, List<AbstractFacet>> facetsByDeviceNickname = new HashMap<String, List<AbstractFacet>>();
		for (AbstractFacet facet : facets) {
			Connector connector = Connector.fromValue(facet.api);
			String connectorAndObjectType = connector.getName();
			if (connector.objectTypes()!=null&&connector.objectTypes().length>0) {
				connectorAndObjectType += "." + ObjectType.getObjectType(connector,
					facet.objectType).getName();
			}
			String deviceNickname = getDeviceNickname(connectorAndObjectType);
			if (deviceNickname==null) {
//				logger.info("No Device Nickname for " + connectorAndObjectType);
				continue;
			}
			if (facetsByDeviceNickname.get(deviceNickname)==null)
				facetsByDeviceNickname.put(deviceNickname, new ArrayList<AbstractFacet>());
			facetsByDeviceNickname.get(deviceNickname).add(facet);
		}
		return facetsByDeviceNickname;
	}

	private String getDeviceNickname(String connectorAndObjectType) {
		Iterator<String> keys = env.bodytrackProperties.getKeys();
		while (keys.hasNext()) {
			String key = (String) keys.next();
			if (key.startsWith(connectorAndObjectType)) {
				if (key.endsWith("dev_nickname"))
					return (String) env.bodytrackProperties.getProperty(key);
			}
		}
		return null;
	}

	@Override
	public void storeInitialHistory(long guestId, String connectorName) {
		TimeInterval timeInterval = new TimeInterval(0,
				System.currentTimeMillis(), TimeUnit.DAY, TimeZone.getDefault());
		List<AbstractFacet> facets = apiDataService.getApiDataFacets(guestId,
				Connector.getConnector(connectorName), null, timeInterval);
		storeApiData(guestId, facets);
	}

}
