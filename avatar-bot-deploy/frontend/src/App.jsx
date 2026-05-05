import { useState, useEffect, useRef } from 'react';
import { useTelegram } from './hooks/useTelegram';
import {
  generateAvatar,
  getUserStatus,
  createInvoice,
  generateMultiPhoto,
  generateStyleTransfer,
  generateVideo,
  generateLipSync,
  generateRemoveBg,
  generateEnhance,
  generateTextToImage,
  generatePhotosession,
  validateAdminPassword,
  getPaymentHistory,
  generateRealEstateRenovation,
  generateRealEstateEnhance,
  generateRealEstateVideo,
  generateRealEstateListingText,
  generateRealEstatePackage,
} from './utils/api';
import { MODES, DEFAULT_MODE, getStarCost } from './utils/modes';
import { DEFAULT_RENOVATION_STYLE, DEFAULT_ROOM_TYPE, EMPTY_OBJECT_INFO, REAL_ESTATE_DISCLAIMER } from './utils/realEstate';
import PhotoUpload from './components/PhotoUpload';
import StyleSelector from './components/StyleSelector';
import GenerateButton from './components/GenerateButton';
import LoadingScreen from './components/LoadingScreen';
import ResultScreen from './components/ResultScreen';
import SentScreen from './components/SentScreen';
import ModeSelector from './components/ModeSelector';
import CostIndicator from './components/CostIndicator';
import MultiPhotoUpload from './components/MultiPhotoUpload';
import PromptInput from './components/PromptInput';
import DurationSelector from './components/DurationSelector';
import ResolutionSelector from './components/ResolutionSelector';
import StyleTransferUpload from './components/StyleTransferUpload';
import ThemeSelector from './components/ThemeSelector';
import AdminPanel from './components/AdminPanel';
import HistoryScreen from './components/HistoryScreen';
import ReferralScreen from './components/ReferralScreen';
import RealEstateOptions from './components/RealEstateOptions';
import ObjectInfoForm from './components/ObjectInfoForm';
import { saveGeneration } from './utils/generationCache';

const STAR_PACKAGES = [
  { amount: 10, bonus: 0, total: 10, badge: null },
  { amount: 25, bonus: 5, total: 30, badge: null },
  { amount: 50, bonus: 15, total: 65, badge: 'Популярный' },
  { amount: 100, bonus: 50, total: 150, badge: 'Лучшая цена' },
  { amount: 155, bonus: 0, total: 155, badge: 'Видео' },
];

const SCREENS = {
  MAIN: 'main',
  LOADING: 'loading',
  RESULT: 'result',
  SENT: 'sent',
  ERROR: 'error',
  HISTORY: 'history',
  REFERRAL: 'referral',
};

function pickArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length > 0) || [];
}

function normalizeGenerationResult(data, resultType) {
  const payload = Array.isArray(data) ? data[0] : data;
  const metadata = payload?.metadata || {};
  const imageUrls = pickArray(
    payload?.image_urls,
    payload?.images?.map((img) => img?.url).filter(Boolean),
    metadata.image_urls
  );
  const videoUrl = payload?.video_url || payload?.video?.url || payload?.media_url || metadata.video_url || '';
  const listingText = payload?.listing_text || payload?.text || payload?.message || metadata.listing_text || '';
  const imageUrl = payload?.image_url || imageUrls[0] || payload?.images?.[0]?.url || metadata.image_url || '';

  if (resultType === 'text') {
    return { imageUrls: [], imageUrl: '', videoUrl: '', listingText, primaryUrl: '', resultType: 'text', metadata };
  }

  if (resultType === 'mixed') {
    return {
      imageUrls,
      imageUrl: imageUrl || imageUrls[0] || '',
      videoUrl,
      listingText,
      primaryUrl: imageUrls[0] || videoUrl || '',
      resultType: 'mixed',
      metadata,
    };
  }

  if (resultType === 'video') {
    return { imageUrls: [], imageUrl: '', videoUrl, listingText, primaryUrl: videoUrl, resultType: 'video', metadata };
  }

  return {
    imageUrls: imageUrl ? [imageUrl] : imageUrls,
    imageUrl,
    videoUrl: '',
    listingText,
    primaryUrl: imageUrl,
    resultType: 'image',
    metadata,
  };
}

