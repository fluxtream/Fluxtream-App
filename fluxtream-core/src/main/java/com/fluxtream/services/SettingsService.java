package com.fluxtream.services;

import com.fluxtream.domain.GuestAddress;
import com.fluxtream.domain.GuestSettings;
import com.fluxtream.domain.GuestSettings.DistanceMeasureUnit;
import com.fluxtream.domain.GuestSettings.LengthMeasureUnit;
import com.fluxtream.domain.GuestSettings.TemperatureUnit;
import com.fluxtream.domain.GuestSettings.WeightMeasureUnit;
import java.util.List;

public interface SettingsService {

	public GuestSettings getSettings(long guestId);

	public void setFirstname(long guestId, String firstname);

	public void setLastname(long guestId, String lastname);

	public void setWeightMeasureUnit(long guestId, WeightMeasureUnit unit);

	public void setLengthMeasureUnit(long guestId, LengthMeasureUnit unit);

	public void setDistanceMeasureUnit(long guestId, DistanceMeasureUnit unit);

	public void addAddress(long guestId, String type, String address, double latitude,
			double longitude, long since, long until, String jsonString);

    public void addAddress(long guestId, String type, String address, double latitude,
                           double longitude, long since, String jsonString);
	
	public List<GuestAddress> getAllAddressesForDate(long guestId, long date);

    public List<GuestAddress> getAllAddresses(long guestId);

    public List<GuestAddress> getAllAddressesOfType(long guestId, String type);

    public List<GuestAddress> getAllAddressesOfTypeForDate(long guestId, String type, long date);

    public GuestAddress getAddressById(long guestId, long id);

    public void deleteAddressById(long guestId, long id);

    public void deleteAllAddresses(long guestId);

    public void deleteAllAddressesAtDate(long guestId, long date);

    public void deleteAllAddressesOfType(long guestId, String type);

    public void deleteAllAddressesOfTypeForDate(long guestId, String type, long date);

    public void updateAddress(long guestId, long addressId, String type, String address, Double latitude,
                              Double longitude, Long since, Long until, String jsonString);

	public void setTemperatureUnit(long guestId, TemperatureUnit temperatureUnit);
	
}
