import { discoverDirectoryPaths } from "@/lib/scraping/directory-paths";

/** @deprecated Use discoverDirectoryPaths */
export async function discoverCandidatePaths(domain: string): Promise<string[]> {
  return discoverDirectoryPaths(domain);
}

export { DIRECTORY_CONTACT_PATHS, discoverDirectoryPaths } from "@/lib/scraping/directory-paths";
