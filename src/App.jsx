import { useState, useEffect, useRef } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { generateAvatar, getUserStatus, createInvoice, generateMultiPhoto, generateStyleTransfer, generateVideo, generateLipSync, generateRemoveBg, generateEnhance, generateTextToImage, generateGeminiStyle, generateNanoBanana, validateAdminPassword } from './utils/api';
import { STYLES, STARS_PER_GENERATION } from './utils/styles';
import { MODES, DEFAULT_MODE, getStarCost } from './utils/modes';
import PhotoUpload from './components/PhotoUpload';
import StyleSelector from './components/StyleSelector';
import GenerateButton from './components/GenerateButton';
import LoadingScreen from './components/LoadingScreen';
import ResultScreen from './components/ResultScreen';
import SentScreen from './components/SentScreen';
import ModeSelector from './components/ModeSelector';
import MultiPhotoUpload from './components/MultiPhotoUpload';
import ReferencePhotoUpload from './components/ReferencePhotoUpload';
import PromptInput from './components/PromptInput';
import DurationSelector from './components/DurationSelector';
import ResolutionSelector from './components/ResolutionSelector';
import StyleTransferUpload from './components/StyleTransferUpload';
import AdminPanel from './components/AdminPanel';
import HistoryScreen from './components/HistoryScreen';
import ReferralScreen from './components/ReferralScreen';
import { saveGeneration } from './utils/generationCache';

const SCREENS = {
  MAIN: 'main',
  LOADING: 'loading',
  RESULT: 'result',
  SENT: 'sent',
  ERROR: 'error',
  HISTORY: 'history',
  REFERRAL: 'referral',
};

