import { startCompanyDiscoveryWorker } from "../src/lib/queue/company-discovery-queue";
import { startScraperWorker } from "../src/lib/scrapers/queue/scraper-queue";

startCompanyDiscoveryWorker();
startScraperWorker();
