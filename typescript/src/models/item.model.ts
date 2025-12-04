export enum FileType {
  FILE = 'file',
  AUDIO = 'audio',
  FOLDER = 'folder'
}

export class Item {
  type: FileType;
  id: string;
  name: string;
  mimeType: string;
  duration: number;
  album: string;
  artist: string;
  title: string;
  parentId: string;
  fileUri: string;
  thumbnail: string;
  track: number;
  childCount: number;

  constructor(data: any) {
    this.id = data.id || null;
    this.name = data.name || null;

    if (data.parentReference) {
      this.parentId = data.parentReference.id || null;
    }

    if (data.file) {
      if (data.audio) {
        this.type = FileType.AUDIO;
        this.album = data.audio.album || null;
        this.artist = data.audio.artist || null;
        this.title = data.audio.title || null;
        this.duration = data.audio.duration ? Math.floor(data.audio.duration / 1000) : 0;
        this.track = data.audio.track || 1;
      } else {
        this.type = FileType.FILE;
      }
      this.mimeType = data.file.mimeType || null;
      this.fileUri = data['@microsoft.graph.downloadUrl'] || null;
    } else if (data.folder) {
      this.type = FileType.FOLDER;
      this.childCount = data.folder.childCount || 0;
    }

    if (data.thumbnails && data.thumbnails.length > 0) {
      this.thumbnail = data.thumbnails[0].small?.url || null;
    }
  }

  getType(): FileType {
    return this.type;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getMimeType(): string {
    return this.mimeType;
  }

  getDuration(): number {
    return this.duration;
  }

  getAlbum(): string {
    return this.album;
  }

  getArtist(): string {
    return this.artist;
  }

  getTitle(): string {
    return this.title;
  }

  getParentId(): string {
    return this.parentId;
  }

  getFileUri(): string {
    return this.fileUri;
  }

  getThumbnail(): string {
    return this.thumbnail;
  }

  getTrack(): number {
    return this.track;
  }

  getChildCount(): number {
    return this.childCount;
  }
}
