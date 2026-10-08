import { CAN_PLAY_COUNT, ID_PREFIX } from '../config/constants';
import { FileType, Item } from '../models/item.model';

export interface MediaList {
  index: number;
  count: number;
  total: number;
  mediaCollection?: object[];
  mediaMetadata?: object[];
}

export function toMediaMetadata(item: Item): object {
  return {
    id: item.id,
    itemType: 'track',
    displayType: 'audio',
    title: item.displayTitle,
    mimeType: item.sonosMimeType,
    trackMetadata: {
      ...(item.artist ? { artist: item.artist } : {}),
      ...(item.album ? { album: item.album } : {}),
      ...(item.duration > 0 ? { duration: item.duration } : {}),
      ...(item.thumbnail ? { albumArtURI: item.thumbnail } : {}),
      trackNumber: item.track ?? 1,
    },
  };
}

export function toMediaCollection(item: Item): object {
  if (item.type === FileType.FOLDER) {
    return {
      id: `${ID_PREFIX.FOLDER}:${item.id}`,
      itemType: 'collection',
      title: item.name,
      canPlay: item.childCount < CAN_PLAY_COUNT,
      canEnumerate: true,
    };
  }
  return {
    id: `${ID_PREFIX.FILE}:${item.id}`,
    itemType: 'other',
    title: item.name,
    canPlay: false,
    canEnumerate: false,
  };
}

export function toMediaList(data: any, index: number): MediaList {
  const items: Item[] = (data?.value ?? []).map((raw: any) => new Item(raw)).filter((item: Item) => item.type);
  const mediaCollection = items.filter((item) => !item.isPlayable).map(toMediaCollection);
  const mediaMetadata = items.filter((item) => item.isPlayable).map(toMediaMetadata);
  const count = mediaCollection.length + mediaMetadata.length;

  let total = count;
  const odataCount = data?.['@odata.count'];
  if (typeof odataCount === 'number') {
    total = odataCount < 100 && odataCount > count ? odataCount - 1 : odataCount;
  }

  return {
    index,
    count,
    total,
    ...(mediaCollection.length ? { mediaCollection } : {}),
    ...(mediaMetadata.length ? { mediaMetadata } : {}),
  };
}
