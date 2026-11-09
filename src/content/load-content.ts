import type { CharacterFileData } from "../handwriting/types";
import type { ContentFile } from "./types";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RawCharacterFileData = {
  strokes: string[];
  medians: Array<Array<[number, number]>>;
};

let contentPromise: Promise<ContentFile> | undefined;
const characterPromises = new Map<string, Promise<CharacterFileData>>();

function assetUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${baseUrl}${path.replace(/^\/+/, "")}`;
}

async function fetchJson<T>(url: string, fetcher: Fetcher): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`内容加载失败（${response.status}）`);
  }
  return (await response.json()) as T;
}

export function loadContent(fetcher: Fetcher = fetch): Promise<ContentFile> {
  if (contentPromise) return contentPromise;

  const promise = fetchJson<ContentFile>(assetUrl("content.json"), fetcher).catch(
    (error: unknown) => {
      if (contentPromise === promise) contentPromise = undefined;
      throw error;
    },
  );
  contentPromise = promise;
  return promise;
}

export function loadCharacter(
  char: string,
  fetcher: Fetcher = fetch,
): Promise<CharacterFileData> {
  const cached = characterPromises.get(char);
  if (cached) return cached;

  const promise = fetchJson<RawCharacterFileData>(
    assetUrl(`characters/${encodeURIComponent(char)}.json`),
    fetcher,
  )
    .then((data): CharacterFileData => ({
      strokes: data.strokes,
      medians: data.medians.map((median) =>
        median.map(([x, y]) => ({ x, y })),
      ),
    }))
    .catch((error: unknown) => {
      if (characterPromises.get(char) === promise) characterPromises.delete(char);
      throw error;
    });
  characterPromises.set(char, promise);
  return promise;
}

export function clearLoadCacheForTests(): void {
  contentPromise = undefined;
  characterPromises.clear();
}
