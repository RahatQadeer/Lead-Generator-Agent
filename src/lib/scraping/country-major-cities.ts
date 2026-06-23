import { countryToIsoCode } from "@/lib/search/jurisdiction-codes";
import { getGooglePlacesMaxQueries } from "@/lib/scraping/google-places-config";

/**
 * Major business hubs per country — used to fan out Google Places text queries
 * beyond a single country-wide search (which only returns a small ranked slice).
 */
const MAJOR_CITIES_BY_ISO: Record<string, readonly string[]> = {
  pk: ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Hyderabad"],
  in: ["Mumbai", "Bangalore", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow"],
  us: [
    "New York",
    "San Francisco",
    "Los Angeles",
    "Chicago",
    "Austin",
    "Boston",
    "Seattle",
    "Dallas",
  ],
  gb: ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds"],
  uk: ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds"],
  ae: ["Dubai", "Abu Dhabi", "Sharjah"],
  sa: ["Riyadh", "Jeddah", "Dammam"],
  de: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne"],
  fr: ["Paris", "Lyon", "Marseille", "Toulouse"],
  ca: ["Toronto", "Vancouver", "Montreal", "Calgary"],
  au: ["Sydney", "Melbourne", "Brisbane", "Perth"],
  sg: ["Singapore"],
  my: ["Kuala Lumpur", "Penang", "Johor Bahru"],
  ng: ["Lagos", "Abuja", "Port Harcourt"],
  za: ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
  ie: ["Dublin", "Cork", "Galway"],
  nl: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
  se: ["Stockholm", "Gothenburg", "Malmö"],
  no: ["Oslo", "Bergen", "Trondheim"],
  dk: ["Copenhagen", "Aarhus"],
  es: ["Madrid", "Barcelona", "Valencia"],
  it: ["Milan", "Rome", "Turin"],
  br: ["São Paulo", "Rio de Janeiro", "Belo Horizonte"],
  mx: ["Mexico City", "Guadalajara", "Monterrey"],
  tr: ["Istanbul", "Ankara", "Izmir"],
  eg: ["Cairo", "Alexandria", "Giza"],
  id: ["Jakarta", "Surabaya", "Bandung"],
  ph: ["Manila", "Cebu", "Davao"],
  bd: ["Dhaka", "Chittagong"],
  lk: ["Colombo"],
  ke: ["Nairobi", "Mombasa"],
};

export function getMajorCitiesForCountry(country: string, limit?: number): string[] {
  const iso = countryToIsoCode(country.trim())?.toLowerCase();
  if (!iso) return [];

  const cities = MAJOR_CITIES_BY_ISO[iso];
  if (!cities?.length) return [];

  const cityBudget = limit ?? Math.max(8, getGooglePlacesMaxQueries() - 4);
  return [...cities].slice(0, Math.max(1, cityBudget));
}
