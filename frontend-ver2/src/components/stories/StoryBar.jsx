import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import Icon from '../Icons';
import StoryViewerModal from './StoryViewerModal';
import StoryUploadModal from './StoryUploadModal';
import { useAgentAction } from '../../hooks/useAgentAction';

export default function StoryBar({
  campgroundId = null,
  campgroundTitle = '',
  className = '',
  onStoryUpdated,
}) {
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewerState, setViewerState] = useState({ isOpen: false, initialGroupIndex: 0 });
  const [viewedPhotoIds, setViewedPhotoIds] = useState([]);

  // Load viewed photo IDs from localStorage
  useEffect(() => {
    try {
      const viewed = JSON.parse(localStorage.getItem('yelpcamp_viewed_stories') || '[]');
      setViewedPhotoIds(viewed);
    } catch (e) {
      setViewedPhotoIds([]);
    }
  }, []);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      if (campgroundId) {
        // Fetch stories for specific campground
        const res = await api.get(`/api/campgrounds/${campgroundId}/stories`);
        const photos = Array.isArray(res.data) ? res.data : (res.data.photos || []);

        // Group photos by user_id
        const userMap = {};
        for (const p of photos) {
          const uid = p.user_id || 0;
          if (!userMap[uid]) {
            userMap[uid] = {
              user_id: uid,
              username: p.username || p.user_username || 'camper',
              avatar_url: p.avatar_url || p.user_avatar,
              photos: [],
            };
          }
          userMap[uid].photos.push(p);
        }
        setStoryGroups(Object.values(userMap));
      } else {
        // Global community story tray
        const res = await api.get('/api/stories');
        const rawList = Array.isArray(res.data) ? res.data : (res.data.stories || []);
        const normalized = rawList.map((g) => ({
          user_id: g.user_id,
          username: g.username || g.user_username || 'camper',
          avatar_url: g.avatar_url || g.user_avatar,
          photos: g.photos || [],
        }));
        setStoryGroups(normalized);
      }
    } catch (err) {
      console.error('Failed to load stories:', err);
      setStoryGroups([]);
    } finally {
      setLoading(false);
    }
  }, [campgroundId]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Register Agent Action to open story uploader
  useAgentAction({
    id: 'open_story_uploader',
    description: 'Opens the visitor story / backcountry moment upload dialog',
    parameters: { type: 'object', properties: {} },
    handler: () => {
      setIsUploadOpen(true);
      return { status: 'opened', modal: 'StoryUploadModal' };
    },
  });

  const handleOpenViewer = (groupIndex) => {
    setViewerState({ isOpen: true, initialGroupIndex: groupIndex });
  };

  const handleStoryDeleted = (photoId) => {
    fetchStories();
    if (onStoryUpdated) onStoryUpdated();
  };

  const handleUploadSuccess = () => {
    fetchStories();
    if (onStoryUpdated) onStoryUpdated();
  };

  // Check if a story group has any unviewed photo
  const isGroupUnviewed = (group) => {
    if (!group.photos || group.photos.length === 0) return false;
    return group.photos.some((p) => !viewedPhotoIds.includes(p.id));
  };

  return (
    <div id="story-bar" className={`w-full relative select-none ${className}`}>
      {/* Horizontal Story Scroll Container */}
      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto py-2 px-1 scrollbar-none no-scrollbar">
        {/* ADD STORY BUBBLE */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <button
            type="button"
            id="btn-upload-story"
            onClick={() => setIsUploadOpen(true)}
            aria-label="Add Backcountry Moment"
            className="cursor-pointer relative w-16 h-16 sm:w-18 sm:h-18 rounded-full p-0.5 border-2 border-dashed border-sky-400/60 hover:border-sky-400 bg-surface/80 hover:bg-surface-2 transition-all duration-300 flex items-center justify-center group shadow-md hover:shadow-sky-500/20 active:scale-95"
          >
            <div className="w-full h-full rounded-full bg-surface-2/80 flex items-center justify-center overflow-hidden relative">
              {user ? (
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}
                  alt="Your avatar"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username || 'camper'}`;
                  }}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                <Icon.Plus size={22} className="stroke-[2.5]" />
              </div>
            </div>
          </button>
          <span className="text-[11px] font-semibold text-fg-muted tracking-tight truncate max-w-[70px]">
            Your Moment
          </span>
        </div>

        {/* LOADING SKELETONS */}
        {loading && storyGroups.length === 0 && (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-surface-2 border border-border/60" />
                <div className="w-12 h-2.5 rounded bg-surface-2" />
              </div>
            ))}
          </>
        )}

        {/* USER STORY BUBBLES */}
        {storyGroups.map((group, idx) => {
          const unviewed = isGroupUnviewed(group);
          const photoCount = group.photos?.length || 0;

          return (
            <div key={group.user_id || idx} className="flex flex-col items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenViewer(idx)}
                aria-label={`View moments by ${group.username}`}
                className={`cursor-pointer relative w-16 h-16 sm:w-18 sm:h-18 rounded-full p-[2.5px] transition-all duration-300 hover:scale-105 active:scale-95 shadow-md ${
                  unviewed
                    ? 'bg-gradient-to-tr from-emerald-400 via-sky-400 to-cyan-300 ring-2 ring-sky-400/20 shadow-sky-500/20'
                    : 'bg-border/60 hover:bg-border'
                }`}
              >
                {/* Inner white gap / avatar container */}
                <div className="w-full h-full rounded-full overflow-hidden p-0.5 bg-background">
                  <img
                    src={
                      group.avatar_url ||
                      `https://api.dicebear.com/7.x/adventurer/svg?seed=${group.username || 'explorer'}`
                    }
                    alt={group.username}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=explorer_${idx}`;
                    }}
                  />
                </div>

                {/* Photo Stack Count Badge */}
                {photoCount > 1 && (
                  <span className="absolute bottom-0 right-0 px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[9px] font-black tracking-tight border-2 border-background shadow-sm">
                    {photoCount}
                  </span>
                )}
              </button>

              <span className="text-[11px] font-medium text-fg-muted tracking-tight truncate max-w-[72px]">
                @{group.username || 'camper'}
              </span>
            </div>
          );
        })}
      </div>

      {/* STORY VIEWER MODAL */}
      <StoryViewerModal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState({ isOpen: false, initialGroupIndex: 0 })}
        storyGroups={storyGroups}
        initialGroupIndex={viewerState.initialGroupIndex}
        onStoryDeleted={handleStoryDeleted}
      />

      {/* STORY UPLOAD MODAL */}
      <StoryUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        campgroundId={campgroundId}
        campgroundTitle={campgroundTitle}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
