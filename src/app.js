// ======================
// Poker Trainer PWA - App Principal
// ======================

const { useState, useEffect, useRef } = React;
const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell } = Recharts;

// Configurações do Local Storage
const STORAGE_KEYS = {
  GAME_DATA: 'poker_trainer_game_data',
  SETTINGS: 'poker_trainer_settings',
  RANKINGS: 'poker_trainer_rankings',
  ACHIEVEMENTS: 'poker_trainer_achievements',
  STATISTICS: 'poker_trainer_statistics'
};

// Hook para localStorage com fallback
const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Erro ao ler localStorage para ${key}:`, error);
      return defaultValue;
    }
  });

  const setStoredValue = (newValue) => {
    try {
      setValue(newValue);
      localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      console.warn(`Erro ao salvar localStorage para ${key}:`, error);
    }
  };

  return [value, setStoredValue];
};

// Componente Principal
const PokerTrainer = () => {
  // Estados persistentes com localStorage
  const [gameData, setGameData] = useLocalStorage(STORAGE_KEYS.GAME_DATA, {
    score: { correct: 0, total: 0, folded: 0 },
    handsPlayed: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalGamesPlayed: 0
  });

  const [rankings, setRankings] = useLocalStorage(STORAGE_KEYS.RANKINGS, [
    { name: "PokerPro", score: 85.2, hands: 50, date: new Date().toISOString() },
    { name: "CardShark", score: 82.7, hands: 50, date: new Date().toISOString() },
    { name: "BluffMaster", score: 79.3, hands: 50, date: new Date().toISOString() },
    { name: "AceHunter", score: 76.8, hands: 50, date: new Date().toISOString() },
    { name: "RiverRat", score: 74.5, hands: 50, date: new Date().toISOString() }
  ]);

  const [achievements, setAchievements] = useLocalStorage(STORAGE_KEYS.ACHIEVEMENTS, []);
  
  const [statistics, setStatistics] = useLocalStorage(STORAGE_KEYS.STATISTICS, {
    handHistory: [],
    evolutionData: [],
    phaseStats: {
      preflop: { correct: 0, total: 0 },
      flop: { correct: 0, total: 0 },
      turn: { correct: 0, total: 0 },
      river: { correct: 0, total: 0 }
    },
    handTypeStats: {},
    errorTrends: { optimistic: 0, pessimistic: 0, accurate: 0 }
  });

  const [settings, setSettings] = useLocalStorage(STORAGE_KEYS.SETTINGS, {
    gameMode: 'iniciante',
    soundEnabled: true,
    vibrationEnabled: true,
    theme: 'dark',
    language: 'pt-BR'
  });

  // Estados temporários da sessão atual
  const [currentTab, setCurrentTab] = useState('game');
  const [gamePhase, setGamePhase] = useState('preflop');
  const [playerCards, setPlayerCards] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [opponentCards, setOpponentCards] = useState([]);
  const [opponents, setOpponents] = useState(3);
  const [currentProbability, setCurrentProbability] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showHandResult, setShowHandResult] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [usedCards, setUsedCards] = useState([]);
  const [gameFinished, setGameFinished] = useState(false);
  const [handWinner, setHandWinner] = useState(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [stackSize, setStackSize] = useState(1000);
  const [blindLevel, setBlindLevel] = useState(1);
  const [scenarioMode, setScenarioMode] = useState('random');

  // Refs para performance
  const notificationTimeoutRef = useRef(null);

  // Dados das cartas
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const suitColors = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };

  // Lista de conquistas
  const achievementsList = [
    { id: 'first_win', name: 'Primeira Vitória', description: 'Acerte sua primeira probabilidade', icon: '🎯' },
    { id: 'streak_5', name: 'Sequência de 5', description: '5 acertos consecutivos', icon: '🔥' },
    { id: 'streak_10', name: 'Ace High', description: '10 acertos consecutivos', icon: '🏆' },
    { id: 'folder', name: 'Seleção Criteriosa', description: 'Faça fold em 10 mãos', icon: '🚫' },
    { id: 'river_master', name: 'River Master', description: 'Acerte 10 probabilidades no river', icon: '🌊' },
    { id: 'perfectionist', name: 'Perfeccionista', description: '95% de precisão em 20 mãos', icon: '💎' },
    { id: 'analyzer', name: 'Analista', description: 'Complete 50 mãos', icon: '📊' },
    { id: 'tournament_player', name: 'Jogador de Torneio', description: 'Jogue 10 mãos no modo torneio', icon: '🏆' },
    { id: 'dedicated', name: 'Dedicado', description: 'Jogue 5 dias seguidos', icon: '📅' },
    { id: 'expert', name: 'Especialista', description: 'Complete 10 jogos no modo especialista', icon: '🧠' }
  ];

  // Utilidades
  const showNotification = (message, type = 'info') => {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
    }
  };

  const playSound = (type) => {
    if (!settings.soundEnabled) return;
    // Implementar sons do jogo
    console.log(`🔊 Playing sound: ${type}`);
  };

  const vibrate = (pattern = [100]) => {
    if (!settings.vibrationEnabled || !navigator.vibrate) return;
    navigator.vibrate(pattern);
  };

  // Funções auxiliares do jogo
  const shuffle = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const createDeck = () => {
    const deck = [];
    for (let suit of suits) {
      for (let value of values) {
        deck.push({ value, suit });
      }
    }
    return deck;
  };

  const getCardValue = (value) => {
    if (value === 'A') return 14;
    if (value === 'K') return 13;
    if (value === 'Q') return 12;
    if (value === 'J') return 11;
    if (value === 'T') return 10;
    return parseInt(value);
  };

  const isStraight = (cards) => {
    if (cards.length < 5) return false;
    const values = cards.map(card => getCardValue(card.value)).sort((a, b) => a - b);
    const uniqueValues = [...new Set(values)];
    
    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      let consecutive = 1;
      for (let j = i + 1; j < uniqueValues.length; j++) {
        if (uniqueValues[j] === uniqueValues[j-1] + 1) {
          consecutive++;
          if (consecutive === 5) return true;
        } else {
          break;
        }
      }
    }
    
    if (uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) && 
        uniqueValues.includes(4) && uniqueValues.includes(5)) {
      return true;
    }
    
    return false;
  };

  const evaluateHand = (playerCards, communityCards) => {
    const allCards = [...playerCards, ...communityCards];
    if (allCards.length < 5) return { rank: 0, score: 0, name: 'Incomplete' };

    const values = allCards.map(card => getCardValue(card.value));
    const suits = allCards.map(card => card.suit);
    const valueCounts = {};
    const suitCounts = {};

    values.forEach(value => valueCounts[value] = (valueCounts[value] || 0) + 1);
    suits.forEach(suit => suitCounts[suit] = (suitCounts[suit] || 0) + 1);

    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    const isFlush = Object.values(suitCounts).some(count => count >= 5);
    const straight = isStraight(allCards);
    const highCard = Math.max(...values);

    if (isFlush && straight && values.includes(14) && values.includes(13)) 
      return { rank: 10, score: 1000 + highCard, name: 'Royal Flush' };
    if (isFlush && straight) 
      return { rank: 9, score: 900 + highCard, name: 'Straight Flush' };
    if (counts[0] === 4) 
      return { rank: 8, score: 800 + highCard, name: 'Quadra' };
    if (counts[0] === 3 && counts[1] === 2) 
      return { rank: 7, score: 700 + highCard, name: 'Full House' };
    if (isFlush) 
      return { rank: 6, score: 600 + highCard, name: 'Flush' };
    if (straight) 
      return { rank: 5, score: 500 + highCard, name: 'Sequência' };
    if (counts[0] === 3) 
      return { rank: 4, score: 400 + highCard, name: 'Trinca' };
    if (counts[0] === 2 && counts[1] === 2) 
      return { rank: 3, score: 300 + highCard, name: 'Dois Pares' };
    if (counts[0] === 2) 
      return { rank: 2, score: 200 + highCard, name: 'Um Par' };
    return { rank: 1, score: highCard, name: 'Carta Alta' };
  };

  const calculateWinProbability = (playerCards, communityCards, numOpponents) => {
    const handStrength = evaluateHand(playerCards, communityCards);
    let baseProbability = 0;

    const modeMultiplier = {
      'iniciante': 1.0,
      'normal': 1.0,
      'especialista': 0.95,
      'torneio': 1.1 * (stackSize / 1000),
      'cenario': 1.0
    };

    switch (handStrength.rank) {
      case 10: baseProbability = 0.95; break;
      case 9: baseProbability = 0.90; break;
      case 8: baseProbability = 0.85; break;
      case 7: baseProbability = 0.80; break;
      case 6: baseProbability = 0.75; break;
      case 5: baseProbability = 0.65; break;
      case 4: baseProbability = 0.55; break;
      case 3: baseProbability = 0.45; break;
      case 2: baseProbability = 0.35; break;
      default: baseProbability = 0.25; break;
    }

    const phaseMultiplier = {
      'preflop': 0.7,
      'flop': 0.85,
      'turn': 0.95,
      'river': 1.0
    };

    const opponentPenalty = Math.pow(0.85, numOpponents - 1);
    
    return Math.min(0.95, Math.max(0.05, 
      baseProbability * phaseMultiplier[gamePhase] * opponentPenalty * modeMultiplier[settings.gameMode]
    ));
  };

  const generateOptions = (correctProb) => {
    const options = [correctProb];
    const range = settings.gameMode === 'especialista' ? 0.08 : 0.15;
    
    while (options.length < 4) {
      const variation = (Math.random() - 0.5) * range * 2;
      const newOption = Math.max(0.05, Math.min(0.95, correctProb + variation));
      
      if (!options.some(opt => Math.abs(opt - newOption) < 0.03)) {
        options.push(newOption);
      }
    }
    
    return shuffle(options);
  };

  const getBeginnerHints = () => {
    if (settings.gameMode !== 'iniciante') return null;
    
    const hand = evaluateHand(playerCards, communityCards);
    const hints = [];
    
    if (hand.rank >= 7) hints.push("🔥 Mão muito forte!");
    else if (hand.rank >= 4) hints.push("💪 Mão boa");
    else if (hand.rank >= 2) hints.push("⚠️ Mão média");
    else hints.push("❌ Mão fraca");
    
    if (communityCards.length >= 3) {
      const suits = [...playerCards, ...communityCards].map(c => c.suit);
      const suitCounts = {};
      suits.forEach(suit => suitCounts[suit] = (suitCounts[suit] || 0) + 1);
      
      if (Math.max(...Object.values(suitCounts)) >= 4) {
        hints.push("🌊 Possível flush draw");
      }
    }
    
    return hints;
  };

  const checkAchievements = (isCorrect) => {
    const newAchievements = [...achievements];
    
    if (isCorrect && gameData.score.correct === 0) {
      if (!achievements.includes('first_win')) {
        newAchievements.push('first_win');
        showNotification('🎯 Conquista desbloqueada: Primeira Vitória!', 'success');
        vibrate([100, 50, 100]);
      }
    }
    
    if (gameData.currentStreak >= 5 && !achievements.includes('streak_5')) {
      newAchievements.push('streak_5');
      showNotification('🔥 Conquista desbloqueada: Sequência de 5!', 'success');
      vibrate([100, 50, 100, 50, 100]);
    }
    
    if (gameData.currentStreak >= 10 && !achievements.includes('streak_10')) {
      newAchievements.push('streak_10');
      showNotification('🏆 Conquista desbloqueada: Ace High!', 'success');
      vibrate([200, 100, 200, 100, 200]);
    }
    
    if (gameData.score.folded >= 10 && !achievements.includes('folder')) {
      newAchievements.push('folder');
      showNotification('🚫 Conquista desbloqueada: Seleção Criteriosa!', 'success');
    }
    
    if (gameData.handsPlayed >= 50 && !achievements.includes('analyzer')) {
      newAchievements.push('analyzer');
      showNotification('📊 Conquista desbloqueada: Analista!', 'success');
    }
    
    setAchievements(newAchievements);
  };

  const updatePhaseStats = (phase, isCorrect) => {
    const newStats = { ...statistics };
    newStats.phaseStats[phase] = {
      correct: newStats.phaseStats[phase].correct + (isCorrect ? 1 : 0),
      total: newStats.phaseStats[phase].total + 1
    };
    setStatistics(newStats);
  };

  const updateErrorTrends = (selected, correct) => {
    const diff = selected - correct;
    const newStats = { ...statistics };
    newStats.errorTrends = {
      ...newStats.errorTrends,
      optimistic: newStats.errorTrends.optimistic + (diff > 0.05 ? 1 : 0),
      pessimistic: newStats.errorTrends.pessimistic + (diff < -0.05 ? 1 : 0),
      accurate: newStats.errorTrends.accurate + (Math.abs(diff) <= 0.05 ? 1 : 0)
    };
    setStatistics(newStats);
  };

  const checkAnswer = (selectedOption) => {
    setSelectedAnswer(selectedOption);
    setShowResult(true);
    
    const isCorrect = Math.abs(selectedOption - correctAnswer) < 0.01;
    
    // Som e vibração
    if (isCorrect) {
      playSound('correct');
      vibrate([50, 30, 50]);
    } else {
      playSound('incorrect');
      vibrate([200]);
    }
    
    // Atualizar pontuação
    const newGameData = {
      ...gameData,
      score: {
        ...gameData.score,
        correct: gameData.score.correct + (isCorrect ? 1 : 0),
        total: gameData.score.total + 1
      }
    };
    
    // Atualizar streak
    if (isCorrect) {
      newGameData.currentStreak = gameData.currentStreak + 1;
      newGameData.bestStreak = Math.max(gameData.bestStreak, newGameData.currentStreak);
    } else {
      newGameData.currentStreak = 0;
    }
    
    setGameData(newGameData);
    
    // Atualizar estatísticas
    updatePhaseStats(gamePhase, isCorrect);
    updateErrorTrends(selectedOption, correctAnswer);
    checkAchievements(isCorrect);
    
    // Atualizar dados de evolução
    const newStats = { ...statistics };
    newStats.evolutionData = [
      ...newStats.evolutionData,
      {
        hand: gameData.handsPlayed,
        accuracy: ((newGameData.score.correct) / (newGameData.score.total)) * 100,
        phase: gamePhase
      }
    ];
    
    // Adicionar ao histórico
    const handRecord = {
      id: gameData.handsPlayed,
      playerCards: [...playerCards],
      communityCards: [...communityCards],
      phase: gamePhase,
      estimated: selectedOption,
      actual: correctAnswer,
      isCorrect,
      handType: evaluateHand(playerCards, communityCards).name,
      timestamp: new Date().toISOString()
    };
    
    newStats.handHistory = [handRecord, ...newStats.handHistory].slice(0, 50); // Manter últimas 50
    
    // Atualizar stats por tipo de mão
    const handType = evaluateHand(playerCards, communityCards).name;
    newStats.handTypeStats = {
      ...newStats.handTypeStats,
      [handType]: {
        correct: (newStats.handTypeStats[handType]?.correct || 0) + (isCorrect ? 1 : 0),
        total: (newStats.handTypeStats[handType]?.total || 0) + 1
      }
    };
    
    setStatistics(newStats);
  };

  const startNewRound = () => {
    if (gameData.handsPlayed >= 50) {
      finishGame();
      return;
    }

    const deck = createDeck();
    const shuffledDeck = shuffle(deck);
    
    const randomOpponents = Math.floor(Math.random() * 7) + 2;
    
    const newPlayerCards = shuffledDeck.slice(0, 2);
    const newOpponentCards = [];
    let cardIndex = 2;
    
    for (let i = 0; i < randomOpponents; i++) {
      newOpponentCards.push(shuffledDeck.slice(cardIndex, cardIndex + 2));
      cardIndex += 2;
    }
    
    const newUsedCards = [...newPlayerCards, ...newOpponentCards.flat()];
    
    setPlayerCards(newPlayerCards);
    setOpponentCards(newOpponentCards);
    setCommunityCards([]);
    setUsedCards(newUsedCards);
    setOpponents(randomOpponents);
    setGamePhase('preflop');
    setSelectedAnswer(null);
    setShowResult(false);
    setShowHandResult(false);
    setHandWinner(null);
    
    // Atualizar hands played
    const newGameData = {
      ...gameData,
      handsPlayed: gameData.handsPlayed + 1
    };
    setGameData(newGameData);
    
    if (settings.gameMode === 'torneio' && newGameData.handsPlayed % 10 === 0) {
      setBlindLevel(prev => prev + 1);
    }
    
    const prob = calculateWinProbability(newPlayerCards, [], randomOpponents);
    setCurrentProbability(prob);
    setCorrectAnswer(prob);
    setOptions(generateOptions(prob));
  };

  const determineWinner = (playerCards, opponentCards, communityCards) => {
    const playerHand = evaluateHand(playerCards, communityCards);
    const results = [{ player: 'Você', hand: playerHand, cards: playerCards }];
    
    opponentCards.forEach((oppCards, index) => {
      const oppHand = evaluateHand(oppCards, communityCards);
      results.push({ 
        player: `Oponente ${index + 1}`, 
        hand: oppHand, 
        cards: oppCards 
      });
    });
    
    results.sort((a, b) => {
      if (a.hand.rank !== b.hand.rank) return b.hand.rank - a.hand.rank;
      return b.hand.score - a.hand.score;
    });
    
    return results[0];
  };

  const foldHand = () => {
    const newGameData = {
      ...gameData,
      score: {
        ...gameData.score,
        folded: gameData.score.folded + 1
      }
    };
    setGameData(newGameData);
    
    playSound('fold');
    vibrate([100]);
    showNotification('🚫 Mão descartada', 'info');
    
    startNewRound();
  };

  const nextPhase = () => {
    if (gamePhase === 'river') {
      const winner = determineWinner(playerCards, opponentCards, communityCards);
      setHandWinner(winner);
      setShowHandResult(true);
      
      if (winner.player === 'Você') {
        playSound('win');
        vibrate([100, 50, 100, 50, 100]);
      } else {
        playSound('lose');
      }
      
      return;
    }

    const deck = createDeck().filter(card => 
      !usedCards.some(used => used.value === card.value && used.suit === card.suit)
    );
    const shuffledDeck = shuffle(deck);
    
    let newCommunityCards = [...communityCards];
    let cardsToAdd = gamePhase === 'preflop' ? 3 : 1;
    let nextGamePhase = {
      'preflop': 'flop',
      'flop': 'turn', 
      'turn': 'river'
    }[gamePhase];

    newCommunityCards.push(...shuffledDeck.slice(0, cardsToAdd));
    const newUsedCards = [...usedCards, ...shuffledDeck.slice(0, cardsToAdd)];
    
    setCommunityCards(newCommunityCards);
    setUsedCards(newUsedCards);
    setGamePhase(nextGamePhase);
    setSelectedAnswer(null);
    setShowResult(false);
    
    const prob = calculateWinProbability(playerCards, newCommunityCards, opponents);
    setCurrentProbability(prob);
    setCorrectAnswer(prob);
    setOptions(generateOptions(prob));
    
    playSound('dealCard');
  };

  const finishGame = () => {
    setGameFinished(true);
    const finalScore = gameData.score.total > 0 ? (gameData.score.correct / gameData.score.total) * 100 : 0;
    
    // Atualizar total de jogos
    const newGameData = {
      ...gameData,
      totalGamesPlayed: gameData.totalGamesPlayed + 1
    };
    setGameData(newGameData);
    
    playSound('gameComplete');
    showNotification(`🏁 Jogo finalizado! Precisão: ${finalScore.toFixed(1)}%`, 'success');
    
    const wouldMakeTop10 = rankings.length < 10 || finalScore > rankings[rankings.length - 1]?.score;
    
    if (wouldMakeTop10) {
      setShowNameInput(true);
    }
  };

  const addToRanking = () => {
    if (!playerName.trim()) return;
    
    const finalScore = gameData.score.total > 0 ? (gameData.score.correct / gameData.score.total) * 100 : 0;
    const newEntry = {
      name: playerName.trim(),
      score: finalScore,
      hands: 50,
      date: new Date().toISOString()
    };
    
    const newRankings = [...rankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    setRankings(newRankings);
    setShowNameInput(false);
    showNotification('🏆 Adicionado ao ranking!', 'success');
  };

  const restartGame = () => {
    const newGameData = {
      score: { correct: 0, total: 0, folded: 0 },
      handsPlayed: 0,
      currentStreak: 0,
      bestStreak: gameData.bestStreak, // Manter melhor streak
      totalGamesPlayed: gameData.totalGamesPlayed // Manter total
    };
    
    setGameData(newGameData);
    setGameFinished(false);
    setShowNameInput(false);
    setPlayerName('');
    setStackSize(1000);
    setBlindLevel(1);
    
    // Não limpar statistics - manter histórico
    
    playSound('newGame');
    showNotification('🔄 Novo jogo iniciado!', 'info');
    
    startNewRound();
  };

  const renderCard = (card, isHidden = false) => (
    React.createElement('div', {
      key: `${card.value}${card.suit}`,
      className: "inline-block bg-white border-2 border-gray-300 rounded-lg p-2 m-1 shadow-md transition-transform hover:scale-105"
    }, 
      isHidden ? 
        React.createElement('div', {
          className: "w-12 h-16 bg-blue-600 rounded flex items-center justify-center"
        },
          React.createElement('span', {
            className: "text-white text-xl"
          }, '?')
        ) :
        React.createElement('div', {
          className: "w-12 h-16 flex flex-col items-center justify-center"
        },
          React.createElement('span', {
            className: `text-2xl font-bold ${suitColors[card.suit] === 'red' ? 'text-red-600' : 'text-black'}`
          }, card.value),
          React.createElement('span', {
            className: `text-2xl ${suitColors[card.suit] === 'red' ? 'text-red-600' : 'text-black'}`
          }, card.suit)
        )
    )
  );

  // Renderizar gráficos (versões simplificadas para performance)
  const renderEvolutionChart = () => {
    if (statistics.evolutionData.length === 0) {
      return React.createElement('div', { className: "text-center text-gray-400 py-8" }, 
        'Jogue algumas mãos para ver sua evolução'
      );
    }

    return React.createElement('div', { className: "w-full h-64" },
      React.createElement(LineChart, {
        width: 500,
        height: 250,
        data: statistics.evolutionData.slice(-20) // Últimas 20 para performance
      },
        React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
        React.createElement(XAxis, { dataKey: "hand" }),
        React.createElement(YAxis, { domain: [0, 100] }),
        React.createElement(Tooltip),
        React.createElement(Line, { 
          type: "monotone", 
          dataKey: "accuracy", 
          stroke: "#8884d8", 
          strokeWidth: 2 
        })
      )
    );
  };

  // Inicialização
  useEffect(() => {
    if (gameData.handsPlayed === 0) {
      startNewRound();
    }
  }, []);

  // Auto-save periódico
  useEffect(() => {
    const interval = setInterval(() => {
      // Os dados já são salvos automaticamente via useLocalStorage
      console.log('💾 Auto-save executado');
    }, 30000); // A cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  const phaseNames = {
    'preflop': 'Pré-Flop',
    'flop': 'Flop', 
    'turn': 'Turn',
    'river': 'River'
  };

  const gameModeName = {
    'iniciante': '🎓 Iniciante',
    'normal': '🎯 Normal',
    'especialista': '🧠 Especialista',
    'torneio': '🏆 Torneio',
    'cenario': '📚 Cenário'
  };

  // Tela final do jogo
  if (gameFinished && !showNameInput) {
    const finalScore = gameData.score.total > 0 ? (gameData.score.correct / gameData.score.total) * 100 : 0;
    
    return React.createElement('div', { className: "max-w-4xl mx-auto p-6 bg-green-900 min-h-screen text-white" },
      React.createElement('div', { className: "bg-green-800 rounded-lg p-8 text-center" },
        React.createElement('h1', { className: "text-4xl font-bold mb-6" }, '🏆 Jogo Finalizado!'),
        
        React.createElement('div', { className: "bg-gray-800 rounded-lg p-6 mb-6" },
          React.createElement('h2', { className: "text-2xl font-semibold mb-4" }, 'Seus Resultados'),
          React.createElement('div', { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-lg" },
            React.createElement('div', {},
              React.createElement('div', { className: "text-3xl font-bold text-green-400" }, gameData.score.correct),
              React.createElement('div', {}, 'Acertos')
            ),
            React.createElement('div', {},
              React.createElement('div', { className: "text-3xl font-bold text-red-400" }, gameData.score.total - gameData.score.correct),
              React.createElement('div', {}, 'Erros')
            ),
            React.createElement('div', {},
              React.createElement('div', { className: "text-3xl font-bold text-yellow-400" }, gameData.score.folded),
              React.createElement('div', {}, 'Folds')
            ),
            React.createElement('div', {},
              React.createElement('div', { className: "text-3xl font-bold text-blue-400" }, `${finalScore.toFixed(1)}%`),
              React.createElement('div', {}, 'Precisão')
            )
          )
        ),

        React.createElement('div', { className: "bg-gray-800 rounded-lg p-6 mb-6" },
          React.createElement('h2', { className: "text-2xl font-semibold mb-4" }, '🏅 Ranking Top 10'),
          React.createElement('div', { className: "space-y-2" },
            rankings.map((entry, index) =>
              React.createElement('div', {
                key: index,
                className: `flex justify-between items-center p-3 rounded ${index < 3 ? 'bg-yellow-600' : 'bg-gray-700'}`
              },
                React.createElement('span', { className: "font-semibold" }, `#${index + 1} ${entry.name}`),
                React.createElement('span', { className: "text-lg" }, `${entry.score.toFixed(1)}% (${entry.hands} mãos)`)
              )
            )
          )
        ),

        React.createElement('button', {
          onClick: restartGame,
          className: "bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg text-xl"
        }, '🔄 Jogar Novamente')
      )
    );
  }

  // Tela de input do nome
  if (showNameInput) {
    return React.createElement('div', { className: "max-w-4xl mx-auto p-6 bg-green-900 min-h-screen text-white flex items-center justify-center" },
      React.createElement('div', { className: "bg-green-800 rounded-lg p-8 text-center" },
        React.createElement('h1', { className: "text-3xl font-bold mb-6" }, '🎉 Parabéns!'),
        React.createElement('p', { className: "text-xl mb-6" }, 'Você entrou no Top 10! Digite seu nome:'),
        
        React.createElement('input', {
          type: "text",
          value: playerName,
          onChange: (e) => setPlayerName(e.target.value),
          className: "bg-gray-700 text-white p-3 rounded-lg text-xl mb-6 w-64",
          placeholder: "Seu nome...",
          maxLength: 20,
          onKeyPress: (e) => e.key === 'Enter' && addToRanking()
        }),
        
        React.createElement('div', { className: "space-x-4" },
          React.createElement('button', {
            onClick: addToRanking,
            disabled: !playerName.trim(),
            className: "bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg"
          }, 'Salvar'),
          React.createElement('button', {
            onClick: () => setShowNameInput(false),
            className: "bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg"
          }, 'Pular')
        )
      )
    );
  }

  // Interface principal do jogo
  return React.createElement('div', { className: "max-w-4xl mx-auto p-6 bg-green-900 min-h-screen text-white" },
    // Header
    React.createElement('div', { className: "bg-green-800 rounded-lg p-6 mb-6" },
      React.createElement('h1', { className: "text-3xl font-bold text-center mb-4" }, '🎯 Poker Trainer PWA'),
      
      // Navegação de abas
      React.createElement('div', { className: "flex justify-center space-x-4 mb-4" },
        ['game', 'stats', 'history', 'achievements'].map(tab =>
          React.createElement('button', {
            key: tab,
            onClick: () => setCurrentTab(tab),
            className: `py-2 px-4 rounded ${currentTab === tab ? 'bg-blue-600' : 'bg-gray-600'}`
          }, {
            'game': '🎮 Jogo',
            'stats': '📊 Stats', 
            'history': '📝 Histórico',
            'achievements': '🏆 Conquistas'
          }[tab])
        )
      ),

      // Modo de jogo
      currentTab === 'game' && React.createElement('div', { className: "flex justify-center space-x-2 mb-4" },
        Object.entries(gameModeName).map(([mode, name]) =>
          React.createElement('button', {
            key: mode,
            onClick: () => setSettings({...settings, gameMode: mode}),
            className: `py-1 px-3 rounded text-sm ${settings.gameMode === mode ? 'bg-yellow-600' : 'bg-gray-600'}`
          }, name)
        )
      ),

      // Estatísticas do jogo
      currentTab === 'game' && React.createElement('div', { className: "flex justify-between items-center mb-4 text-sm" },
        React.createElement('div', {},
          React.createElement('span', { className: "font-semibold" }, `Streak: ${gameData.currentStreak} (Melhor: ${gameData.bestStreak})`)
        ),
        React.createElement('div', {},
          React.createElement('span', { className: "font-semibold" }, `Acertos: ${gameData.score.correct}/${gameData.score.total}`),
          gameData.score.total > 0 && React.createElement('span', { className: "ml-2 text-yellow-300" },
            `(${Math.round((gameData.score.correct / gameData.score.total) * 100)}%)`
          )
        ),
        React.createElement('div', {},
          React.createElement('span', { className: "font-semibold" }, `Mão: ${gameData.handsPlayed}/50`)
        ),
        React.createElement('div', {},
          React.createElement('span', { className: "font-semibold" }, `${gameModeName[settings.gameMode]} - ${phaseNames[gamePhase]}`)
        )
      ),

      // Barra de progresso
      currentTab === 'game' && React.createElement('div', { className: "w-full bg-gray-700 rounded-full h-3 mb-4" },
        React.createElement('div', {
          className: "bg-yellow-500 h-3 rounded-full transition-all duration-500",
          style: { width: `${(gameData.handsPlayed / 50) * 100}%` }
        })
      ),

      // Modo torneio
      currentTab === 'game' && settings.gameMode === 'torneio' && React.createElement('div', { className: "text-center text-yellow-300" },
        `💰 Stack: ${stackSize} | 👁️ Blind Level: ${blindLevel}`
      )
    ),

    // Conteúdo baseado na aba selecionada
    currentTab === 'game' && [
      // Dicas para iniciante
      settings.gameMode === 'iniciante' && React.createElement('div', { 
        key: 'hints',
        className: "bg-blue-800 rounded-lg p-4 mb-6" 
      },
        React.createElement('h3', { className: "font-bold mb-2" }, '💡 Dicas:'),
        React.createElement('div', { className: "space-y-1 text-sm" },
          getBeginnerHints()?.map((hint, i) =>
            React.createElement('div', { key: i }, hint)
          )
        )
      ),

      // Mesa de poker
      React.createElement('div', { 
        key: 'table',
        className: "bg-green-700 rounded-lg p-6 mb-6" 
      },
        // Cartas comunitárias
        React.createElement('div', { className: "text-center mb-6" },
          React.createElement('h3', { className: "text-xl font-semibold mb-3" }, 'Mesa'),
          React.createElement('div', { className: "flex justify-center" },
            gamePhase === 'preflop' ?
              React.createElement('div', { className: "text-gray-300 text-lg" }, 'Aguardando o flop...') :
              communityCards.map(card => renderCard(card))
          )
        ),

        // Suas cartas
        React.createElement('div', { className: "text-center mb-6" },
          React.createElement('h3', { className: "text-xl font-semibold mb-3" }, 'Suas Cartas'),
          React.createElement('div', { className: "flex justify-center" },
            playerCards.map(card => renderCard(card))
          ),
          settings.gameMode === 'iniciante' && React.createElement('div', { className: "mt-2 text-yellow-300 text-sm" },
            `Mão atual: ${evaluateHand(playerCards, communityCards).name}`
          )
        ),

        // Oponentes
        React.createElement('div', { className: "text-center" },
          React.createElement('h3', { className: "text-xl font-semibold mb-3" }, `Oponentes (${opponents})`),
          React.createElement('div', { className: "flex justify-center space-x-4 flex-wrap" },
            opponentCards.map((oppCards, i) =>
              React.createElement('div', { key: i, className: "flex mb-2" },
                React.createElement('div', { className: "text-center mr-2" },
                  React.createElement('div', { className: "text-sm mb-1" }, `Op. ${i + 1}`),
                  React.createElement('div', { className: "flex" },
                    showHandResult ? 
                      oppCards.map(card => renderCard(card)) :
                      [
                        renderCard({value: '?', suit: '?'}, true),
                        renderCard({value: '?', suit: '?'}, true)
                      ]
                  )
                )
              )
            )
          )
        )
      ),

      // Resultado da mão
      showHandResult && handWinner && React.createElement('div', { 
        key: 'result',
        className: "bg-gray-800 rounded-lg p-6 mb-6" 
      },
        React.createElement('h2', { className: "text-2xl font-semibold mb-4 text-center" }, '🎯 Resultado da Mão'),
        React.createElement('div', { className: "text-center" },
          React.createElement('div', {
            className: `text-2xl font-bold mb-2 ${handWinner.player === 'Você' ? 'text-green-400' : 'text-red-400'}`
          }, handWinner.player === 'Você' ? '🏆 Você Ganhou!' : `😔 ${handWinner.player} Ganhou`),
          React.createElement('div', { className: "text-xl text-yellow-300 mb-4" }, handWinner.hand.name),
          React.createElement('div', { className: "flex justify-center mb-4" },
            handWinner.cards.map(card => renderCard(card))
          ),
          React.createElement('button', {
            onClick: startNewRound,
            className: "bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg"
          }, '➡️ Próxima Mão')
        )
      ),

      // Pergunta de probabilidade
      !showHandResult && React.createElement('div', { 
        key: 'question',
        className: "bg-gray-800 rounded-lg p-6 mb-6" 
      },
        React.createElement('h2', { className: "text-xl font-semibold mb-4 text-center" },
          'Qual a probabilidade de você ganhar esta mão?'
        ),
        
        React.createElement('div', { className: "grid grid-cols-2 gap-4 mb-4" },
          options.map((option, index) => {
            const percentage = Math.round(option * 100);
            let buttonClass = "p-4 rounded-lg font-semibold text-lg transition-all duration-300 ";
            
            if (showResult) {
              if (Math.abs(option - correctAnswer) < 0.01) {
                buttonClass += "bg-green-600 text-white animate-pulse";
              } else if (selectedAnswer === option) {
                buttonClass += "bg-red-600 text-white animate-pulse";
              } else {
                buttonClass += "bg-gray-600 text-gray-300";
              }
            } else {
              buttonClass += "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer";
            }

            return React.createElement('button', {
              key: index,
              className: buttonClass,
              onClick: () => !showResult && checkAnswer(option),
              disabled: showResult
            }, `${percentage}%`);
          })
        ),

        // Botão Fold
        !showResult && React.createElement('div', { className: "text-center mb-4" },
          React.createElement('button', {
            onClick: foldHand,
            className: "bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg"
          }, '🚫 Fold (Descartar)')
        ),

        showResult && React.createElement('div', { className: "text-center" },
          React.createElement('div', { className: "text-lg mb-4" },
            Math.abs(selectedAnswer - correctAnswer) < 0.01 ?
              React.createElement('span', { className: "text-green-400 font-bold" }, '✅ Correto!') :
              React.createElement('span', { className: "text-red-400 font-bold" }, '❌ Incorreto!')
          ),
          React.createElement('div', { className: "text-gray-300 mb-4" },
            'Probabilidade correta: ',
            React.createElement('span', { className: "font-bold text-yellow-300" },
              `${Math.round(correctAnswer * 100)}%`
            )
          ),
          settings.gameMode === 'iniciante' && React.createElement('div', { className: "text-blue-300 mb-4 text-sm" },
            `💡 Lembre-se: ${Math.abs(selectedAnswer - correctAnswer) > 0.15 ? 
              'Grande diferença! Observe a força da sua mão e quantidade de oponentes.' :
              'Boa estimativa! Continue praticando para melhorar a precisão.'
            }`
          ),
          React.createElement('button', {
            onClick: gamePhase === 'river' ? nextPhase : nextPhase,
            className: "bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg"
          }, gamePhase === 'river' ? '🎯 Ver Resultado' : 
            `➡️ ${phaseNames[{preflop: 'flop', flop: 'turn', turn: 'river'}[gamePhase]]}`
          )
        )
      ),

      // Controles
      React.createElement('div', { 
        key: 'controls',
        className: "bg-gray-800 rounded-lg p-4" 
      },
        React.createElement('div', { className: "flex justify-between items-center" },
          React.createElement('div', { className: "text-sm text-gray-300" },
            `Folds: ${gameData.score.folded} | Conquistas: ${achievements.length}/${achievementsList.length} | Jogos: ${gameData.totalGamesPlayed}`
          ),
          React.createElement('div', { className: "space-x-2" },
            settings.gameMode === 'cenario' && React.createElement('select', {
              value: scenarioMode,
              onChange: (e) => setScenarioMode(e.target.value),
              className: "bg-gray-700 text-white p-2 rounded text-sm"
            },
              React.createElement('option', { value: "random" }, '🎲 Aleatório'),
              React.createElement('option', { value: "premium" }, '⭐ Mãos Premium')
            ),
            React.createElement('button', {
              onClick: restartGame,
              className: "bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded"
            }, '🔄 Reiniciar')
          )
        )
      )
    ],

    // Aba de estatísticas
    currentTab === 'stats' && React.createElement('div', { className: "space-y-6" },
      React.createElement('h2', { className: "text-2xl font-bold text-center" }, '📊 Estatísticas Avançadas'),
      
      React.createElement('div', { className: "bg-gray-800 rounded-lg p-6" },
        React.createElement('h3', { className: "text-xl font-semibold mb-4" }, '📈 Evolução da Precisão'),
        renderEvolutionChart()
      ),

      React.createElement('div', { className: "bg-gray-800 rounded-lg p-6" },
        React.createElement('h3', { className: "text-xl font-semibold mb-4" }, '🃏 Precisão por Tipo de Mão'),
        React.createElement('div', { className: "space-y-2" },
          Object.entries(statistics.handTypeStats).map(([handType, stats]) => {
            const accuracy = Math.round((stats.correct / stats.total) * 100);
            return React.createElement('div', {
              key: handType,
              className: "flex justify-between items-center p-2 bg-gray-700 rounded"
            },
              React.createElement('span', {}, handType),
              React.createElement('span', {
                className: `font-bold ${accuracy >= 80 ? 'text-green-400' : accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`
              }, `${accuracy}% (${stats.total})`)
            );
          })
        )
      )
    ),

    // Aba de histórico
    currentTab === 'history' && React.createElement('div', { className: "space-y-6" },
      React.createElement('h2', { className: "text-2xl font-bold text-center" }, '📝 Histórico de Mãos'),
      
      React.createElement('div', { className: "space-y-4" },
        statistics.handHistory.slice(0, 10).map((hand) =>
          React.createElement('div', {
            key: hand.id,
            className: `p-4 rounded-lg ${hand.isCorrect ? 'bg-green-900' : 'bg-red-900'}`
          },
            React.createElement('div', { className: "flex justify-between items-center mb-2" },
              React.createElement('span', { className: "font-bold" }, `Mão #${hand.id} - ${hand.phase}`),
              React.createElement('span', {
                className: `font-bold ${hand.isCorrect ? 'text-green-400' : 'text-red-400'}`
              }, hand.isCorrect ? '✅' : '❌')
            ),
            React.createElement('div', { className: "grid grid-cols-2 gap-4 text-sm" },
              React.createElement('div', {},
                React.createElement('strong', {}, 'Suas cartas: '),
                hand.playerCards.map(c => `${c.value}${c.suit}`).join(' ')
              ),
              React.createElement('div', {},
                React.createElement('strong', {}, 'Mesa: '),
                hand.communityCards.map(c => `${c.value}${c.suit}`).join(' ') || 'Pré-flop'
              ),
              React.createElement('div', {},
                React.createElement('strong', {}, 'Sua estimativa: '),
                `${Math.round(hand.estimated * 100)}%`
              ),
              React.createElement('div', {},
                React.createElement('strong', {}, 'Probabilidade real: '),
                `${Math.round(hand.actual * 100)}%`
              )
            )
          )
        )
      )
    ),

    // Aba de conquistas
    currentTab === 'achievements' && React.createElement('div', { className: "space-y-6" },
      React.createElement('h2', { className: "text-2xl font-bold text-center" }, '🏆 Conquistas'),
      
      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
        achievementsList.map((achievement) => {
          const unlocked = achievements.includes(achievement.id);
          return React.createElement('div', {
            key: achievement.id,
            className: `p-6 rounded-lg border-2 ${unlocked ? 'bg-yellow-900 border-yellow-500' : 'bg-gray-800 border-gray-600'}`
          },
            React.createElement('div', { className: "text-center" },
              React.createElement('div', { className: "text-4xl mb-2" }, achievement.icon),
              React.createElement('div', {
                className: `font-bold text-lg mb-2 ${unlocked ? 'text-yellow-300' : 'text-gray-400'}`
              }, achievement.name),
              React.createElement('div', {
                className: `text-sm ${unlocked ? 'text-yellow-100' : 'text-gray-500'}`
              }, achievement.description),
              unlocked && React.createElement('div', { className: "mt-2 text-green-400 font-bold" }, 'DESBLOQUEADO!')
            )
          );
        })
      )
    ),

    // PWA Info
    React.createElement('div', { className: "bg-gray-800 rounded-lg p-4 mt-6 text-center text-sm text-gray-300" },
      '📱 PWA instalado! Dados salvos localmente. Funciona offline após instalação.',
      React.createElement('br'),
      `💾 Total de jogos: ${gameData.totalGamesPlayed} | Melhor streak: ${gameData.bestStreak}`
    )
  );
};

// Renderizar o aplicativo
ReactDOM.render(React.createElement(PokerTrainer), document.getElementById('root'));