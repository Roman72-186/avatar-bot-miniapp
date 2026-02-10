import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { generateAvatar, getUserStatus, createInvoice } from './utils/api';
import { STYLES, STARS_PER_GENERATION } from './utils/styles';
import PhotoUpload from './components/PhotoUpload';
import StyleSelector from './components/StyleSelector';
import GenerateButton from './components/GenerateButton';
import LoadingScreen from './components/LoadingScreen';
import ResultScreen from './components/ResultScreen';

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

  const handleStyleSelect = (styleId) => {
    setSelectedStyle(styleId);
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

  const handleGenerate = async () => {
    if (!photoFile || !selectedStyle) return;

    setIsLoading(true);
    setScreen(SCREENS.LOADING);
    setError(null);
    hapticFeedback('medium');

    try {
      // Отправляем файл — api.js загрузит на fal.ai и вызовет n8n
      const result = await generateAvatar(
        userId,
        photoFile,
        selectedStyle,
        initData,
        creativity,
        setDebugStep
      );

      // Парсим ответ от n8n
      const data = Array.isArray(result) ? result[0] : result;
      const imageUrl = data?.image_url || data?.images?.[0]?.url;

      // DEBUG: временный лог для диагностики
      setDebugStep(`Response: ${JSON.stringify(result).slice(0, 200)} | imageUrl: ${imageUrl}`);

      if (data?.error === 'insufficient_balance') {
        setScreen(SCREENS.MAIN);
        setShowTopUp(true);
        return;
      }

      if (imageUrl) {
        setResultImage(imageUrl);
        setScreen(SCREENS.RESULT);
        hapticFeedback('heavy');
        await loadUserStatus();
      } else {
        throw new Error(`No image in response. Keys: ${Object.keys(data || {}).join(',')}`);
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
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedStyle(null);
    setError(null);
  };

  const canGenerate = photoFile && selectedStyle;

  return (
    <div className="app">
      <div className="bg-gradient"></div>
      <div className="bg-noise"></div>

      {screen === SCREENS.LOADING && <LoadingScreen debugStep={debugStep} />}

      {screen === SCREENS.RESULT && resultImage && (
        <ResultScreen
          imageUrl={resultImage}
          style={selectedStyle}
          onNewGeneration={handleNewGeneration}
          debugInfo={debugStep}
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
              <span className="title-accent">AI</span> Аватарки
            </h1>
            <p className="app-subtitle">Преврати своё фото в арт за секунды</p>
            {freeLeft !== null && (
              <div className="header-balance">
                <span className="header-free">
                  {freeLeft > 0 ? `${freeLeft} бесплатных` : 'Бесплатные закончились'}
                </span>
                <span className="header-stars" onClick={() => setShowTopUp(true)}>
                  ⭐ {starBalance || 0}
                </span>
              </div>
            )}
          </header>

          <PhotoUpload onPhotoSelected={handlePhotoSelected} />

          {photoFile && (
            <StyleSelector
              selectedStyle={selectedStyle}
              onStyleSelect={handleStyleSelect}
            />
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

          {photoFile && selectedStyle && (
            <GenerateButton
              canGenerate={canGenerate}
              freeLeft={freeLeft}
              starBalance={starBalance}
              isLoading={isLoading}
              onClick={handleGenerate}
              onTopUp={() => setShowTopUp(true)}
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
    </div>
  );
}