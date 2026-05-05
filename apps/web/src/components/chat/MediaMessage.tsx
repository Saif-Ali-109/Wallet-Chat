import React, { useEffect, useState } from 'react';
import { FileAttachment, getMediaDownloadUrl } from '../../lib/media';
import { File, Download, Loader2, PlayCircle } from 'lucide-react';

interface MediaMessageProps {
  attachment: FileAttachment;
}

export default function MediaMessage({ attachment }: MediaMessageProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUrl = async () => {
    if (downloadUrl) return;
    try {
      setLoading(true);
      setError(null);
      const url = await getMediaDownloadUrl(attachment.objectKey);
      setDownloadUrl(url);
    } catch (err: any) {
      setError(err.message || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If it's an image, video, or audio, we might want to pre-fetch the URL
    // so it renders immediately.
    if (attachment.fileType.startsWith('image/') || 
        attachment.fileType.startsWith('video/') || 
        attachment.fileType.startsWith('audio/')) {
      fetchUrl();
    }
  }, [attachment]);

  const isImage = attachment.fileType.startsWith('image/');
  const isVideo = attachment.fileType.startsWith('video/');
  const isAudio = attachment.fileType.startsWith('audio/');

  if (loading && !downloadUrl) {
    return (
      <div className="flex items-center gap-2 p-2 rounded bg-black/10">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading media...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 text-red-400 border border-red-500/20">
        <File className="w-5 h-5" />
        <span className="text-sm">{error}</span>
        <button onClick={fetchUrl} className="text-xs underline ml-2">Retry</button>
      </div>
    );
  }

  if (isImage && downloadUrl) {
    return (
      <div className="rounded-lg overflow-hidden border border-white/10 max-w-[250px] sm:max-w-[350px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={downloadUrl} alt={attachment.fileName} className="w-full h-auto object-cover" />
      </div>
    );
  }

  if (isVideo && downloadUrl) {
    return (
      <div className="rounded-lg overflow-hidden border border-white/10 max-w-[250px] sm:max-w-[350px]">
        <video src={downloadUrl} controls className="w-full h-auto" />
      </div>
    );
  }

  if (isAudio && downloadUrl) {
    return (
      <div className="rounded-lg overflow-hidden min-w-[200px] p-2 bg-black/5">
        <audio src={downloadUrl} controls className="w-full h-10" />
      </div>
    );
  }

  // Generic file download
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-black/10 border border-white/10 min-w-[200px]">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-2 bg-accent/20 text-accent rounded-lg">
          <File className="w-5 h-5" />
        </div>
        <div className="flex flex-col truncate">
          <span className="text-sm font-medium truncate">{attachment.fileName}</span>
          {attachment.size && (
            <span className="text-xs opacity-70">{(attachment.size / 1024).toFixed(1)} KB</span>
          )}
        </div>
      </div>
      {downloadUrl ? (
        <a href={downloadUrl} download={attachment.fileName} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-black/10 rounded-full transition-colors">
          <Download className="w-5 h-5" />
        </a>
      ) : (
        <button onClick={fetchUrl} disabled={loading} className="p-2 hover:bg-black/10 rounded-full transition-colors">
          <Download className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
