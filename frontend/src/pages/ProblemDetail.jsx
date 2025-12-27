import { useMutation, useQuery } from '@apollo/client/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { Link, useParams } from 'react-router-dom';
import InteractiveBoulderImage from '../components/InteractiveBoulderImage';
import StarRating from '../components/StarRating';
import UsernameLink from '../components/UsernameLink';
import { useAuth } from '../contexts/AuthContext';
import { problemsAPI, ticksAPI } from '../services/api';
import {
    CREATE_COMMENT,
    CREATE_TICK,
    DELETE_TICK,
    GET_PROBLEM_DETAIL,
    UPDATE_PROBLEM_VIDEO_LINKS,
    UPDATE_TICK
} from '../services/graphql/queries';
import './ProblemDetail.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ProblemDetail = () => {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [problem, setProblem] = useState(null);
  const [comments, setComments] = useState([]);
  const [isTicked, setIsTicked] = useState(false);
  const [currentTick, setCurrentTick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [showTickModal, setShowTickModal] = useState(false);
  const [_problemTicks, setProblemTicks] = useState([]);
  const [_loadingTicks, setLoadingTicks] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoFormData, setVideoFormData] = useState({
    url: '',
    label: '',
  });
  const [tickFormData, setTickFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    notes: '',
    tick_grade: '',
    suggested_grade: '',
    rating: null,
  });

  // Use GraphQL query to fetch problem with all related data in one request
  const { data, loading: graphqlLoading, error: graphqlError } = useQuery(
    GET_PROBLEM_DETAIL,
    {
      variables: { id },
      skip: !id,
    }
  );

  // GraphQL mutations
  const [createTickMutation] = useMutation(CREATE_TICK, {
    refetchQueries: [{ query: GET_PROBLEM_DETAIL, variables: { id } }],
  });

  const [updateTickMutation] = useMutation(UPDATE_TICK, {
    refetchQueries: [{ query: GET_PROBLEM_DETAIL, variables: { id } }],
  });

  const [deleteTickMutation] = useMutation(DELETE_TICK, {
    refetchQueries: [{ query: GET_PROBLEM_DETAIL, variables: { id } }],
  });

  const [createCommentMutation] = useMutation(CREATE_COMMENT, {
    refetchQueries: [{ query: GET_PROBLEM_DETAIL, variables: { id } }],
  });

  const [updateVideoLinksMutation] = useMutation(UPDATE_PROBLEM_VIDEO_LINKS, {
    refetchQueries: [{ query: GET_PROBLEM_DETAIL, variables: { id } }],
  });

  // Extract data from GraphQL response
  const problemData = data?.problem;

  const checkTick = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('⏭️ Skipping tick check - user not authenticated');
      setIsTicked(false);
      setCurrentTick(null);
      return;
    }
    try {
      console.log('📡 Checking tick status for problem ID:', id);
      const response = await ticksAPI.list();
      const ticks = response.data.results || response.data;
      // Tick.problem is a nested object, so we need to check problem.id
      const tick = ticks.find((tick) => {
        const problemId = tick.problem?.id || tick.problem;
        return problemId === parseInt(id);
      });
      if (tick) {
        setIsTicked(true);
        setCurrentTick(tick);
        console.log('✅ Tick found:', tick);
      } else {
        setIsTicked(false);
        setCurrentTick(null);
        console.log('✅ Not ticked');
      }
    } catch (err) {
      console.error('❌ Failed to check tick:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });
      setIsTicked(false);
      setCurrentTick(null);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && id) {
      checkTick();
    } else {
      setIsTicked(false);
    }
  }, [id, isAuthenticated, checkTick]);

  // Update state when GraphQL data is available
  useEffect(() => {
    if (problemData) {
      console.log('✅ GraphQL data received:', problemData);
      
      // Helper to safely parse JSON strings
      const parseJson = (jsonString, defaultValue = {}) => {
        if (!jsonString) return defaultValue;
        if (typeof jsonString === 'string') {
          try {
            return JSON.parse(jsonString);
          } catch (e) {
            console.warn('Failed to parse JSON:', e);
            return defaultValue;
          }
        }
        return jsonString;
      };
      
      // Helper to parse JSON array strings
      const parseJsonArray = (jsonString) => {
        if (!jsonString) return [];
        if (typeof jsonString === 'string') {
          try {
            const parsed = JSON.parse(jsonString);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.warn('Failed to parse JSON array:', e);
            return [];
          }
        }
        // If already an array, return it
        return Array.isArray(jsonString) ? jsonString : [];
      };
      
      // Map GraphQL response to component state
      setProblem({
        ...problemData,
        // Map nested fields to match REST API structure
        area_detail: problemData.area,
        area: problemData.area?.id,
        sector_detail: problemData.sector,
        sector: problemData.sector?.id,
        wall_detail: problemData.wall,
        wall: problemData.wall?.id,
        author_username: problemData.author?.username,
        average_rating: problemData.avgRating || problemData.rating,
        // Parse GraphQL JSONString fields (externalLinks and videoLinks are JSONString types)
        video_links: parseJsonArray(problemData.videoLinks),
        external_links: parseJsonArray(problemData.externalLinks),
      });
      
      // Set comments from GraphQL
      setComments(problemData.comments || []);
      
      // Set statistics from GraphQL (transform keys to match REST API format)
      if (problemData.statistics) {
        setStatistics({
          total_ticks: problemData.statistics.totalTicks || 0,
          height_distribution: parseJson(problemData.statistics.heightDistribution),
          grade_voting: parseJson(problemData.statistics.gradeVoting),
          height_data_count: problemData.statistics.heightDataCount || 0,
          grade_votes_count: problemData.statistics.gradeVotesCount || 0,
        });
      }
      
      // Set ticks from GraphQL (map field names)
      setProblemTicks(
        (problemData.ticks || []).map(tick => ({
          ...tick,
          tick_grade: tick.tickGrade,
          suggested_grade: tick.suggestedGrade,
        }))
      );
      setLoadingTicks(false);
      setError(null);
    }
  }, [problemData]);

  // Handle loading and error states
  useEffect(() => {
    setLoading(graphqlLoading);
    if (graphqlError) {
      console.error('❌ GraphQL error:', graphqlError);
      setError(graphqlError.message || 'Failed to load problem details.');
    }
  }, [graphqlLoading, graphqlError]);

  // Fallback: Fetch images separately if not in GraphQL (for now)
  // Note: video_links and external_links are now handled by GraphQL
  const fetchProblemImages = async () => {
    try {
      const response = await problemsAPI.get(id);
      if (response.data?.images) {
        setProblem(prev => ({ ...prev, images: response.data.images }));
      }
    } catch (err) {
      console.error('Failed to fetch additional problem data:', err);
    }
  };

  useEffect(() => {
    // Only fetch images if not available in GraphQL response
    // video_links and external_links are now in GraphQL, so we only need to fetch images
    if (problemData && !problemData.images) {
      fetchProblemImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemData, id]);


  const handleTickSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please login to tick problems');
      return;
    }

    try {
      if (isTicked && currentTick) {
        // Update existing tick using GraphQL mutation
        const input = {};
        if (tickFormData.date) input.date = tickFormData.date;
        if (tickFormData.notes !== undefined) input.notes = tickFormData.notes || '';
        if (tickFormData.tick_grade !== undefined) input.tickGrade = tickFormData.tick_grade || null;
        if (tickFormData.suggested_grade !== undefined) input.suggestedGrade = tickFormData.suggested_grade || null;
        if (tickFormData.rating !== undefined && tickFormData.rating !== null) {
          input.rating = parseFloat(tickFormData.rating);
        }

        await updateTickMutation({
          variables: {
            id: currentTick.id,
            input,
          },
        });
        console.log('✅ Tick updated via GraphQL');
      } else {
        // Create new tick using GraphQL mutation
        const input = {
          problemId: id,
          date: tickFormData.date,
          notes: tickFormData.notes || '',
        };
        if (tickFormData.tick_grade) {
          input.tickGrade = tickFormData.tick_grade;
        }
        if (tickFormData.suggested_grade) {
          input.suggestedGrade = tickFormData.suggested_grade;
        }
        if (tickFormData.rating) {
          input.rating = parseFloat(tickFormData.rating);
        }

        await createTickMutation({
          variables: { input },
        });
        console.log('✅ Tick created via GraphQL');
      }
      
      setShowTickModal(false);
      setTickFormData({
        date: new Date().toISOString().split('T')[0],
        notes: '',
        tick_grade: '',
        suggested_grade: '',
        rating: null,
      });
      await checkTick();
      // GraphQL mutation will automatically refetch via refetchQueries
    } catch (err) {
      console.error('❌ Failed to save tick:', err);
      const errorMessage = err.graphQLErrors?.[0]?.message || err.message || 'Failed to save tick';
      alert(`Failed to ${isTicked ? 'update' : 'create'} tick: ${errorMessage}`);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please login to comment');
      return;
    }

    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await createCommentMutation({
        variables: {
          input: {
            problemId: id,
            content: newComment.trim(),
          },
        },
      });
      setNewComment('');
      console.log('✅ Comment created via GraphQL');
      // GraphQL mutation will automatically refetch via refetchQueries
    } catch (err) {
      console.error('Failed to submit comment:', err);
      const errorMessage = err.graphQLErrors?.[0]?.message || err.message || 'Failed to submit comment';
      alert(`Failed to submit comment: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVideoLinkSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please login to add video links');
      return;
    }

    if (!videoFormData.url.trim()) {
      alert('Please enter a video URL');
      return;
    }

    try {
      setSubmitting(true);
      
      // Get current video links and normalize them to objects
      const currentVideoLinks = problem?.video_links || [];
      const normalizedVideoLinks = currentVideoLinks.map((video) => {
        // If it's already an object with url and label, use it as is
        if (typeof video === 'object' && video !== null && video.url) {
          return {
            url: video.url,
            label: video.label || 'Beta Video',
          };
        }
        // If it's a string, convert it to an object
        if (typeof video === 'string') {
          return {
            url: video,
            label: 'Beta Video',
          };
        }
        // Fallback for any other format
        return {
          url: video?.url || video?.link || String(video),
          label: video?.label || video?.title || 'Beta Video',
        };
      });
      
      // Add new video link
      const newVideoLink = {
        url: videoFormData.url.trim(),
        label: videoFormData.label.trim() || 'Beta Video',
      };
      
      const updatedVideoLinks = [...normalizedVideoLinks, newVideoLink];

      await updateVideoLinksMutation({
        variables: {
          id: id,
          input: {
            videoLinks: updatedVideoLinks,
          },
        },
      });
      
      // Reset form
      setVideoFormData({ url: '', label: '' });
      setShowVideoModal(false);
      console.log('✅ Video link added via GraphQL');
      // GraphQL mutation will automatically refetch via refetchQueries
    } catch (err) {
      console.error('Failed to add video link:', err);
      const errorMessage = err.graphQLErrors?.[0]?.message || err.message || 'Failed to add video link';
      alert(`Failed to add video link: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to extract video ID and create embed
  const _getVideoEmbed = (url) => {
    if (!url) return null;

    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return (
        <iframe
          width="100%"
          height="400"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      );
    }

    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      return (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          width="100%"
          height="400"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        ></iframe>
      );
    }

    return null;
  };

  // Helper to format coordinates
  const formatCoordinates = (lat, lng) => {
    if (!lat || !lng) return null;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const latDir = latNum >= 0 ? 'N' : 'S';
    const lngDir = lngNum >= 0 ? 'E' : 'W';
    return `${Math.abs(latNum).toFixed(4)}° ${latDir}, ${Math.abs(lngNum).toFixed(4)}° ${lngDir}`;
  };

  // Helper to get video thumbnail from URL
  const getVideoThumbnail = (url) => {
    if (!url) return null;
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`;
    }
    
    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      // Vimeo requires API call for thumbnail, using placeholder for now
      return null;
    }
    
    return null;
  };

  // Helper to get external link icon based on label/URL
  const getExternalLinkIcon = (label, url) => {
    const lowerLabel = label?.toLowerCase() || '';
    const lowerUrl = url?.toLowerCase() || '';
    
    if (lowerLabel.includes('mountain project') || lowerUrl.includes('mountainproject')) {
      return 'landscape';
    }
    if (lowerLabel.includes('8a') || lowerUrl.includes('8a.nu')) {
      return 'history_edu';
    }
    if (lowerUrl.includes('lezec')) {
      return 'link';
    }
    return 'link';
  };

  // Helper to get external link color class
  const getExternalLinkColor = (label, url) => {
    const lowerLabel = label?.toLowerCase() || '';
    const lowerUrl = url?.toLowerCase() || '';
    
    if (lowerLabel.includes('mountain project') || lowerUrl.includes('mountainproject')) {
      return 'external-link-blue';
    }
    if (lowerLabel.includes('8a') || lowerUrl.includes('8a.nu')) {
      return 'external-link-orange';
    }
    return 'external-link-default';
  };

  // Helper to get initials from username
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get coordinates from sector
  const coordinates = problem?.sector_detail?.latitude && problem?.sector_detail?.longitude
    ? {
        lat: parseFloat(problem.sector_detail.latitude),
        lng: parseFloat(problem.sector_detail.longitude),
      }
    : null;

  // Get first ascent info
  const firstAscent = problem?.author_username || problem?.author_name || null;

  // Get selected image
  const selectedImage = problem?.images?.[selectedImageIndex] || null;
  const allImages = problem?.images || [];

  // Build breadcrumbs
  const breadcrumbs = [];
  breadcrumbs.push({ label: 'Home', path: '/' });
  if (problem?.area_detail || problem?.area) {
    const area = problem.area_detail || problem.area;
    breadcrumbs.push({ 
      label: area?.name || `Area #${area?.id || problem.area}`, 
      path: `/areas/${area?.id || problem.area}` 
    });
  }
  if (problem?.sector_detail || problem?.sector) {
    const sector = problem.sector_detail || problem.sector;
    breadcrumbs.push({ 
      label: sector?.name || `Sector #${sector?.id || problem.sector}`, 
      path: `/sectors/${sector?.id || problem.sector}` 
    });
  }
  breadcrumbs.push({ label: problem?.name, path: null });

  if (loading) {
    return (
      <div className="problem-detail-page" data-theme="dark">
        <div className="loading">Loading problem details...</div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="problem-detail-page" data-theme="dark">
        <div className="error">{error || 'Problem not found'}</div>
      </div>
    );
  }

  return (
    <div className="problem-detail-page" data-theme="dark">
      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        {breadcrumbs.map((crumb, index) => (
          <span key={index} className="breadcrumb-item">
            {crumb.path ? (
              <Link to={crumb.path} className="breadcrumb-link">
                {index === 0 && <span className="material-symbols-outlined breadcrumb-icon">home</span>}
                {crumb.label}
              </Link>
            ) : (
              <span className="breadcrumb-current">{crumb.label}</span>
            )}
            {index < breadcrumbs.length - 1 && <span className="breadcrumb-separator">/</span>}
          </span>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="problem-detail-grid">
        {/* LEFT COLUMN (Visuals & Map) */}
        <div className="problem-detail-left">
          {/* Hero Image / Gallery */}
          {allImages.length > 0 ? (
            <div className="image-gallery-section">
              <div className="hero-image-container">
                {selectedImage && (
                  <InteractiveBoulderImage
                    imageUrl={selectedImage.image}
                    problemLines={selectedImage.problem_lines || []}
                    caption={selectedImage.caption}
                    currentProblemId={parseInt(id)}
                  />
                )}
                {allImages.length > 1 && (
                  <div className="image-counter">
                    <span className="material-symbols-outlined">photo_camera</span>
                    {selectedImageIndex + 1}/{allImages.length}
                  </div>
                )}
              </div>
              {/* Thumbnails */}
              {allImages.length > 1 && (
                <div className="image-thumbnails">
                  {allImages.map((image, index) => (
                    <div
                      key={image.id}
                      className={`thumbnail ${index === selectedImageIndex ? 'active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                      style={{ backgroundImage: `url(${image.image})` }}
                    />
                  ))}
                  {/* Add image placeholder */}
                  {isAuthenticated && (
                    <div className="thumbnail add-thumbnail">
                      <span className="material-symbols-outlined">add</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="image-gallery-section">
              <div className="hero-image-container no-image">
                <div className="no-image-placeholder">
                  <span className="material-symbols-outlined">image</span>
                  <p>No images available</p>
                </div>
              </div>
            </div>
          )}

          {/* Map Section */}
          {coordinates && (
            <div className="map-section">
              <div className="map-header">
                <h3 className="map-title">
                  <span className="material-symbols-outlined map-icon">location_on</span>
                  Location
                </h3>
                <a
                  href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="directions-link"
                >
                  Get Directions <span className="material-symbols-outlined">open_in_new</span>
                </a>
              </div>
              <div className="map-container">
                <MapContainer
                  center={[coordinates.lat, coordinates.lng]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[coordinates.lat, coordinates.lng]} />
                </MapContainer>
                <div className="coordinates-display">
                  {formatCoordinates(coordinates.lat, coordinates.lng)}
                </div>
              </div>
            </div>
          )}

          {/* Beta Videos Section */}
          {((problem?.video_links && Array.isArray(problem.video_links) && problem.video_links.length > 0) || isAuthenticated) && (
            <div className="videos-section">
              <div className="videos-header">
                <h3 className="videos-title">
                  <span className="material-symbols-outlined videos-icon">play_circle</span>
                  Beta Videos
                </h3>
                {isAuthenticated && (
                  <button 
                    className="add-video-btn"
                    onClick={() => setShowVideoModal(true)}
                  >
                    Add Video <span className="material-symbols-outlined">add_circle</span>
                  </button>
                )}
              </div>
              {problem?.video_links && Array.isArray(problem.video_links) && problem.video_links.length > 0 && (
                <div className="videos-grid">
                  {problem.video_links
                    .map((video, index) => {
                    // Handle both string URLs and object format {url, label}
                    const videoUrl = typeof video === 'string' ? video : (video?.url || video?.link || '');
                    const videoLabel = typeof video === 'string' ? 'Beta Video' : (video?.label || video?.title || 'Beta Video');
                    
                    if (!videoUrl) {
                      console.warn('Video link missing URL:', video);
                      return null;
                    }
                    
                    const thumbnail = getVideoThumbnail(videoUrl);
                    return (
                      <div
                        key={index}
                        className="video-card"
                        onClick={() => {
                          // Open video in modal or new tab
                          window.open(videoUrl, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <div className="video-thumbnail-container">
                          {thumbnail ? (
                            <div
                              className="video-thumbnail"
                              style={{ backgroundImage: `url(${thumbnail})` }}
                            />
                          ) : (
                            <div className="video-thumbnail video-thumbnail-placeholder">
                              <span className="material-symbols-outlined">play_circle</span>
                            </div>
                          )}
                          <div className="video-play-overlay">
                            <div className="video-play-button">
                              <span className="material-symbols-outlined">play_arrow</span>
                            </div>
                          </div>
                        </div>
                        <div className="video-info-overlay">
                          <p className="video-title">{videoLabel}</p>
                          <div className="video-meta">
                            <span className="video-author">Beta Video</span>
                            <span className="video-dot">•</span>
                            <span className="video-duration">Beta</span>
                          </div>
                        </div>
                      </div>
                    );
                    })
                    .filter(Boolean)}
                </div>
              )}
              {(!problem?.video_links || !Array.isArray(problem.video_links) || problem.video_links.length === 0) && isAuthenticated && (
                <div className="no-videos-message">
                  <p>No videos yet. Be the first to add one!</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (Data & Comments) */}
        <div className="problem-detail-right">
          {/* Header Info */}
          <div className="problem-header-info">
            <div className="problem-title-row">
              <h1 className="problem-title">
                {problem.name}
                <span className="problem-grade-inline">{problem.grade}</span>
              </h1>
            </div>
            
            {/* Tags - placeholder for future implementation */}
            {/* <div className="problem-tags">
              <span className="tag">#Overhang</span>
              <span className="tag">#Crimps</span>
              <span className="tag">#PowerEndurance</span>
            </div> */}

            {/* Rating */}
            {(problem.average_rating || problem.rating) && (
              <div className="problem-rating-display">
                <StarRating 
                  rating={parseFloat(problem.average_rating || problem.rating)} 
                  size="medium" 
                />
                <span className="rating-value">
                  ({parseFloat(problem.average_rating || problem.rating).toFixed(1)})
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="problem-actions-row">
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    if (isTicked && currentTick) {
                      setTickFormData({
                        date: currentTick.date || new Date().toISOString().split('T')[0],
                        notes: currentTick.notes || '',
                        tick_grade: currentTick.tick_grade || '',
                        suggested_grade: currentTick.suggested_grade || '',
                        rating: currentTick.rating ? parseFloat(currentTick.rating) : null,
                      });
                      setShowTickModal(true);
                    } else {
                      setTickFormData({
                        date: new Date().toISOString().split('T')[0],
                        notes: '',
                        tick_grade: '',
                        suggested_grade: '',
                        rating: null,
                      });
                      setShowTickModal(true);
                    }
                  }}
                  className="btn-log-ascent"
                >
                  {isTicked ? 'Edit Tick' : 'Log Ascent'}
                </button>
              ) : (
                <Link to="/login" className="btn-log-ascent">
                  Log Ascent
                </Link>
              )}
              <button className="btn-icon" title="Add to Project">
                <span className="material-symbols-outlined">bookmark_add</span>
              </button>
              <button className="btn-icon" title="Share">
                <span className="material-symbols-outlined">ios_share</span>
              </button>
            </div>
          </div>

          {/* First Ascent & Stats Cards */}
          <div className="problem-info-cards">
            {firstAscent && (
              <div className="info-card">
                <p className="info-card-label">First Ascent</p>
                <p className="info-card-value">{firstAscent}</p>
              </div>
            )}
            {statistics && statistics.total_ticks > 0 && (
              <div className="info-card">
                <p className="info-card-label">Ticks</p>
                <p className="info-card-value">{statistics.total_ticks}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {problem.description && (
            <div className="problem-description-section">
              <p className="description-text">{problem.description}</p>
            </div>
          )}

          {/* External Resources Section */}
          {problem?.external_links && Array.isArray(problem.external_links) && problem.external_links.length > 0 && (
            <div className="external-resources-section">
              <h3 className="external-resources-title">
                <span className="material-symbols-outlined external-resources-icon">link</span>
                External Resources
              </h3>
              <div className="external-links-list">
                {problem.external_links.map((link, index) => {
                  // Ensure link has required properties
                  if (!link || !link.url) {
                    console.warn('Invalid external link:', link);
                    return null;
                  }
                  
                  // Extract a better label from URL if label is missing or invalid
                  const getLinkLabel = () => {
                    if (link.label && link.label.trim() && !link.label.match(/^ROCK_/i)) {
                      return link.label;
                    }
                    // Try to extract domain from URL
                    try {
                      const urlObj = new URL(link.url);
                      const hostname = urlObj.hostname.replace('www.', '');
                      return hostname.split('.')[0] || 'External Link';
                    } catch (e) {
                      return 'External Link';
                    }
                  };
                  
                  const linkLabel = getLinkLabel();
                  const linkUrl = link.url;
                  
                  return (
                    <a
                      key={index}
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link-item"
                    >
                      <div className="external-link-content">
                        <div className={`external-link-icon ${getExternalLinkColor(linkLabel, linkUrl)}`}>
                          <span className="material-symbols-outlined">
                            {getExternalLinkIcon(linkLabel, linkUrl)}
                          </span>
                        </div>
                        <div className="external-link-text">
                          <p className="external-link-title">{linkLabel}</p>
                          <p className="external-link-description">
                            {link.description || 'View external resource'}
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined external-link-arrow">open_in_new</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Statistics Section - Integrated */}
          {statistics && statistics.total_ticks > 0 && (
            <div className="statistics-section-integrated">
              {statistics.height_data_count > 0 && (
                <div className="stat-group-compact">
                  <h4 className="stat-title">Height Distribution</h4>
                  <p className="stat-description-compact">
                    {statistics.height_data_count} of {statistics.total_ticks} climbers provided height data
                  </p>
                  <div className="height-chart-compact">
                    {Object.entries(statistics.height_distribution)
                      .sort((a, b) => {
                        const order = ['<150', '150-155', '155-160', '160-165', '165-170', '170-175', '175-180', '180-185', '185-190', '190-195', '>195'];
                        return order.indexOf(a[0]) - order.indexOf(b[0]);
                      })
                      .slice(0, 5) // Show top 5
                      .map(([height, data]) => {
                        const percentage = (data.count / statistics.height_data_count) * 100;
                        return (
                          <div key={height} className="height-bar-item-compact">
                            <div className="height-label-compact">{data.label}</div>
                            <div className="height-bar-container-compact">
                              <div 
                                className="height-bar-compact" 
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="height-count-compact">{data.count}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {statistics.grade_votes_count > 0 && (
                <div className="stat-group-compact">
                  <h4 className="stat-title">Grade Voting</h4>
                  <p className="stat-description-compact">
                    {statistics.grade_votes_count} of {statistics.total_ticks} climbers voted on the grade
                  </p>
                  <div className="grade-voting-chart-compact">
                    {Object.entries(statistics.grade_voting)
                      .sort((a, b) => {
                        const gradeOrder = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
                        return gradeOrder.indexOf(a[0]) - gradeOrder.indexOf(b[0]);
                      })
                      .slice(0, 5) // Show top 5
                      .map(([grade, data]) => {
                        const percentage = (data.count / statistics.grade_votes_count) * 100;
                        return (
                          <div key={grade} className="grade-vote-item-compact">
                            <div className="grade-vote-label-compact">{data.label}</div>
                            <div className="grade-vote-bar-container-compact">
                              <div 
                                className="grade-vote-bar-compact" 
                                style={{ width: `${percentage}%` }}
                              >
                                <span className="grade-vote-count-compact">{data.count}</span>
                              </div>
                            </div>
                            <div className="grade-vote-percentage-compact">{percentage.toFixed(1)}%</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments Section */}
          <div className="comments-section-new">
            <h3 className="comments-title">
              Beta & Comments <span className="comments-count">{comments.length}</span>
            </h3>
            
            {/* Comment Input */}
            {isAuthenticated ? (
              <form onSubmit={handleCommentSubmit} className="comment-input-section">
                <div className="comment-avatar-placeholder">
                  {getInitials(user?.username || 'U')}
                </div>
                <div className="comment-input-wrapper">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your beta or thoughts..."
                    rows="3"
                    className="comment-textarea"
                  />
                  <div className="comment-submit-wrapper">
                    <button
                      type="submit"
                      disabled={submitting || !newComment.trim()}
                      className="btn-comment-submit"
                    >
                      {submitting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="login-prompt">
                <Link to="/login">Login</Link> to add comments
              </p>
            )}

            {/* Comments List */}
            <div className="comments-list-new">
              {comments.length === 0 ? (
                <p className="no-comments">No comments yet. Be the first to comment!</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-avatar-placeholder">
                      {getInitials(comment.user?.username || 'A')}
                    </div>
                    <div className="comment-content-wrapper">
                      <div className="comment-header-new">
                        <UsernameLink 
                          username={comment.user?.username} 
                          userId={comment.user?.id}
                          className="comment-author"
                        />
                        <span className="comment-date-new">
                          {(() => {
                            const date = new Date(comment.created_at);
                            const now = new Date();
                            const diffTime = Math.abs(now - date);
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays === 0) return 'Today';
                            if (diffDays === 1) return '1 day ago';
                            if (diffDays < 7) return `${diffDays} days ago`;
                            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
                            return date.toLocaleDateString();
                          })()}
                        </span>
                      </div>
                      <p className="comment-text">{comment.content}</p>
                      <div className="comment-actions">
                        <button className="comment-action-btn">
                          <span className="material-symbols-outlined">thumb_up</span> 0
                        </button>
                        <button className="comment-action-btn">Reply</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {comments.length > 5 && (
              <button className="load-more-comments">Load more comments</button>
            )}
          </div>
        </div>
      </div>


      {/* Tick Modal */}
      {showTickModal && (
        <div className="modal-overlay" onClick={() => setShowTickModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isTicked ? 'Edit Tick' : 'Add Tick'}</h2>
              <button className="modal-close" onClick={() => setShowTickModal(false)}>×</button>
            </div>
            <form onSubmit={handleTickSubmit} className="tick-form">
              <div className="form-group">
                <label htmlFor="tick-date">Date:</label>
                <input
                  type="date"
                  id="tick-date"
                  value={tickFormData.date}
                  onChange={(e) => setTickFormData({ ...tickFormData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="tick-grade">Grade You Climbed (Optional):</label>
                <select
                  id="tick-grade"
                  value={tickFormData.tick_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, tick_grade: e.target.value })}
                >
                  <option value="">Same as problem grade ({problem.grade})</option>
                  {['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'].map(
                    (grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    )
                  )}
                </select>
                <small>If you used easier beta, select the grade you actually climbed. This will be used for your statistics.</small>
              </div>
              <div className="form-group">
                <label htmlFor="suggested-grade">Suggested Grade (Optional):</label>
                <select
                  id="suggested-grade"
                  value={tickFormData.suggested_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, suggested_grade: e.target.value })}
                >
                  <option value="">No grade suggestion</option>
                  {['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'].map(
                    (grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    )
                  )}
                </select>
                <small>Help the community by suggesting what grade you think this problem is</small>
              </div>
              <div className="form-group">
                <label htmlFor="tick-rating">Rate this Problem (Optional):</label>
                <StarRating
                  rating={tickFormData.rating ? parseFloat(tickFormData.rating) : 0}
                  onChange={(rating) => setTickFormData({ ...tickFormData, rating: rating })}
                  editable={true}
                  size="medium"
                />
                <small>Rate this problem from 1 to 5 stars based on your experience</small>
              </div>
              <div className="form-group">
                <label htmlFor="tick-notes">Notes (Optional):</label>
                <textarea
                  id="tick-notes"
                  value={tickFormData.notes}
                  onChange={(e) => setTickFormData({ ...tickFormData, notes: e.target.value })}
                  rows="3"
                  placeholder="Add any notes about your send..."
                />
              </div>
              <div className="modal-actions">
                {isTicked && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this tick?')) {
                        try {
                          await deleteTickMutation({
                            variables: { id: currentTick.id },
                          });
                          setShowTickModal(false);
                          await checkTick();
                          console.log('✅ Tick deleted via GraphQL');
                          // GraphQL mutation will automatically refetch via refetchQueries
                        } catch (err) {
                          console.error('❌ Failed to delete tick:', err);
                          const errorMessage = err.graphQLErrors?.[0]?.message || err.message || 'Failed to delete tick';
                          alert(`Failed to delete tick: ${errorMessage}`);
                        }
                      }
                    }}
                  >
                    Delete Tick
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowTickModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isTicked ? 'Update Tick' : 'Add Tick'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Link Modal */}
      {showVideoModal && (
        <div className="modal-overlay" onClick={() => setShowVideoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Video Link</h2>
              <button className="modal-close" onClick={() => setShowVideoModal(false)}>×</button>
            </div>
            <form onSubmit={handleVideoLinkSubmit} className="tick-form">
              <div className="form-group">
                <label htmlFor="video-url">Video URL:</label>
                <input
                  type="url"
                  id="video-url"
                  value={videoFormData.url}
                  onChange={(e) => setVideoFormData({ ...videoFormData, url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                  required
                />
                <small>Supports YouTube and Vimeo links</small>
              </div>
              <div className="form-group">
                <label htmlFor="video-label">Label (Optional):</label>
                <input
                  type="text"
                  id="video-label"
                  value={videoFormData.label}
                  onChange={(e) => setVideoFormData({ ...videoFormData, label: e.target.value })}
                  placeholder="e.g., Send Video, Beta Video, etc."
                />
                <small>Optional label for the video (defaults to &quot;Beta Video&quot;)</small>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowVideoModal(false);
                    setVideoFormData({ url: '', label: '' });
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting || !videoFormData.url.trim()}
                >
                  {submitting ? 'Adding...' : 'Add Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemDetail;

