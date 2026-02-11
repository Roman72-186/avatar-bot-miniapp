import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { generateAvatar, getUserStatus, createInvoice, generateMultiPhoto, generateStyleTransfer, generateVideo, generateFaceSwap, generateRemoveBg, generateEnhance, generateTextToImage } from './utils/api';
import { STYLES, STARS_PER_GENERATION } from './utils/styles';
import { MODES, DEFAULT_MODE, getStarCost } from './utils/modes';
import PhotoUpload from './components/PhotoUpload';
import StyleSelector from './components/StyleSelector';
import GenerateButton from './components/GenerateButton';
import LoadingScreen from './components/LoadingScreen';
import ResultScreen from './components/ResultScreen';
import ModeSelector from './components/ModeSelector';
import MultiPhotoUpload from './components/MultiPhotoUpload';
import ReferencePhotoUpload from './components/ReferencePhotoUpload';
import PromptInput from './components/PromptInput';
import DurationSelector from './components/DurationSelector';
import AdminPanel from './components/AdminPanel';

const SCREENS = {
  MAIN: 'main',
  LOADING: 'loading',
  RESULT: 'result',
  ERROR: 'error',
};

export default function App() {
  const { initTelegram, userId, username, initData, hapticFeedback, openInvoice, startParam } = useTelegram();

  const [screen, setScreen] = useState(SCREENS.MAIN);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [freeLeft, setFreeLeft] = useState(null);
  const [starBalance, setStarBalance] = useState(0);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creativity, setCreativity] = useState(50);
  const [debugStep, setDebugStep] = useState(null);

  // New mode state
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [photos, setPhotos] = useState([null, null, null, null]);
  const [referenceFile, setReferenceFile] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [videoDuration, setVideoDuration] = useState('6');
  const [resultType, setResultType] = useState('image');
  const [resultVideo, setResultVideo] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [aiClickCount, setAiClickCount] = useState(0);
  const [aiClickTimer, setAiClickTimer] = useState(null);

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

  const handleAdminPasswordSubmit = () => {
    if (adminPassword === '123hors456') {
      setShowPasswordModal(false);
      setShowAdmin(true);
      hapticFeedback('heavy');
    } else {
      hapticFeedback('error');
      setAdminPassword('');
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
      setFreeLeft(status.free_left ?? status.free_generations ?? 0);
      setStarBalance(status.star_balance || 0);
    } catch (e) {
      console.error('Failed to load user status:', e);
      setFreeLeft(3);
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
    setVideoDuration('6');
    hapticFeedback('light');
  };

  const handleTopUp = async (amount) => {
    try {
      const { invoice_link } = await createInvoice(userId, amount || topUpAmount);
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
  const starCost = getStarCost(mode, { duration: videoDuration });
  let canGenerate = false;
  switch (mode) {
    case 'stylize':
      canGenerate = !!(photoFile && selectedStyle);
      break;
    case 'multi_photo':
      canGenerate = photos.filter(Boolean).length >= (currentMode.minPhotos || 2) && promptText.trim().length > 0;
      break;
    case 'style_transfer':
      canGenerate = !!(photoFile && referenceFile);
      break;
    case 'photo_to_video':
      canGenerate = !!(photoFile && promptText.trim().length > 0);
      break;
    case 'face_swap':
      canGenerate = !!(photoFile && referenceFile);
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
        case 'style_transfer':
          result = await generateStyleTransfer(userId, photoFile, referenceFile, initData, setDebugStep);
          break;
        case 'photo_to_video':
          result = await generateVideo(userId, photoFile, promptText, videoDuration, initData, setDebugStep);
          break;
        case 'face_swap':
          result = await generateFaceSwap(userId, photoFile, referenceFile, initData, setDebugStep);
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

      if (currentMode.resultType === 'video') {
        const videoUrl = data?.video_url || data?.video?.url;
        if (videoUrl) {
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
      setError(e.message || 'Что-то пошло не так. Попробуй ещё раз.');
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
    setVideoDuration('6');
    setError(null);
    // Keep mode selection
  };

  // Button label per mode
  const buttonLabels = {
    stylize: '\u2728 Создать аватарку',
    multi_photo: '\u2728 Сгенерировать',
    style_transfer: '\u2728 Перенести стиль',
    photo_to_video: '\ud83c\udfac Создать видео',
    face_swap: '\ud83d\udd04 Заменить лицо',
    remove_bg: '\u2702\ufe0f Убрать фон',
    enhance: '\u2728 Улучшить',
    text_to_image: '\ud83d\udcac Создать',
  };

  return (
    <div className="app">
      <div className="bg-gradient"></div>
      <div className="bg-noise"></div>

      {screen === SCREENS.LOADING && <LoadingScreen mode={mode} />}

      {screen === SCREENS.RESULT && (resultImage || resultVideo) && (
        <ResultScreen
          imageUrl={resultImage}
          videoUrl={resultVideo}
          resultType={resultType}
          style={selectedStyle}
          onNewGeneration={handleNewGeneration}
        />
      )}

      {screen === SCREENS.ERROR && (
        <div className="error-screen">
          <div className="error-icon">😔</div>
          <h2>Ошибка</h2>
          <p>{error}</p>
          <button className="action-btn primary" onClick={handleNewGeneration}>
            Попробовать снова
          </button>
        </div>
      )}

      {screen === SCREENS.MAIN && (
        <div className="main-screen">
          <header className="app-header">
            <h1 className="app-title">
              <span className="title-accent" onClick={handleAiClick}>AI</span> Avatar Studio
            </h1>
            <p className="app-subtitle">{currentMode.description}</p>
            {freeLeft !== null && (
              <div className="header-balance">
                {currentMode.hasFree && (
                  <span className="header-free">
                    {freeLeft > 0 ? `${freeLeft} бесплатных` : 'Бесплатные закончились'}
                  </span>
                )}
                {!currentMode.hasFree && (
                  <span className="header-free">
                    {starCost} ⭐ за генерацию
                  </span>
                )}
                <span className="header-stars" onClick={() => setShowTopUp(true)}>
                  ⭐ {starBalance || 0}
                </span>
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

          {/* Style transfer mode */}
          {mode === 'style_transfer' && (
            <ReferencePhotoUpload
              mainPhoto={{ file: photoFile, preview: photoPreview }}
              referencePhoto={{ file: referenceFile, preview: referencePreview }}
              onMainPhotoSelected={handlePhotoSelected}
              onReferencePhotoSelected={handleReferenceSelected}
            />
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
                  />
                </>
              )}
            </>
          )}

          {/* Face swap mode */}
          {mode === 'face_swap' && (
            <ReferencePhotoUpload
              mainPhoto={{ file: photoFile, preview: photoPreview }}
              referencePhoto={{ file: referenceFile, preview: referencePreview }}
              onMainPhotoSelected={handlePhotoSelected}
              onReferencePhotoSelected={handleReferenceSelected}
              labels={{ main: 'Ваше лицо', reference: 'Целевое фото' }}
            />
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
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Admin Access</h3>
            <input
              type="password"
              className="topup-input"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminPasswordSubmit()}
              placeholder="Password"
              autoFocus
            />
            <button className="topup-confirm-btn" onClick={handleAdminPasswordSubmit}>
              Login
            </button>
            <button className="modal-close-btn" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
