import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTailwind } from 'tailwind-rn';
import { GameEngine } from 'react-native-game-engine';

const { width, height } = Dimensions.get('window');
const PLAYER_SIZE = 40;
const OBSTACLE_SIZE = 30;
const COIN_SIZE = 20;
const INITIAL_PLAYER = { x: width / 4, y: height - 100, velocity: 0, jumps: 0 };
const SPEED = 3;

const App = () => {
  const tailwind = useTailwind();
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState([]);
  const [entities, setEntities] = useState({
    player: { ...INITIAL_PLAYER, renderer: <Player /> },
    obstacles: [],
    coins: [],
  });

  // Load high scores
  useEffect(() => {
    const loadHighScores = async () => {
      try {
        const stored = await AsyncStorage.getItem('highScores');
        if (stored) setHighScores(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading high scores:', error);
      }
    };
    loadHighScores();
  }, []);

  // Save high score
  const saveHighScore = async () => {
    try {
      const newScores = [...highScores, { score, date: new Date().toISOString() }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      await AsyncStorage.setItem('highScores', JSON.stringify(newScores));
      setHighScores(newScores);
    } catch (error) {
      console.error('Error saving high score:', error);
    }
  };

  // Reset high scores
  const resetHighScores = async () => {
    try {
      await AsyncStorage.setItem('highScores', JSON.stringify([]));
      setHighScores([]);
      Alert.alert('Success', 'High scores cleared!');
    } catch (error) {
      console.error('Error resetting high scores:', error);
    }
  };

  // Game systems
  const systems = {
    movePlayer: ({ entities, touches }) => {
      const player = entities.player;
      if (touches.length > 0 && player.jumps < 2) {
        player.velocity = -12; // Jump
        player.jumps += 1;
      }
      player.velocity += 0.6; // Gravity
      player.y += player.velocity;
      if (player.y >= height - 100) {
        player.y = height - 100;
        player.velocity = 0;
        player.jumps = 0;
      }
      if (player.y < 0) {
        setGameState('gameOver');
        saveHighScore();
      }
      return entities;
    },
    spawnObstacles: ({ entities, time }) => {
      if (time.current % 1500 < 50) {
        entities.obstacles.push({
          x: width,
          y: height - 100,
          renderer: <Obstacle />,
        });
      }
      entities.obstacles = entities.obstacles.map(obstacle => ({
        ...obstacle,
        x: obstacle.x - SPEED,
      })).filter(obstacle => obstacle.x > -OBSTACLE_SIZE);
      return entities;
    },
    spawnCoins: ({ entities, time }) => {
      if (time.current % 2000 < 50) {
        entities.coins.push({
          x: width,
          y: Math.random() * (height - 200) + 50,
          renderer: <Coin />,
        });
      }
      entities.coins = entities.coins.map(coin => ({
        ...coin,
        x: coin.x - SPEED,
      })).filter(coin => coin.x > -COIN_SIZE);
      return entities;
    },
    checkCollisions: ({ entities }) => {
      const player = entities.player;
      entities.obstacles.forEach(obstacle => {
        if (
          Math.abs(player.x - obstacle.x) < PLAYER_SIZE &&
          Math.abs(player.y - obstacle.y) < PLAYER_SIZE
        ) {
          setGameState('gameOver');
          saveHighScore();
        }
      });
      entities.coins = entities.coins.filter(coin => {
        if (Math.abs(player.x - coin.x) < PLAYER_SIZE && Math.abs(player.y - coin.y) < PLAYER_SIZE) {
          setScore(score + 10);
          return false;
        }
        return true;
      });
      setScore(score + 1); // Increment score over time
      return entities;
    },
  };

  // Start game
  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setEntities({
      player: { ...INITIAL_PLAYER, renderer: <Player /> },
      obstacles: [],
      coins: [],
    });
  };

  // Render components
  const Player = () => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.player.x, { duration: 50 }) },
        { translateY: withTiming(entities.player.y, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-10 h-10 bg-purple-500 rounded-lg'), style]} />;
  };

  const Obstacle = ({ x, y }) => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(x, { duration: 50 }) },
        { translateY: withTiming(y, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-8 h-8 bg-red-500'), style]} />;
  };

  const Coin = ({ x, y }) => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(x, { duration: 50 }) },
        { translateY: withTiming(y, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-5 h-5 bg-yellow-500 rounded-full'), style]} />;
  };

  // Render screens
  const renderMenu = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-gray-800')}>
      <Text style={tailwind('text-4xl text-white mb-8')}>Pixel Runner</Text>
      <TouchableOpacity style={tailwind('bg-purple-500 p-4 rounded-lg mb-4')} onPress={startGame}>
        <Text style={tailwind('text-white text-lg')}>Start Game</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={tailwind('bg-gray-500 p-4 rounded-lg mb-4')}
        onPress={() => setGameState('highScores')}
      >
        <Text style={tailwind('text-white text-lg')}>High Scores</Text>
      </TouchableOpacity>
      <TouchableOpacity style={tailwind('bg-red-500 p-4 rounded-lg')} onPress={resetHighScores}>
        <Text style={tailwind('text-white text-lg')}>Reset Scores</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGame = () => (
    <View style={tailwind('flex-1 bg-gray-800')}>
      <GameEngine
        style={tailwind('flex-1')}
        systems={[systems.movePlayer, systems.spawnObstacles, systems.spawnCoins, systems.checkCollisions]}
        entities={entities}
        running={gameState === 'playing'}
      />
      <Text style={tailwind('text-white text-2xl absolute top-4 left-4')}>Score: {score}</Text>
    </View>
  );

  const renderHighScores = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-gray-800')}>
      <Text style={tailwind('text-3xl text-white mb-4')}>High Scores</Text>
      {highScores.length ? (
        highScores.map((entry, index) => (
          <Text key={index} style={tailwind('text-lg text-white')}>
            {index + 1}. {entry.score} points ({entry.date})
          </Text>
        ))
      ) : (
        <Text style={tailwind('text-lg text-white')}>No high scores yet.</Text>
      )}
      <TouchableOpacity
        style={tailwind('bg-purple-500 p-4 rounded-lg mt-4')}
        onPress={() => setGameState('menu')}
      >
        <Text style={tailwind('text-white text-lg')}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGameOver = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-gray-800')}>
      <Text style={tailwind('text-3xl text-white mb-4')}>Game Over!</Text>
      <Text style={tailwind('text-2xl text-white mb-8')}>Score: {score}</Text>
      <TouchableOpacity style={tailwind('bg-purple-500 p-4 rounded-lg mb-4')} onPress={startGame}>
        <Text style={tailwind('text-white text-lg')}>Play Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={tailwind('bg-gray-500 p-4 rounded-lg')}
        onPress={() => setGameState('menu')}
      >
        <Text style={tailwind('text-white text-lg')}>Main Menu</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={tailwind('flex-1')}>
      {gameState === 'menu' && renderMenu()}
      {gameState === 'playing' && renderGame()}
      {gameState === 'highScores' && renderHighScores()}
      {gameState === 'gameOver' && renderGameOver()}
    </View>
  );
};

export default App;
