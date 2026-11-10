import React, { useEffect, useState } from 'react';
import { Video, Music, Download } from 'lucide-react';

interface MediaViewerProps {
  file: File | Blob;
  fileName: string;
  isVideo?: boolean;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ file, fileName, isVideo = true }) => {
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setMediaUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            {isVideo ? <Video className="w-6 h-6" /> : <Music className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
              {fileName}
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                {isVideo ? 'Video' : 'Audio'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isVideo ? 'Video Player' : 'Audio Player'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <select
            value={playbackRate}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setPlaybackRate(rate);
              const mediaEl = document.querySelector('video, audio') as HTMLMediaElement;
              if (mediaEl) mediaEl.playbackRate = rate;
            }}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="0.5">Speed: 0.5x</option>
            <option value="0.75">Speed: 0.75x</option>
            <option value="1">Speed: 1x (Normal)</option>
            <option value="1.25">Speed: 1.25x</option>
            <option value="1.5">Speed: 1.5x</option>
            <option value="2">Speed: 2x</option>
          </select>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-xs text-white shadow-md shadow-violet-600/30"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Main Player Display */}
      <div className="flex-1 overflow-auto p-4 sm:p-12 flex items-center justify-center bg-slate-950/60">
        {mediaUrl ? (
          isVideo ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-h-[70vh] max-w-full rounded-2xl shadow-2xl border border-slate-800 bg-black"
            />
          ) : (
            <div className="p-8 bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-md w-full">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-lg animate-pulse">
                <Music className="w-12 h-12" />
              </div>
              <p className="font-bold text-base text-white text-center truncate max-w-xs">{fileName}</p>
              <audio src={mediaUrl} controls autoPlay className="w-full" />
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};
