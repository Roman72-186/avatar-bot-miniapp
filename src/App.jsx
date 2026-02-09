import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { generateAvatar, getUserStatus } from './utils/api';
import { STYLES } from './utils/styles';
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
  const { initTelegram, userId, username, initData, hapticFeedback, startParam } = useTelegram();

  const [screen, setScreen] = useState(SCREENS.MAIN);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [freeLeft, setFreeLeft] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creativity, setCreativity] = useState(50); // Default creativity level 50

  useEffect(() => {
    initTelegram();
    if (userId) {
      loadUserStatus();
    }
  }, [userId]);

  const loadUserStatus = async () => {
    try {
      const status = await getUserStatus(userId, initData);
      setFreeLeft(status.free_generations || 0);
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
        creativity
      );

      // Парсим ответ от n8n
      const data = Array.isArray(result) ? result[0] : result;
      const imageUrl = data?.image_url || data?.images?.[0]?.url;

      if (imageUrl) {
        setResultImage(imageUrl);
        setScreen(SCREENS.RESULT);
        hapticFeedback('heavy');
      } else {
        throw new Error('No image in response');
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

      {screen === SCREENS.LOADING && <LoadingScreen />}

      {screen === SCREENS.RESULT && resultImage && (
        <ResultScreen
          imageUrl={resultImage}
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
              <span className="title-accent">AI</span> Аватарки
            </h1>
            <p className="app-subtitle">Преврати своё фото в арт за секунды</p>
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
              isLoading={isLoading}
              onClick={handleGenerate}
            />
          )}
        </div>
      )}
    </div>
  );
}