export const PROVINCES = [
  'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan',
  'Azad Jammu & Kashmir', 'Islamabad Capital Territory',
];

// City -> province (used for the dropdown and to auto-select the province)
export const CITY_PROVINCE = {
  Lahore: 'Punjab', Karachi: 'Sindh', Islamabad: 'Islamabad Capital Territory', Rawalpindi: 'Punjab',
  Faisalabad: 'Punjab', Multan: 'Punjab', Kasur: 'Punjab', Gujranwala: 'Punjab', Sialkot: 'Punjab',
  Sargodha: 'Punjab', Bahawalpur: 'Punjab', Sahiwal: 'Punjab', Okara: 'Punjab', Sheikhupura: 'Punjab',
  Gujrat: 'Punjab', Jhang: 'Punjab', 'Rahim Yar Khan': 'Punjab', Hyderabad: 'Sindh', Sukkur: 'Sindh',
  Larkana: 'Sindh', Peshawar: 'Khyber Pakhtunkhwa', Mardan: 'Khyber Pakhtunkhwa',
  Abbottabad: 'Khyber Pakhtunkhwa', Mingora: 'Khyber Pakhtunkhwa', Quetta: 'Balochistan',
  Gwadar: 'Balochistan', Gilgit: 'Gilgit-Baltistan', Skardu: 'Gilgit-Baltistan',
  Muzaffarabad: 'Azad Jammu & Kashmir', Mirpur: 'Azad Jammu & Kashmir',
};
export const CITIES = Object.keys(CITY_PROVINCE);

export const ORDER_STATUSES = ['Pending', 'Verified', 'Dispatched', 'Delivered', 'Returned', 'Cancelled'];

// Plain-text blurbs shown on the site
export const SUPPORT_NOTE = 'WhatsApp is for support only. Orders are placed on the website.';
