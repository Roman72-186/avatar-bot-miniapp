import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { uploadPhoto, generateAvatar, getUserStatus } from './utils/api';
import { STYLES } from './utils/styles';
import PhotoUpload from './components/PhotoUpload';
import StyleSelector from './components/StyleSelector';
import GenerateButton from './components/GenerateButton';
import LoadingScreen from './components/LoadingScreen';
import ResultScreen from './components/ResultScreen';

// Экраны приложения
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

  // Инициализация
  useEffect(() => {
    initTelegram();
    if (userId) {
      loadUserStatus();
    }
  }, [userId]);

  // Загрузка статуса пользователя
  const loadUserStatus = async () => {
    try {
      const status = await getUserStatus(userId, initData);
      setFreeLeft(status.free_generations || 0);
    } catch (e) {
      console.error('Failed to load user status:', e);
      // По умолчанию даём 3 бесплатные генерации
      setFreeLeft(3);
    }
  };

  // Обработка выбора фото
  const handlePhotoSelected = (file, preview) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
    hapticFeedback('light');
  };

  // Обработка выбора стиля
  const handleStyleSelect = (styleId) => {
    setSelectedStyle(styleId);
    hapticFeedback('light');
  };

  // Генерация аватарки
  const handleGenerate = async () => {
    if (!photoFile || !selectedStyle) return;

    setIsLoading(true);
    setScreen(SCREENS.LOADING);
    setError(null);
    hapticFeedback('medium');

    try {
      // 1. Загружаем фото
      const uploadResult = await uploadPhoto(photoFile, userId);

      // 2. Запрашиваем генерацию
      const result = await generateAvatar(
        userId,
        uploadResult.photo_url,
        selectedStyle,
        initData
      );

      if (result.image_url) {
        setResultImage(result.image_url);
        setScreen(SCREENS.RESULT);
        hapticFeedback('success');

        // Обновляем лимиты
        if (result.free_left !== undefined) {
          setFreeLeft(result.free_left);
        }
      } else {
        throw new Error('No image in response');
      }
    } catch (e) {
      console.error('Generation failed:', e);
      setError(e.message || 'Что-то пошло не так. Попробуй ещё раз.');
      setScreen(SCREENS.ERROR);
      hapticFeedback('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Новая генерация
  const handleNewGeneration = () => {
    setScreen(SCREENS.MAIN);
    setResultImage(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSelectedStyle(null);
    setError(null);
  };

  const canGenerate = photoFile && selectedStyle;
  const currentStyle = STYLES.find((s) => s.id === selectedStyle);

  return (
    <div className="app">
      {/* Фоновые элементы */}
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
