export interface MockPersonProfile {
  city: string;
  state: string | null;
  country: string;
  linkedinUrl: string | null;
}

export const MOCK_PERSON_PROFILES: Record<string, MockPersonProfile> = {
  "alice.morgan@abchealth.com": {
    city: "Boston",
    state: "MA",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/alice-morgan",
  },
  "brian.cho@abchealth.com": {
    city: "Boston",
    state: "MA",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/brian-cho",
  },
  "sarah.chen@medtechpro.com": {
    city: "San Francisco",
    state: "CA",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/sarah-chen",
  },
  "james.park@medtechpro.com": {
    city: "Oakland",
    state: "CA",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/james-park",
  },
  "mike.torres@medtechpro.com": {
    city: "San Jose",
    state: "CA",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/mike-torres",
  },
  "lisa.wong@caresync.io": {
    city: "Austin",
    state: "TX",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/lisa-wong",
  },
  "emma.reed@caresync.io": {
    city: "Dallas",
    state: "TX",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/emma-reed",
  },
  "david.kim@healthbridge.com": {
    city: "Chicago",
    state: "IL",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/david-kim",
  },
  "rachel.foster@healthbridge.com": {
    city: "Evanston",
    state: "IL",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/rachel-foster",
  },
  "tom.walsh@novacare.com": {
    city: "Seattle",
    state: "WA",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/tom-walsh",
  },
  "nina.patel@novacare.com": {
    city: "Bellevue",
    state: "WA",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/nina-patel",
  },
  "john.smith@competitor.com": {
    city: "Denver",
    state: "CO",
    country: "United States",
    linkedinUrl: "https://linkedin.com/in/john-smith",
  },
  "oliver.grant@finedge.com": {
    city: "London",
    state: null,
    country: "United Kingdom",
    linkedinUrl: "https://linkedin.com/in/oliver-grant",
  },
  "sophie.bell@finedge.com": {
    city: "Manchester",
    state: null,
    country: "United Kingdom",
    linkedinUrl: "https://linkedin.com/in/sophie-bell",
  },
  "alex.rivera@techflow.io": {
    city: "Toronto",
    state: "ON",
    country: "Canada",
    linkedinUrl: "https://linkedin.com/in/alex-rivera",
  },
  "jordan.lee@techflow.io": {
    city: "Vancouver",
    state: "BC",
    country: "Canada",
    linkedinUrl: "https://linkedin.com/in/jordan-lee",
  },
};