export default function App() {
  const { tg, initTelegram, userId, username, initData, hapticFeedback, openInvoice, startParam } = useTelegram();

  const [screen, setScreen] = useState(SCREENS.MAIN);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [resultImages, setResultImages] = useState([]);
  const [resultText, setResultText] = useState('');
  // Инициализация из кеша для мгновенного отображения
  const [freeGens, setFreeGens] = useState(() => {
    try {
      const cached = localStorage.getItem('userStatus_freeGens');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [starBalance, setStarBalance] = useState(() => {
    try {
      return Number(localStorage.getItem('userStatus_starBalance')) || 0;
    } catch { return 0; }
  });
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(50);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creativity, setCreativity] = useState(50);

  // New mode state
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [photos, setPhotos] = useState(Array(10).fill(null));
  const [promptText, setPromptText] = useState('');
  const [roomType, setRoomType] = useState(DEFAULT_ROOM_TYPE);
  const [renovationStyle, setRenovationStyle] = useState(DEFAULT_RENOVATION_STYLE);
  const [objectInfo, setObjectInfo] = useState(EMPTY_OBJECT_INFO);
  const [videoDuration, setVideoDuration] = useState('5');
  const [videoQuality, setVideoQuality] = useState('std');
  const [videoSound, setVideoSound] = useState(false);
  const [videoAspect, setVideoAspect] = useState('9:16');
  const [lastFrameFile, setLastFrameFile] = useState(null);
  const [lastFramePreview, setLastFramePreview] = useState(null);
  const [photo2File, setPhoto2File] = useState(null);
  const [photo2Preview, setPhoto2Preview] = useState(null);
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
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [insufficientMsg, setInsufficientMsg] = useState(null);
  const [statusLoadFailed, setStatusLoadFailed] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'those_are_the_gifts_bot';
    const link = `https://t.me/${botUsername}?start=ref_${userId}`;
    const text = 'Попробуй AI-визуализацию недвижимости: загрузи фото квартиры и получи продающие изображения, видео и текст объявления.';
    try {
      if (tg) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
      } else if (navigator.share) {
        navigator.share({ title: 'AI-визуализация недвижимости', text, url: link });
      } else {
        navigator.clipboard?.writeText(`${text}\n${link}`);
      }
    } catch {
      navigator.clipboard?.writeText(`${text}\n${link}`);
    }
  };

  useEffect(() => {
    console.log('[App] init', { userId, username, hasInitData: !!initData, startParam });
    initTelegram();
    if (userId) {
      loadUserStatus();
    } else {
      console.warn('[App] No userId — Telegram WebApp context missing?');
    }
  }, [userId]);

  useEffect(() => {
    if (showTopUp && userId && initData) {
      setHistoryLoading(true);
      getPaymentHistory(userId, initData)
        .then((res) => {
          const data = Array.isArray(res) ? res[0] : res;
          setPaymentHistory(data?.payments || []);
        })
        .catch(() => setPaymentHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [showTopUp]);

  const loadUserStatus = async () => {
    try {
      const referredBy = startParam?.startsWith('ref_')
        ? startParam.replace('ref_', '')
        : null;
      const result = await getUserStatus(userId, initData, username, referredBy);
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
      setStatusLoadFailed(false);
      const newFreeGens = {
        free_stylize: status.free_stylize ?? 0,
        free_remove_bg: status.free_remove_bg ?? 0,
        free_enhance: status.free_enhance ?? 0,
        free_text_to_image: status.free_text_to_image ?? 0,
      };
      const newBalance = status.star_balance || 0;
      setFreeGens(newFreeGens);
      setStarBalance(newBalance);
      // Кешируем для мгновенной загрузки при следующем открытии
      try {
        localStorage.setItem('userStatus_freeGens', JSON.stringify(newFreeGens));
        localStorage.setItem('userStatus_starBalance', String(newBalance));
      } catch {}
    } catch (e) {
      console.error('Failed to load user status:', e);
      // Не подставляем фейковый баланс — если кеша нет, freeGens останется null
      // и UI покажет "..." вместо ложных бесплатных генераций
      setStatusLoadFailed(true);
    }
  };

  const handlePhotoSelected = (file, preview) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
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
    setPhotos(Array(10).fill(null));
    setPromptText('');
    setRoomType(DEFAULT_ROOM_TYPE);
    setRenovationStyle(DEFAULT_RENOVATION_STYLE);
    setObjectInfo(EMPTY_OBJECT_INFO);
    setVideoDuration('5');
    setVideoQuality('std');
    setVideoSound(false);
    setVideoAspect('9:16');
    setLastFrameFile(null);
    setLastFramePreview(null);
    setPhoto2File(null);
    setPhoto2Preview(null);
    clearAudio();
    setStyleResolution('2K');
    setSelectedTheme(null);
    setInsufficientMsg(null);
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
        setInsufficientMsg(null);
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
    case 'real_estate_renovation':
      canGenerate = !!(photoFile && roomType && renovationStyle);
      break;
    case 'real_estate_enhance':
      canGenerate = !!photoFile;
      break;
    case 'real_estate_video':
      canGenerate = photos.filter(Boolean).length >= (currentMode.minPhotos || 3);
      break;
    case 'real_estate_listing_text':
      canGenerate = Boolean(
        promptText.trim()
        || objectInfo.city
        || objectInfo.district
        || objectInfo.rooms
        || objectInfo.area
        || objectInfo.highlights
      );
      break;
    case 'real_estate_full_package':
      canGenerate = photos.filter(Boolean).length >= (currentMode.minPhotos || 3) && !!renovationStyle;
      break;
    case 'stylize':
      canGenerate = !!(photoFile && selectedStyle);
      break;
    case 'multi_photo':
      canGenerate = photos.filter(Boolean).length >= (currentMode.minPhotos || 2) && promptText.trim().length > 0;
      break;
    case 'style_transfer':
      canGenerate = photos.filter(Boolean).length >= (currentMode.minPhotos || 1) && promptText.trim().length > 0;
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
    case 'photosession':
      canGenerate = !!(photoFile && selectedTheme);
      break;
  }

  const handleGenerate = async () => {
    console.log('[handleGenerate] clicked!', {
      mode, canGenerate, userId, hasInitData: !!initData,
      freeLeft, starBalance, starCost,
    });

    if (!canGenerate) {
      console.warn('[handleGenerate] canGenerate=false, aborting');
      return;
    }

    const hasFree = currentMode.hasFree && freeLeft > 0;
    if (!hasFree && starBalance < starCost) {
      console.warn('[handleGenerate] insufficient balance, showing message + top-up');
      setInsufficientMsg(`На балансе недостаточно кредитов. Нужно ${starCost}, у вас ${starBalance}. Пополните баланс через Telegram Stars.`);
      hapticFeedback('medium');
      setTimeout(() => setShowTopUp(true), 1200);
      return;
    }

    console.log('[handleGenerate] starting generation...', { hasFree, mode });
    setIsLoading(true);
    setScreen(SCREENS.LOADING);
    setResultType(currentMode.resultType);
    setResultImage(null);
    setResultImages([]);
    setResultVideo(null);
    setResultText('');
    setError(null);
    hapticFeedback('medium');

    try {
      let result;

      switch (mode) {
        case 'real_estate_renovation':
          result = await generateRealEstateRenovation({
            userId,
            username,
            file: photoFile,
            roomType,
            renovationStyle,
            initData,
            cost: starCost,
            disclaimer: REAL_ESTATE_DISCLAIMER,
          });
          break;
        case 'real_estate_enhance':
          result = await generateRealEstateEnhance({
            userId,
            username,
            file: photoFile,
            roomType,
            initData,
            cost: starCost,
            disclaimer: REAL_ESTATE_DISCLAIMER,
          });
          break;
        case 'real_estate_video':
          result = await generateRealEstateVideo({
            userId,
            username,
            files: photos.filter(Boolean).map((p) => p.file),
            roomType,
            renovationStyle,
            initData,
            cost: starCost,
            disclaimer: REAL_ESTATE_DISCLAIMER,
          });
          break;
        case 'real_estate_listing_text':
          result = await generateRealEstateListingText({
            userId,
            username,
            objectInfo,
            prompt: promptText,
            initData,
            cost: starCost,
            disclaimer: REAL_ESTATE_DISCLAIMER,
          });
          break;
        case 'real_estate_full_package':
          result = await generateRealEstatePackage({
            userId,
            username,
            files: photos.filter(Boolean).map((p) => p.file),
            roomType,
            renovationStyle,
            objectInfo,
            prompt: promptText,
            initData,
            cost: starCost,
            disclaimer: REAL_ESTATE_DISCLAIMER,
          });
          break;
        case 'stylize':
          result = await generateAvatar(userId, photoFile, selectedStyle, initData, creativity);
          break;
        case 'multi_photo':
          result = await generateMultiPhoto(
            userId,
            photos.filter(Boolean).map((p) => p.file),
            promptText,
            initData
          );
          break;
        case 'style_transfer':
          result = await generateStyleTransfer(
            userId,
            photos.filter(Boolean).map((p) => p.file),
            promptText,
            styleResolution,
            initData
          );
          break;
        case 'photo_to_video':
          result = await generateVideo(userId, photoFile, promptText, videoDuration, {
            quality: videoQuality, sound: videoSound, aspect: videoAspect, lastFrameFile,
          }, initData);
          break;
        case 'lip_sync':
          result = await generateLipSync(userId, photoFile, audioFile, promptText, initData);
          break;
        case 'remove_bg':
          result = await generateRemoveBg(userId, photoFile, initData);
          break;
        case 'enhance':
          result = await generateEnhance(userId, photoFile, promptText, initData);
          break;
        case 'text_to_image':
          result = await generateTextToImage(userId, promptText, initData);
          break;
        case 'photosession':
          result = await generatePhotosession(userId, photoFile, photo2File, selectedTheme, initData);
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
      if (data?.sent && mode !== 'real_estate_full_package') {
        setScreen(SCREENS.SENT);
        hapticFeedback('heavy');
        await loadUserStatus();
        return;
      }

      // Fallback: response contains URLs/text for the result screen
      const normalized = normalizeGenerationResult(data, currentMode.resultType);
      const hasResult = Boolean(
        normalized.primaryUrl
        || normalized.imageUrls.length
        || normalized.videoUrl
        || normalized.listingText
      );

      if (!hasResult) {
        throw new Error(`No result in response. Keys: ${Object.keys(data || {}).join(',')}`);
      }

      const metadata = {
        ...normalized.metadata,
        room_type: roomType,
        style: renovationStyle,
        object_info: objectInfo,
        image_urls: normalized.imageUrls,
        video_url: normalized.videoUrl,
        listing_text: normalized.listingText,
        disclaimer: REAL_ESTATE_DISCLAIMER,
      };

      saveGeneration({
        mode,
        result_type: normalized.resultType,
        result_url: normalized.primaryUrl,
        image_urls: normalized.imageUrls,
        video_url: normalized.videoUrl,
        listing_text: normalized.listingText,
        prompt: promptText,
        metadata,
      });

      setResultImages(normalized.imageUrls);
      setResultImage(normalized.imageUrl || normalized.imageUrls[0] || null);
      setResultVideo(normalized.videoUrl || null);
      setResultText(normalized.listingText);
      setScreen(SCREENS.RESULT);
      hapticFeedback('heavy');
      await loadUserStatus();
    } catch (e) {
      console.error('[handleGenerate] FAILED:', e.message, e);
      const msg = e.message || '';
      let userMsg;
      if (msg.includes('TIMEOUT') || msg.includes('AbortError') || msg.includes('60 секунд')) {
        userMsg = 'Сервер не ответил вовремя. Попробуйте ещё раз через минуту.';
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        userMsg = 'Нет подключения к серверу. Проверьте интернет и попробуйте снова.';
      } else if (msg.includes('insufficient_balance') || msg.includes('No balance')) {
        userMsg = 'Недостаточно кредитов. Пополните баланс.';
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
    setResultImages([]);
    setResultVideo(null);
    setResultText('');
    setResultType('image');
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedStyle(null);
    setPhotos(Array(10).fill(null));
    setPromptText('');
    setRoomType(DEFAULT_ROOM_TYPE);
    setRenovationStyle(DEFAULT_RENOVATION_STYLE);
    setObjectInfo(EMPTY_OBJECT_INFO);
    setVideoDuration('5');
    setVideoQuality('std');
    setVideoSound(false);
    setVideoAspect('9:16');
    setLastFrameFile(null);
    setLastFramePreview(null);
    setPhoto2File(null);
    setPhoto2Preview(null);
    clearAudio();
    setStyleResolution('2K');
    setSelectedTheme(null);
    setError(null);
    // Keep mode selection
  };

  // Примеры промптов — пока нет реальной страницы, кнопка скрыта (examplesUrl не передаётся)
  // const PROMPT_EXAMPLES_URL = null;

  // Button label per mode
  const buttonLabels = {
    real_estate_renovation: 'Создать AI-ремонт',
    real_estate_enhance: 'Улучшить фото объекта',
    real_estate_video: 'Создать видео объекта',
    real_estate_listing_text: 'Сгенерировать текст',
    real_estate_full_package: 'Создать полный пакет',
    stylize: '\u2728 Создать аватарку',
    multi_photo: '\u2728 Сгенерировать',
    style_transfer: '\u2728 Перенести стиль',
    photo_to_video: '\ud83c\udfac Создать видео',
    lip_sync: '\ud83d\udde3\ufe0f Создать Lip Sync',
    remove_bg: '\u2702\ufe0f Убрать фон',
    enhance: '\u2728 Улучшить',
    text_to_image: '\ud83d\udcac Создать',
    photosession: '\ud83d\udcf8 Запустить фотосессию',
  };

  // Если нет userId — приложение открыто вне Telegram
  if (!userId) {
    return (
      <div className="app">
        <div className="bg-gradient"></div>
        <div className="bg-noise"></div>
        <div className="error-screen">
          <div className="error-icon">📱</div>
          <h2>Откройте через Telegram</h2>
          <p>Это приложение работает только внутри Telegram. Откройте бота и нажмите кнопку меню.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="bg-gradient"></div>
      <div className="bg-noise"></div>

      {screen === SCREENS.LOADING && <LoadingScreen mode={mode} />}

      {screen === SCREENS.SENT && (
        <SentScreen onBack={handleNewGeneration} />
      )}

      {screen === SCREENS.RESULT && (resultImage || resultVideo || resultText || resultImages.length > 0) && (
        <ResultScreen
          imageUrl={resultImage}
          imageUrls={resultImages}
          videoUrl={resultVideo}
          listingText={resultText}
          resultType={resultType}
          onNewGeneration={handleNewGeneration}
          userId={userId}
          starBalance={starBalance}
          onTopUp={() => setShowTopUp(true)}
          disclaimer={REAL_ESTATE_DISCLAIMER}
        />
      )}

      {screen === SCREENS.ERROR && (
        <div className="error-screen">
          <div className="error-icon">😔</div>
          <h2>Ошибка</h2>
          <p>{error}</p>
          {/* errorDetails скрыт от пользователя — логируется только в console */}
          <button className="action-btn primary" onClick={() => { setScreen(SCREENS.MAIN); setError(null); setErrorDetails(null); }}>
            Попробовать снова
          </button>
          <button className="new-generation-btn" style={{ marginTop: 10, maxWidth: 280 }} onClick={handleNewGeneration}>
            Начать заново
          </button>
        </div>
      )}

      {screen === SCREENS.MAIN && (
        <div className="main-screen">
          <header className="app-header">
            <h1 className="app-title">
              <span className="title-accent" onClick={handleAiClick}>AI</span> визуализация недвижимости
            </h1>
            <p className="app-subtitle">Загрузите фото квартиры и получите продающие изображения, видео и текст объявления.</p>
            <div className="header-actions">
              <button className="header-action-btn stars" onClick={() => setShowTopUp(true)}>
                <span className="header-action-icon">₽</span>
                <span className="header-action-label">{freeGens !== null ? `${starBalance || 0} кредитов` : '...'}</span>
              </button>
<button className="header-action-btn referral" onClick={() => { hapticFeedback('light'); setScreen(SCREENS.REFERRAL); }}>
                <span className="header-action-icon">🎁</span>
                <span className="header-action-label">Рефералы</span>
              </button>
            </div>
          </header>

          <ModeSelector selectedMode={mode} onModeSelect={handleModeSelect} freeGens={freeGens} />

          <CostIndicator
            starCost={starCost}
            freeLeft={freeLeft}
            hasFreeGenerations={currentMode.hasFree}
            starBalance={starBalance}
            modeId={mode}
          />

          {statusLoadFailed && !freeGens && (
            <div className="insufficient-balance-msg" onClick={() => { setStatusLoadFailed(false); loadUserStatus(); }} style={{ cursor: 'pointer' }}>
              <span className="insufficient-icon">⚠️</span>
              <span>Не удалось загрузить данные. Нажмите, чтобы повторить.</span>
            </div>
          )}

          {insufficientMsg && (
            <div className="insufficient-balance-msg">
              <span className="insufficient-icon">⚠️</span>
              <span>{insufficientMsg}</span>
            </div>
          )}

          {mode === 'real_estate_renovation' && (
            <>
              <PhotoUpload
                onPhotoSelected={handlePhotoSelected}
                uploadTitle="Загрузите фото комнаты"
                uploadHint="AI сохранит планировку и создаст визуализацию возможного ремонта"
              />
              {photoFile && (
                <RealEstateOptions
                  roomType={roomType}
                  onRoomTypeChange={(value) => { setRoomType(value); hapticFeedback('light'); }}
                  renovationStyle={renovationStyle}
                  onRenovationStyleChange={(value) => { setRenovationStyle(value); hapticFeedback('light'); }}
                />
              )}
              <div className="real-estate-disclaimer">{REAL_ESTATE_DISCLAIMER}</div>
            </>
          )}

          {mode === 'real_estate_enhance' && (
            <>
              <PhotoUpload
                onPhotoSelected={handlePhotoSelected}
                uploadTitle="Загрузите фото объекта"
                uploadHint="AI улучшит свет, резкость и цвет, не меняя ремонт и мебель"
              />
              {photoFile && (
                <RealEstateOptions
                  roomType={roomType}
                  onRoomTypeChange={(value) => { setRoomType(value); hapticFeedback('light'); }}
                  renovationStyle={renovationStyle}
                  onRenovationStyleChange={setRenovationStyle}
                  showStyle={false}
                />
              )}
              <div className="real-estate-disclaimer">{REAL_ESTATE_DISCLAIMER}</div>
            </>
          )}

          {mode === 'real_estate_video' && (
            <>
              <MultiPhotoUpload
                photos={photos}
                onPhotosChanged={setPhotos}
                minPhotos={currentMode.minPhotos || 3}
                maxPhotos={currentMode.maxPhotos || 10}
                label={`Загружено ${photos.filter(Boolean).length} из ${currentMode.maxPhotos || 10}`}
                hint="Загрузите 3-10 фотографий квартиры: кухня, гостиная, спальня, санузел, фасад или подъезд."
              />
              <RealEstateOptions
                roomType={roomType}
                onRoomTypeChange={(value) => { setRoomType(value); hapticFeedback('light'); }}
                renovationStyle={renovationStyle}
                onRenovationStyleChange={(value) => { setRenovationStyle(value); hapticFeedback('light'); }}
              />
              <div className="real-estate-disclaimer">{REAL_ESTATE_DISCLAIMER}</div>
            </>
          )}

          {mode === 'real_estate_listing_text' && (
            <>
              <ObjectInfoForm value={objectInfo} onChange={setObjectInfo} />
              <PromptInput
                value={promptText}
                onChange={setPromptText}
                placeholder="Дополните важные детали: ремонт, окна, инфраструктура, кому подойдёт квартира..."
                maxLength={1000}
              />
              <div className="real-estate-disclaimer">{REAL_ESTATE_DISCLAIMER}</div>
            </>
          )}

          {mode === 'real_estate_full_package' && (
            <>
              <MultiPhotoUpload
                photos={photos}
                onPhotosChanged={setPhotos}
                minPhotos={currentMode.minPhotos || 3}
                maxPhotos={currentMode.maxPhotos || 10}
                label={`Загружено ${photos.filter(Boolean).length} из ${currentMode.maxPhotos || 10}`}
                hint="Для полного пакета загрузите 3-10 фото объекта. Лучше: кухня, гостиная, спальня, санузел, вид из окна или входная группа."
              />
              <RealEstateOptions
                roomType={roomType}
                onRoomTypeChange={(value) => { setRoomType(value); hapticFeedback('light'); }}
                renovationStyle={renovationStyle}
                onRenovationStyleChange={(value) => { setRenovationStyle(value); hapticFeedback('light'); }}
              />
              <ObjectInfoForm value={objectInfo} onChange={setObjectInfo} />
              <PromptInput
                value={promptText}
                onChange={setPromptText}
                placeholder="Особые пожелания к ролику или тексту объявления..."
                maxLength={700}
              />
              <div className="real-estate-disclaimer">{REAL_ESTATE_DISCLAIMER}</div>
            </>
          )}

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
              <PhotoUpload
                onPhotoSelected={handlePhotoSelected}
                uploadHint="Загрузите фото — AI оживит его в видео с движением"
              />
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

          {/* Lip Sync mode */}
          {mode === 'lip_sync' && (
            <>
              <PhotoUpload
                onPhotoSelected={handlePhotoSelected}
                uploadHint="Загрузите портретное фото — AI заставит его говорить вашим голосом"
              />
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

          {/* Remove BG mode */}
          {mode === 'remove_bg' && (
            <PhotoUpload
              onPhotoSelected={handlePhotoSelected}
              uploadTitle="Загрузи фото"
              uploadHint="Загрузите любое фото — AI удалит фон и оставит только объект"
            />
          )}

          {/* Enhance mode */}
          {mode === 'enhance' && (
            <>
              <PhotoUpload
                onPhotoSelected={handlePhotoSelected}
                uploadTitle="Загрузи фото для улучшения"
                uploadHint="AI увеличит разрешение и улучшит качество любого фото"
              />
              {photoFile && (
                <PromptInput
                  value={promptText}
                  onChange={setPromptText}
                  placeholder="Что улучшить? Например: убери шум, повысь резкость, сделай ярче..."
                  maxLength={500}
                />
              )}
            </>
          )}

          {/* Text to image mode */}
          {mode === 'text_to_image' && (
            <PromptInput
              value={promptText}
              onChange={setPromptText}
              placeholder="Опишите изображение... Например: космонавт верхом на лошади в стиле ренессанс"
              maxLength={1000}
            />
          )}

          {/* Photosession mode */}
          {mode === 'photosession' && (
            <>
              <PhotoUpload
                onPhotoSelected={handlePhotoSelected}
                uploadHint="Загрузите чёткое фото лица — AI сохранит вашу внешность на всех 10 фотографиях"
              />
              {photoFile && (
                <>
                  <div className="last-frame-section">
                    <div className="last-frame-label">Второе фото <span className="optional-tag">необязательно</span></div>
                    <p className="last-frame-hint">Добавьте фото с другого ракурса — AI лучше сохранит внешность</p>
                    {photo2Preview ? (
                      <div className="last-frame-preview">
                        <img src={photo2Preview} alt="Photo 2" />
                        <button className="last-frame-remove" onClick={() => { setPhoto2File(null); setPhoto2Preview(null); }}>✕</button>
                      </div>
                    ) : (
                      <label className="last-frame-upload-btn">
                        + Добавить фото
                        <input type="file" accept="image/*" hidden onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setPhoto2File(f);
                            const reader = new FileReader();
                            reader.onload = (ev) => setPhoto2Preview(ev.target.result);
                            reader.readAsDataURL(f);
                            hapticFeedback('light');
                          }
                        }} />
                      </label>
                    )}
                  </div>
                  <ThemeSelector
                    selectedTheme={selectedTheme}
                    onThemeSelect={(theme) => { setSelectedTheme(theme); hapticFeedback('light'); }}
                  />
                </>
              )}
            </>
          )}

          {canGenerate && (
            <GenerateButton
              canGenerate={canGenerate}
              isLoading={isLoading}
              onClick={handleGenerate}
              buttonLabel={buttonLabels[mode]}
            />
          )}
        </div>
      )}

      {showTopUp && (
        <div className="modal-overlay" onClick={() => setShowTopUp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Пополнить кредиты</h3>
            <p className="modal-balance">Текущий баланс: <strong>{starBalance} кредитов</strong></p>
            <p className="topup-note">Сейчас рабочий способ пополнения — Telegram Stars. Баланс внутри приложения отображается как кредиты.</p>
            <div className="topup-packages">
              {STAR_PACKAGES.map((pkg) => (
                <button
                  key={pkg.amount}
                  className={`topup-package ${topUpAmount === pkg.amount ? 'selected' : ''} ${pkg.badge ? 'has-badge' : ''}`}
                  onClick={() => setTopUpAmount(pkg.amount)}
                >
                  {pkg.badge && <span className="package-badge">{pkg.badge}</span>}
                  <span className="package-amount">{pkg.amount} Stars</span>
                  <span className="package-total">= {pkg.total} кредитов</span>
                  {pkg.bonus > 0 && <span className="package-bonus">+{pkg.bonus} кредитов бонусом</span>}
                </button>
              ))}
            </div>
            <button
              className="topup-confirm-btn"
              onClick={() => handleTopUp()}
            >
              Оплатить {topUpAmount} Stars
            </button>
            <button className="modal-close-btn" onClick={() => setShowTopUp(false)}>
              Отмена
            </button>
            <div className="payment-history">
              <div className="payment-history-title">История пополнений</div>
              {historyLoading ? (
                <div className="payment-history-loading">Загрузка...</div>
              ) : paymentHistory.length === 0 ? (
                <div className="payment-history-empty">Пополнений пока нет</div>
              ) : (
                <div className="payment-history-list">
                  {paymentHistory.map((p) => (
                    <div key={p.id} className="payment-history-item">
                      <span className="payment-history-date">
                        {new Date(p.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <span className="payment-history-amount">{p.stars} Stars</span>
                      {p.bonus > 0 && <span className="payment-history-bonus">+{p.bonus}</span>}
                      <span className="payment-history-total">= {p.total_credited || p.credits}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
