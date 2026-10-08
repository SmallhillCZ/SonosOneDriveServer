export enum FileType {
  FILE = 'file',
  AUDIO = 'audio',
  FOLDER = 'folder',
}

export class Item {
  readonly type?: FileType;
  readonly id: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly duration?: number;
  readonly album?: string;
  readonly artist?: string;
  readonly title?: string;
  readonly fileUri?: string;
  readonly thumbnail?: string;
  readonly track?: number;
  readonly childCount?: number;

  constructor(data: any) {
    this.id = data.id;
    this.name = data.name ?? '';

    if (data.file) {
      if (data.audio) {
        this.type = FileType.AUDIO;
        this.album = data.audio.album;
        this.artist = data.audio.artist;
        this.title = data.audio.title;
        this.duration = data.audio.duration ? Math.floor(data.audio.duration / 1000) : 0;
        this.track = data.audio.track || 1;
      } else {
        this.type = FileType.FILE;
      }
      this.mimeType = data.file.mimeType;
      this.fileUri = data['@microsoft.graph.downloadUrl'];
    } else if (data.folder) {
      this.type = FileType.FOLDER;
      this.childCount = data.folder.childCount ?? 0;
    }

    const thumbnail = data.thumbnails?.[0];
    this.thumbnail = thumbnail?.large?.url ?? thumbnail?.medium?.url ?? thumbnail?.small?.url;
  }

  get isPlayable(): boolean {
    return (
      this.type === FileType.AUDIO ||
      (this.type === FileType.FILE && (this.name.toLowerCase().endsWith('.flac') || !!this.mimeType?.includes('audio')))
    );
  }

  get sonosMimeType(): string {
    if (this.type === FileType.FILE && this.name.toLowerCase().endsWith('.flac')) {
      return 'audio/flac';
    }
    if (this.mimeType?.endsWith('wma')) {
      return 'audio/wma';
    }
    return this.mimeType ?? 'application/octet-stream';
  }

  get displayTitle(): string {
    return this.title || this.name;
  }
}
