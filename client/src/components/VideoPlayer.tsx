import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/constants';

interface VideoPlayerProps {
  uploadId: string;
  title?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ uploadId, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Function to initialize HLS
    const initializeHls = () => {
      if (!videoRef.current) return;
      
      setLoading(true);
      setError(null);
      
      const videoElement = videoRef.current;
      const playlistUrl = `${API_BASE_URL}/stream/playlist/${uploadId}`;
      
      // Check if HLS is supported in the browser
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });
        
        hls.loadSource(playlistUrl);
        hls.attachMedia(videoElement);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          videoElement.play().catch(err => {
            console.error('Failed to autoplay:', err);
          });
        });
        
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error('HLS error:', data);
            setError('Failed to load video. Please try again later.');
            setLoading(false);
            
            // Try to recover
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                // Fatal error, cannot recover
                break;
            }
          }
        });
        
        // Cleanup function
        return () => {
          hls.destroy();
        };
      } 
      // For browsers that have native HLS support (Safari)
      else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = playlistUrl;
        videoElement.addEventListener('loadedmetadata', () => {
          setLoading(false);
          videoElement.play().catch(err => {
            console.error('Failed to autoplay:', err);
          });
        });
        
        videoElement.addEventListener('error', () => {
          setError('Failed to load video. Please try again later.');
          setLoading(false);
        });
      } else {
        setError('Your browser does not support HLS video playback.');
        setLoading(false);
      }
    };
    
    initializeHls();
  }, [uploadId]);

  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <div className="text-white text-center p-4">
              <p className="text-lg font-medium mb-2">Video unavailable</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        
        <video
          ref={videoRef}
          className="w-full h-auto"
          controls
          playsInline
          preload="auto"
        />
        
        {title && (
          <div className="p-4 bg-gray-100">
            <h3 className="text-lg font-medium">{title}</h3>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