export default function App() {
  const { tg, initTelegram, userId, username, initData, hapticFeedback, openInvoice, startParam } = useTelegram();

  const [screen, setScreen] = useState(SCREENS.MAIN);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [freeGens, setFreeGens] = useState(null);
  const [starBalance, setStarBalance] = useState(0);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creativity, setCreativity] = useState(50);
  const [debugStep, setDebugStep] = useState(null);

  // New mode state
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [photos, setPhotos] = useState([null, null, null, null]);
  const [referenceFile, setReferenceFile] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [videoDuration, setVideoDuration] = useState('5');
  const [videoQuality, setVideoQuality] = useState('std');
  const [videoSound, setVideoSound] = useState(false);
  const [videoAspect, setVideoAspect] = useState('9:16');
  const [lastFrameFile, setLastFrameFile] = useState(null);
  const [lastFramePreview, setLastFramePreview] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioName, setAudioName] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const audioInputRef = useRef(null);
  const [resultType, setResultType] = useState('image');
  const [resultVideo, setResultVideo] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [aiClickCount, setAiClickCount] = useState(0);
  const [aiClickTimer, setAiClickTimer] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [styleResolution, setStyleResolution] = useState('2K');

  const handleAiClick = () => {
    const newCount = aiClickCount + 1;
    setAiClickCount(newCount);

    if (aiClickTimer) clearTimeout(aiClickTimer);

    if (newCount >= 3) {
      setAiClickCount(0);
      setAdminPassword('');
      setShowPasswordModal(true);
      hapticFeedback('medium');
    } else {
      const timer = setTimeout(() => setAiClickCount(0), 800);
      setAiClickTimer(timer);
    }
  };

  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  const handleAdminPasswordSubmit = async () => {
    if (!adminPassword.trim()) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const result = await validateAdminPassword(adminPassword);
      const data = Array.isArray(result) ? result[0] : result;
      if (data?.error) {
        setAdminError(data.message || 'Access denied');
        hapticFeedback('medium');
        return;
      }
      // Server accepted the password
      setShowPasswordModal(false);
      setShowAdmin(true);
      hapticFeedback('heavy');
    } catch (e) {
      setAdminError('Неверный пароль или ошибка сервера');
      hapticFeedback('medium');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleShareInvite = () => {
    hapticFeedback('light');
    const link = `https://t.me/those_are_the_gifts_bot?start=ref_${userId}`;
    const text = '\ud83c\udfa8 \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 AI Avatar Studio \u2014 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u0430\u0432\u0430\u0442\u0430\u0440\u043e\u043a, \u0432\u0438\u0434\u0435\u043e \u0438 \u0430\u0440\u0442\u0430 \u043f\u0440\u044f\u043c\u043e \u0432 Telegram! \u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0435 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u043a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c.';
    try {
      if (tg) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
      } else if (navigator.share) {
        navigator.share({ title: 'Avatar Studio AI', text, url: link });
      } else {
        navigator.clipboard?.writeText(`${text}\n${link}`);
      }
    } catch {
      navigator.clipboard?.writeText(`${text}\n${link}`);
    }
  };

  useEffect(() => {
    initTelegram();
    if (userId) {
      loadUserStatus();
    }
  }, [userId]);

  const loadUserStatus = async () => {
    try {
      const result = await getUserStatus(userId, initData, username);
      const status = Array.isArray(result) ? result[0] : result;

      // Проверка блокировки пользователя
      if (status.blocked) {
        setIsBlocked(true);
        setScreen(SCREENS.ERROR);
        setError('Ваш аккаунт заблокирован');
        setErrorDetails('Если вы считаете что это ошибка, свяжитесь с поддержкой.');
        return;
      }

      setIsBlocked(false);
      setFreeGens({
        free_stylize: status.free_stylize ?? 0,
        free_remove_bg: status.free_remove_bg ?? 0,
        free_enhance: status.free_enhance ?? 0,
      });
      setStarBalance(status.star_balance || 0);
    } catch (e) {
      console.error('Failed to load user status:', e);
      setFreeGens({ free_stylize: 1, free_remove_bg: 1, free_enhance: 1 });
    }
  };

  const handlePhotoSelected = (file, preview) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
    hapticFeedback('light');
  };

  const handleReferenceSelected = (file, preview) => {
    setReferenceFile(file);
    setReferencePreview(preview);
    hapticFeedback('light');
  };

  const clearAudio = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioFile(null);
    setAudioName(null);
    setAudioPreviewUrl(null);
  };

  const handleStyleSelect = (styleId) => {
    setSelectedStyle(styleId);
    hapticFeedback('light');
  };

  const handleModeSelect = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedStyle(null);
    setPhotos([null, null, null, null]);
    setReferenceFile(null);
    setReferencePreview(null);
    setPromptText('');
    setVideoDuration('5');
    setVideoQuality('std');
    setVideoSound(false);
    setVideoAspect('9:16');
    setLastFrameFile(null);
    setLastFramePreview(null);
    clearAudio();
    setStyleResolution('2K');
    hapticFeedback('light');
  };

  const handleTopUp = async (amount) => {
    try {
      const { invoice_link } = await createInvoice(userId, amount || topUpAmount, initData);
      const status = await openInvoice(invoice_link);
      if (status === 'paid') {
        hapticFeedback('heavy');
        await loadUserStatus();
        setShowTopUp(false);
      }
    } catch (e) {
      console.error('Top-up failed:', e);
    }
  };

  // Compute canGenerate based on mode
  const currentMode = MODES[mode];
  const starCost = getStarCost(mode, {
    duration: videoDuration,
    videoQuality,
    videoSound,
    photoCount: photos.filter(Boolean).length,
    resolution: styleResolution,
  });
  const freeLeft = (freeGens && currentMode.freeKey) ? (freeGens[currentMode.freeKey] || 0) : 0;
  let canGenerate = false;
  switch (mode) {
    case 'stylize':
      canGenerate = !!(photoFile && selectedStyle);
      break;
    case 'multi_photo':
      canGenerate = photos.filter(Boolean).length >= (currentMode.minPhotos || 2) && promptText.trim().length > 0;
      break;
    case 'ai_magic':
      canGenerate = photos.filter(Boolean).length >= (currentMode.minPhotos || 2);
      break;
    case 'style_transfer':
      canGenerate = photos.filter(Boolean).length >= 2 && promptText.trim().length > 0;
      break;
    case 'gemini_style':
      canGenerate = !!(photoFile && referenceFile);
      break;
    case 'photo_to_video':
      canGenerate = !!(photoFile && promptText.trim().length > 0);
      break;
    case 'lip_sync':
      canGenerate = !!(photoFile && audioFile);
      break;
    case 'remove_bg':
    case 'enhance':
      canGenerate = !!photoFile;
      break;
    case 'text_to_image':
      canGenerate = promptText.trim().length > 0;
      break;
  }

  const handleGenerate = async () => {
    if (!canGenerate) return;

    const hasFree = currentMode.hasFree && freeLeft > 0;
    if (!hasFree && starBalance < starCost) {
      setShowTopUp(true);
      return;
    }

    setIsLoading(true);
    setScreen(SCREENS.LOADING);
    setResultType(currentMode.resultType);
    setError(null);
    hapticFeedback('medium');

    try {
      let result;

      switch (mode) {
        case 'stylize':
          result = await generateAvatar(userId, photoFile, selectedStyle, initData, creativity, setDebugStep);
          break;
        case 'multi_photo':
          result = await generateMultiPhoto(
            userId,
            photos.filter(Boolean).map((p) => p.file),
            promptText,
            initData,
            setDebugStep
          );
          break;
        case 'ai_magic':
          result = await generateNanoBanana(
            userId,
            photos.filter(Boolean).map((p) => p.file),
            promptText,
            initData,
            setDebugStep
          );
          break;
        case 'style_transfer':
          result = await generateStyleTransfer(
            userId,
            photos.filter(Boolean).map((p) => p.file),
            promptText,
            styleResolution,
            initData,
            setDebugStep
          );
          break;
        case 'gemini_style':
          result = await generateGeminiStyle(userId, photoFile, referenceFile, promptText, initData, setDebugStep);
          break;
        case 'photo_to_video':
          result = await generateVideo(userId, photoFile, promptText, videoDuration, {
            quality: videoQuality, sound: videoSound, aspect: videoAspect, lastFrameFile,
          }, initData, setDebugStep);
          break;
        case 'lip_sync':
          result = await generateLipSync(userId, photoFile, audioFile, promptText, initData, setDebugStep);
          break;
        case 'remove_bg':
          result = await generateRemoveBg(userId, photoFile, initData, setDebugStep);
          break;
        case 'enhance':
          result = await generateEnhance(userId, photoFile, initData, setDebugStep);
          break;
        case 'text_to_image':
          result = await generateTextToImage(userId, promptText, initData, setDebugStep);
          break;
      }

      const data = Array.isArray(result) ? result[0] : result;

      if (data?.error === 'insufficient_balance') {
        setScreen(SCREENS.MAIN);
        setShowTopUp(true);
        return;
      }

      if (data?.error) {
        throw new Error(data.message || data.error_msg || 'Ошибка генерации. Попробуйте ещё раз.');
      }

      // New flow: result sent to Telegram DM
      if (data?.sent) {
        setScreen(SCREENS.SENT);
        hapticFeedback('heavy');
        await loadUserStatus();
        return;
      }

      // Fallback: old flow with image/video URL in response
      if (currentMode.resultType === 'video') {
        const videoUrl = data?.video_url || data?.video?.url;
        if (videoUrl) {
          saveGeneration({ mode, result_type: 'video', result_url: videoUrl, prompt: promptText });
          setResultVideo(videoUrl);
          setScreen(SCREENS.RESULT);
          hapticFeedback('heavy');
          await loadUserStatus();
        } else {
          throw new Error(`No video in response. Keys: ${Object.keys(data || {}).join(',')}`);
        }
      } else {
        const imageUrl = data?.image_url || data?.images?.[0]?.url;
        if (imageUrl) {
          saveGeneration({ mode, result_type: 'image', result_url: imageUrl, prompt: promptText });
          setResultImage(imageUrl);
          setScreen(SCREENS.RESULT);
          hapticFeedback('heavy');
          await loadUserStatus();
        } else {
          throw new Error(`No image in response. Keys: ${Object.keys(data || {}).join(',')}`);
        }
      }
    } catch (e) {
      console.error('Generation failed:', e);
      const msg = e.message || '';
      let userMsg;
      if (msg.includes('TIMEOUT') || msg.includes('AbortError') || msg.includes('60 секунд')) {
        userMsg = 'Сервер не ответил вовремя. Попробуйте ещё раз через минуту.';
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        userMsg = 'Нет подключения к серверу. Проверьте интернет и попробуйте снова.';
      } else if (msg.includes('insufficient_balance') || msg.includes('No balance')) {
        userMsg = 'Недостаточно звёзд. Пополните баланс.';
      } else if (msg.includes('UPLOAD') || msg.includes('upload')) {
        userMsg = 'Не удалось загрузить фото. Попробуйте другое изображение.';
      } else if (msg.includes('No image') || msg.includes('No video')) {
        userMsg = 'AI не смог создать результат. Попробуйте другое фото или промпт.';
      } else if (msg.includes('API error: 5')) {
        userMsg = 'Сервер временно недоступен. Попробуйте через пару минут.';
      } else {
        userMsg = 'Что-то пошло не так. Попробуйте ещё раз.';
      }
      setError(userMsg);
      setErrorDetails(msg);
      setScreen(SCREENS.ERROR);
      hapticFeedback('heavy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewGeneration = () => {
    setScreen(SCREENS.MAIN);
    setResultImage(null);
    setResultVideo(null);
    setResultType('image');
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedStyle(null);
    setPhotos([null, null, null, null]);
    setReferenceFile(null);
    setReferencePreview(null);
    setPromptText('');
    setVideoDuration('5');
    setVideoQuality('std');
    setVideoSound(false);
    setVideoAspect('9:16');
    setLastFrameFile(null);
    setLastFramePreview(null);
    clearAudio();
    setStyleResolution('2K');
    setError(null);
    // Keep mode selection
  };

  // Button label per mode
  const buttonLabels = {
    stylize: '\u2728 Создать аватарку',
    multi_photo: '\u2728 Сгенерировать',
    ai_magic: '\ud83c\udf1f Создать AI-аватар',
    style_transfer: '\u2728 Перенести стиль',
    gemini_style: '\ud83c\udf1f Создать с Gemini',
    photo_to_video: '\ud83c\udfac Создать видео',
    lip_sync: '\ud83d\udde3\ufe0f Создать Lip Sync',
    remove_bg: '\u2702\ufe0f Убрать фон',
    enhance: '\u2728 Улучшить',
    text_to_image: '\ud83d\udcac Создать',
  };

  return (
    <div className="app">
      <div className="bg-gradient"></div>
      <div className="bg-noise"></div>

      {screen === SCREENS.LOADING && <LoadingScreen mode={mode} />}

      {screen === SCREENS.SENT && (
        <SentScreen onBack={handleNewGeneration} />
      )}

      {screen === SCREENS.RESULT && (resultImage || resultVideo) && (
        <ResultScreen
          imageUrl={resultImage}
          videoUrl={resultVideo}
          resultType={resultType}
          style={selectedStyle}
          onNewGeneration={handleNewGeneration}
          userId={userId}
        />
      )}

      {screen === SCREENS.ERROR && (
        <div className="error-screen">
          <div className="error-icon">😔</div>
          <h2>Ошибка</h2>
          <p>{error}</p>
          {errorDetails && (
            <div style={{ fontSize: '11px', color: 'var(--text-hint)', marginTop: '10px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', wordBreak: 'break-word', fontFamily: 'monospace' }}>
              {errorDetails}
            </div>
          )}
          <button className="action-btn primary" onClick={handleNewGeneration}>
            Попробовать снова
          </button>
        </div>
      )}

      {screen === SCREENS.MAIN && (
        <div className="main-screen">
          <header className="app-header">
            <h1 className="app-title">
              <span className="title-accent" onClick={handleAiClick}>AI</span> DEVELOPERS
            </h1>
            <p className="app-subtitle">{currentMode.description}</p>
            {freeGens !== null && (
              <div className="header-actions">
                <button className="header-action-btn stars" onClick={() => setShowTopUp(true)}>
                  <span className="header-action-icon">⭐</span>
                  <span className="header-action-label">{starBalance || 0}</span>
                </button>
                <button className="header-action-btn" onClick={() => { hapticFeedback('light'); setScreen(SCREENS.HISTORY); }}>
                  <span className="header-action-icon">🕐</span>
                  <span className="header-action-label">История</span>
                </button>
                <button className="header-action-btn referral" onClick={() => { hapticFeedback('light'); setScreen(SCREENS.REFERRAL); }}>
                  <span className="header-action-icon">🎁</span>
                  <span className="header-action-label">Рефералы</span>
                </button>
              </div>
            )}
          </header>

          <ModeSelector selectedMode={mode} onModeSelect={handleModeSelect} />

          {/* Stylize mode */}
          {mode === 'stylize' && (
            <>
              <PhotoUpload onPhotoSelected={handlePhotoSelected} />
              {photoFile && (
                <StyleSelector selectedStyle={selectedStyle} onStyleSelect={handleStyleSelect} />
              )}
              {photoFile && (
                <div className="creativity-control">
                  <label className="control-label">Креативность:</label>
                  <div className="slider-container">
                    <span>0%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={creativity}
                      onChange={(e) => setCreativity(Number(e.target.value))}
                      className="slider"
                    />
                    <span>100%</span>
                  </div>
                  <div className="creativity-value">{creativity}%</div>
                </div>
              )}
            </>
          )}

          {/* Multi-photo mode */}
          {mode === 'multi_photo' && (
            <>
              <MultiPhotoUpload
                photos={photos}
                onPhotosChanged={setPhotos}
                minPhotos={currentMode.minPhotos || 2}
                maxPhotos={currentMode.maxPhotos || 4}
              />
              <PromptInput
                value={promptText}
                onChange={setPromptText}
                placeholder="Опишите, как объединить фото... Например: объедини лица с фото 1 и 2 в стиле киберпанк"
              />
            </>
          )}

          {/* AI Magic mode (NanoBanana) */}
          {mode === 'ai_magic' && (
            <>
              <MultiPhotoUpload
                photos={photos}
                onPhotosChanged={setPhotos}
                minPhotos={currentMode.minPhotos || 2}
                maxPhotos={currentMode.maxPhotos || 8}
              />
              <PromptInput
                value={promptText}
                onChange={setPromptText}
                placeholder="Опишите желаемый стиль аватара (необязательно)... Например: professional portrait, business suit, studio lighting"
              />
            </>
          )}

          {/* Style transfer mode */}
          {mode === 'style_transfer' && (
            <>
              <StyleTransferUpload
                photos={photos}
                onPhotosChanged={setPhotos}
                promptText={promptText}
                onPromptChange={setPromptText}
                promptPlaceholder="Опишите желаемый стиль или результат..."
              />
              {photos.filter(Boolean).length >= 2 && (
                <ResolutionSelector
                  selectedResolution={styleResolution}
                  onResolutionSelect={setStyleResolution}
                  starCostFn={(res) => getStarCost(mode, { photoCount: photos.filter(Boolean).length, resolution: res })}
                />
              )}
            </>
          )}

          {/* Photo to video mode */}
          {mode === 'photo_to_video' && (
            <>
              <PhotoUpload onPhotoSelected={handlePhotoSelected} />
              {photoFile && (
                <>
                  <PromptInput
                    value={promptText}
                    onChange={setPromptText}
                    placeholder="Опишите желаемое движение... Например: человек поворачивает голову и улыбается"
                  />
                  <DurationSelector
                    selectedDuration={videoDuration}
                    onDurationSelect={setVideoDuration}
                    videoQuality={videoQuality}
                    onQualitySelect={setVideoQuality}
                    videoSound={videoSound}
                    onSoundToggle={setVideoSound}
                    videoAspect={videoAspect}
                    onAspectSelect={setVideoAspect}
                  />
                  <div className="last-frame-section">
                    <div className="last-frame-label">Конечный кадр <span className="optional-tag">необязательно</span></div>
                    <p className="last-frame-hint">Загрузите второе фото — AI создаст плавный переход от первого к последнему кадру</p>
                    {lastFramePreview ? (
                      <div className="last-frame-preview">
                        <img src={lastFramePreview} alt="Last frame" />
                        <button className="last-frame-remove" onClick={() => { setLastFrameFile(null); setLastFramePreview(null); }}>✕</button>
                      </div>
                    ) : (
                      <label className="last-frame-upload-btn">
                        + Добавить фото
                        <input type="file" accept="image/*" hidden onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setLastFrameFile(f);
                            const reader = new FileReader();
                            reader.onload = (ev) => setLastFramePreview(ev.target.result);
                            reader.readAsDataURL(f);
                          }
                        }} />
                      </label>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Gemini style mode */}
          {mode === 'gemini_style' && (
            <ReferencePhotoUpload
              mainPhoto={{ file: photoFile, preview: photoPreview }}
              referencePhoto={{ file: referenceFile, preview: referencePreview }}
              onMainPhotoSelected={handlePhotoSelected}
              onReferencePhotoSelected={handleReferenceSelected}
              promptText={promptText}
              onPromptChange={setPromptText}
              promptPlaceholder="Опишите желаемый стиль (необязательно)"
            />
          )}

          {/* Lip Sync mode */}
          {mode === 'lip_sync' && (
            <>
              <PhotoUpload onPhotoSelected={handlePhotoSelected} />
              {photoFile && (
                <>
                  <div className="audio-upload-section">
                    <div className="audio-upload-label">Аудио <span className="audio-limit-tag">до 15 сек</span></div>
                    <p className="audio-upload-hint">
                      Загрузите голосовое сообщение или аудиофайл (mp3, ogg, m4a) — фото будет говорить этим голосом
                    </p>

                    {audioFile ? (
                      <div className="audio-ready">
                        <div className="audio-file-info">
                          <span className="audio-file-icon">🎵</span>
                          <span className="audio-file-name">{audioName}</span>
                          <button className="audio-file-remove" onClick={clearAudio}>✕</button>
                        </div>
                        {audioPreviewUrl && (
                          <audio className="audio-player" src={audioPreviewUrl} controls />
                        )}
                      </div>
                    ) : (
                      <>
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept="*/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setAudioFile(f);
                              setAudioName(f.name);
                              setAudioPreviewUrl(URL.createObjectURL(f));
                              hapticFeedback('light');
                            }
                            e.target.value = '';
                          }}
                        />
                        <button
                          className="audio-upload-btn audio-upload-btn-full"
                          onClick={() => audioInputRef.current?.click()}
                        >
                          🎤 Загрузить аудио
                        </button>
                      </>
                    )}
                  </div>
                  <PromptInput
                    value={promptText}
                    onChange={setPromptText}
                    placeholder="Опишите выражение лица (необязательно)... Например: улыбается, смотрит в камеру"
                  />
                </>
              )}
            </>
          )}

          {/* Remove BG / Enhance modes */}
          {(mode === 'remove_bg' || mode === 'enhance') && (
            <PhotoUpload onPhotoSelected={handlePhotoSelected} />
          )}

          {/* Text to image mode */}
          {mode === 'text_to_image' && (
            <PromptInput
              value={promptText}
              onChange={setPromptText}
              placeholder="Опишите изображение... Например: космонавт верхом на лошади в стиле ренессанс"
            />
          )}

          {canGenerate && (
            <GenerateButton
              canGenerate={canGenerate}
              freeLeft={freeLeft}
              starBalance={starBalance}
              isLoading={isLoading}
              onClick={handleGenerate}
              onTopUp={() => setShowTopUp(true)}
              starCost={starCost}
              hasFreeGenerations={currentMode.hasFree}
              buttonLabel={buttonLabels[mode]}
            />
          )}
        </div>
      )}

      {showTopUp && (
        <div className="modal-overlay" onClick={() => setShowTopUp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Пополнить баланс</h3>
            <p className="modal-balance">Текущий баланс: <strong>{starBalance} ⭐</strong></p>
            <div className="topup-options">
              {[10, 25, 50, 100].map((amount) => (
                <button
                  key={amount}
                  className={`topup-option ${topUpAmount === amount ? 'selected' : ''}`}
                  onClick={() => setTopUpAmount(amount)}
                >
                  {amount} ⭐
                </button>
              ))}
            </div>
            <input
              type="number"
              className="topup-input"
              min="1"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(Math.max(1, Number(e.target.value)))}
              placeholder="Своё количество"
            />
            <button className="topup-confirm-btn" onClick={() => handleTopUp()}>
              Оплатить {topUpAmount} ⭐
            </button>
            <button className="modal-close-btn" onClick={() => setShowTopUp(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => { setShowPasswordModal(false); setAdminError(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Admin Access</h3>
            <input
              type="password"
              className="topup-input"
              value={adminPassword}
              onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && !adminLoading && handleAdminPasswordSubmit()}
              placeholder="Password"
              autoFocus
              disabled={adminLoading}
            />
            {adminError && (
              <div style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '8px' }}>{adminError}</div>
            )}
            <button className="topup-confirm-btn" onClick={handleAdminPasswordSubmit} disabled={adminLoading}>
              {adminLoading ? 'Проверка...' : 'Login'}
            </button>
            <button className="modal-close-btn" onClick={() => { setShowPasswordModal(false); setAdminError(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {screen === SCREENS.HISTORY && (
        <HistoryScreen
          userId={userId}
          initData={initData}
          onBack={() => setScreen(SCREENS.MAIN)}
        />
      )}

      {screen === SCREENS.REFERRAL && (
        <ReferralScreen
          userId={userId}
          initData={initData}
          onBack={() => setScreen(SCREENS.MAIN)}
          onInvite={handleShareInvite}
        />
      )}

      {showAdmin && <AdminPanel adminPassword={adminPassword} onClose={() => { setShowAdmin(false); setAdminPassword(''); }} />}
    </div>
  );
}
