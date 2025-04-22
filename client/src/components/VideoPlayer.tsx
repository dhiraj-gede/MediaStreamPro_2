
import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Player from 'video.js/dist/types/player';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  autoplay = false,
  controls = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = videoRef.current;
    const options = {
      autoplay,
      controls,
      responsive: true,
      fluid: true,
      sources: [{
        src,
        type: src.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
      }],
      poster,
      html5: {
        vhs: {
          overrideNative: true
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false
      }
    };

    // Initialize video.js player
    playerRef.current = videojs(videoElement, options);

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster, autoplay, controls]);

  return (
    <div data-vjs-player>
      <video 
        ref={videoRef}
        className="video-js vjs-big-play-centered vjs-fluid"
      />
    </div>
  );
};
