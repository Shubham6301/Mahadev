import RapidFireGame from '../models/RapidFireGame.js';
import MCQQuestion from '../models/MCQQuestion.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

console.log('🔥 BULLETPROOF Rapid Fire socket handlers loading...');

// Store active rapid fire games and their timers
const activeRapidFireGames = new Map();
const GAME_DURATION = 120; // 120 seconds
const TOTAL_QUESTIONS = 10;

// ✅ SINGLE DEFINITION: BULLETPROOF Elo rating calculation (moved to TOP)
const calculateEloRatingChange = (playerRating, opponentRating, result, kFactor = 32) => {
  // result: 1 for win, 0 for loss, 0.5 for draw
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const ratingChange = Math.round(kFactor * (result - expectedScore));
  return ratingChange;
};

// BULLETPROOF helper function to fetch questions independently
const fetchQuestionsForGame = async (questionIds) => {
  try {
    console.log('🔥 BULLETPROOF: Fetching questions for IDs:', questionIds.map(id => id.toString()));
    
    const questions = await MCQQuestion.find({ 
      _id: { $in: questionIds }
    }).lean();
    
    console.log('✅ BULLETPROOF: Questions fetched:', questions.length);
    
    // Validate each question
    const validQuestions = questions.filter(q => 
      q && q.question && q.options && Array.isArray(q.options) && q.options.length >= 4
    );
    
    console.log('✅ BULLETPROOF: Valid questions:', validQuestions.length);
    
    return validQuestions;
  } catch (error) {
    console.error('❌ BULLETPROOF: Error fetching questions:', error);
    return [];
  }
};

// BULLETPROOF: Smart random question generator with unique selection
const generateRandomQuestions = async (count = TOTAL_QUESTIONS) => {
  try {
    console.log('🎲 BULLETPROOF: Generating random questions, count:', count);
    
    // Get all available MCQ questions
    const allQuestions = await MCQQuestion.find({ domain: 'dsa' }).lean();
    console.log('📚 Available questions in database:', allQuestions.length);
    
    if (allQuestions.length < count) {
      console.warn('⚠️ Not enough questions in database, using all available');
      return allQuestions.slice(0, count);
    }
    
    // Shuffle and select unique questions
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, count);
    
    console.log('✅ BULLETPROOF: Selected random questions:', selectedQuestions.length);
    return selectedQuestions;
  } catch (error) {
    console.error('❌ BULLETPROOF: Error generating random questions:', error);
    return [];
  }
};

// BULLETPROOF: End game function with Chess.com style Elo rating
const endRapidFireGame = async (gameId, io) => {
  try {
    console.log('🏁 BULLETPROOF: Ending rapid fire game:', gameId);

    const game = await RapidFireGame.findById(gameId)
      .populate('players.user', 'username profile.avatar ratings.rapidFireRating');

    if (!game) return;

    // Update game status
    game.status = 'finished';
    game.endTime = new Date();

    // Calculate final scores and ranks
    const sortedPlayers = game.players.sort((a, b) => b.score - a.score);
    
    // Set game result and winner properly
    const isDraw = sortedPlayers.length >= 2 && sortedPlayers[0].score === sortedPlayers[1].score;
    
    if (isDraw) {
      game.result = 'draw';
      game.winner = null;
    } else {
      game.result = 'win';
      game.winner = sortedPlayers[0].user._id;
    }
    
    console.log('🎯 Game result set:', {
      result: game.result,
      winner: game.winner,
      isDraw,
      scores: sortedPlayers.map(p => ({ user: p.user.username, score: p.score }))
    });
    
    // Chess.com style Elo rating calculation
    const ratingUpdates = [];
    
    if (sortedPlayers.length === 2) {
      const [player1, player2] = sortedPlayers;
      
      // Handle tie case
      const drawResult = player1.score === player2.score;
      
      // Assign ranks
      player1.rank = 1;
      player2.rank = drawResult ? 1 : 2;
      
      const player1OldRating = player1.user.ratings?.rapidFireRating || 1200;
      const player2OldRating = player2.user.ratings?.rapidFireRating || 1200;
      
      // Store old ratings in game
      player1.ratingBefore = player1OldRating;
      player2.ratingBefore = player2OldRating;
      
      // Calculate rating changes
      const player1Change = calculateEloRatingChange(
        player1OldRating, 
        player2OldRating, 
        drawResult ? 0.5 : 1,
        32
      );
      const player2Change = calculateEloRatingChange(
        player2OldRating, 
        player1OldRating, 
        drawResult ? 0.5 : 0,
        32
      );
      
      // Update player1
      const player1User = await User.findById(player1.user._id);
      if (player1User) {
        const newRating = Math.max(100, player1OldRating + player1Change);
        player1User.ratings.rapidFireRating = newRating;
        
        // Add to rapid fire history
        if (!Array.isArray(player1User.rapidFireHistory)) {
          player1User.rapidFireHistory = [];
        }
        player1User.rapidFireHistory.push({
          opponent: player2.user._id,
          result: drawResult ? 'draw' : 'win',
          ratingChange: player1Change,
          score: player1.score,
          correctAnswers: player1.correctAnswers,
          wrongAnswers: player1.wrongAnswers,
          totalQuestions: game.totalQuestions,
          date: new Date()
        });
        
        player1User.stats.rapidFireGamesPlayed = (player1User.stats.rapidFireGamesPlayed || 0) + 1;
        if (!drawResult) {
          player1User.stats.rapidFireGamesWon = (player1User.stats.rapidFireGamesWon || 0) + 1;
        }
        
        await player1User.save();
        
        player1.ratingChange = player1Change;
        player1.newRating = newRating;
        player1.oldRating = player1OldRating;
        player1.ratingAfter = newRating;
        
        ratingUpdates.push({
          userId: player1.user._id,
          username: player1.user.username,
          oldRating: player1OldRating,
          newRating: newRating,
          change: player1Change,
          result: drawResult ? 'draw' : 'win'
        });
      }
      
      // Update player2
      const player2User = await User.findById(player2.user._id);
      if (player2User) {
        const newRating = Math.max(100, player2OldRating + player2Change);
        player2User.ratings.rapidFireRating = newRating;
        
        // Add to rapid fire history
        if (!Array.isArray(player2User.rapidFireHistory)) {
          player2User.rapidFireHistory = [];
        }
        player2User.rapidFireHistory.push({
          opponent: player1.user._id,
          result: drawResult ? 'draw' : 'loss',
          ratingChange: player2Change,
          score: player2.score,
          correctAnswers: player2.correctAnswers,
          wrongAnswers: player2.wrongAnswers,
          totalQuestions: game.totalQuestions,
          date: new Date()
        });
        
        player2User.stats.rapidFireGamesPlayed = (player2User.stats.rapidFireGamesPlayed || 0) + 1;
        
        await player2User.save();
        
        player2.ratingChange = player2Change;
        player2.newRating = newRating;
        player2.oldRating = player2OldRating;
        player2.ratingAfter = newRating;
        
        ratingUpdates.push({
          userId: player2.user._id,
          username: player2.user.username,
          oldRating: player2OldRating,
          newRating: newRating,
          change: player2Change,
          result: drawResult ? 'draw' : 'loss'
        });
      }
    }

    await game.save();

    console.log('🎯 BULLETPROOF: Rating updates:', ratingUpdates);

    // Emit game results with rating changes
// In endRapidFireGame, when emitting
io.to(`rapidfire-${gameId}`).emit('rapidfire-game-ended', {
  gameId,
  results: sortedPlayers.map((p) => ({
    userId: String(p.user._id), // Ensure string
    username: p.user.username || 'Unknown',
    avatar: p.user.profile?.avatar,
    score: p.score,
    rank: p.rank,
    oldRating: p.oldRating || 1200,
    newRating: p.newRating || 1200,
    ratingChange: p.ratingChange || 0,
    correctAnswers: p.correctAnswers || 0,
    wrongAnswers: p.wrongAnswers || 0,
    questionsAnswered: p.questionsAnswered || 0,
    result: p.rank === 1 ? (isDraw ? 'draw' : 'win') : 'loss'
  })),
  ratingUpdates,
  finalState: game
});

    // Clean up active game
    const activeGame = activeRapidFireGames.get(gameId);
    if (activeGame?.timer) {
      clearTimeout(activeGame.timer);
    }
    if (activeGame?.updateTimer) {
      clearInterval(activeGame.updateTimer);
    }
    activeRapidFireGames.delete(gameId);

    console.log('✅ BULLETPROOF: Rapid fire game ended successfully with Elo ratings');

  } catch (error) {
    console.error('❌ BULLETPROOF: Error ending rapid fire game:', error);
  }
};

// ✅ MAIN EXPORT FUNCTION - All socket handlers go INSIDE this
export const setupRapidFireSocket = (io) => {
  console.log('🔥 BULLETPROOF: Setting up rapid fire socket handlers...');
  
  // CRITICAL FIX: Add authentication middleware for RapidFire sockets
  const authenticateSocket = (socket, next) => {
    try {
      const { token, userId } = socket.handshake.auth;
      console.log("🔐 RapidFire Socket auth attempt:", { userId, hasToken: !!token });

      if (!token || !userId) {
        console.log("❌ Missing auth credentials for RapidFire socket");
        return next(new Error("Authentication required"));
      }

      // ✅ CRITICAL FIX: Verify the JWT token and get user data
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("✅ RapidFire JWT verified for user:", decoded.userId);
        
        // Validate that the userId matches the token
        if (decoded.userId !== userId) {
          console.error("❌ RapidFire User ID mismatch in token");
          return next(new Error("Invalid authentication"));
        }

        // Store user info in socket for easy access
        socket.userId = userId;
        socket.userInfo = decoded;

      } catch (jwtError) {
        console.error("❌ RapidFire JWT verification failed:", jwtError);
        return next(new Error("Invalid token"));
      }
      
      console.log("✅ RapidFire Socket authenticated for user:", userId, "Socket ID:", socket.id);
      next();
    } catch (error) {
      console.error("❌ RapidFire Socket auth error:", error);
      next(new Error("Authentication failed"));
    }
  };

  // Apply authentication middleware
  io.use(authenticateSocket);
  
  io.on('connection', (socket) => {
    console.log("🔌 User connected to RapidFire socket:", socket.id, "User:", socket.userId);

    // BULLETPROOF: Join rapid fire game room
    socket.on('join-rapidfire-game', async (gameId) => {
      try {
        console.log('🎯 BULLETPROOF: User joining rapid fire game:', gameId);

        // STEP 1: Get basic game data (WITHOUT questionSet population)
        const gameData = await RapidFireGame.findById(gameId)
          .populate('players.user', 'username profile.avatar ratings.rapidFireRating')
          .lean();

        if (!gameData) {
          socket.emit('error', { message: 'Rapid fire game not found' });
          return;
        }

        // STEP 2: BULLETPROOF question fetching (implement as needed)
        // ...

        // Join the game room
        socket.join(`rapidfire-${gameId}`);
        socket.rapidFireGameId = gameId;

        console.log('✅ User joined rapid fire room:', `rapidfire-${gameId}`);
        
      } catch (error) {
        console.error('❌ Error joining rapid fire game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // ✅ FIXED: Submit answer handler (MOVED INSIDE connection)
    socket.on('submit-rapidfire-answer', async (data) => {
      try {
        const { gameId, questionIndex, selectedOption } = data;
        console.log('📝 BULLETPROOF: Answer submitted:', { gameId, questionIndex, selectedOption, userId: socket.userId });

        const game = await RapidFireGame.findById(gameId);
        if (!game || game.status !== 'ongoing') {
          socket.emit('error', { message: 'Game not found or not ongoing' });
          return;
        }

        // Check if game timer has expired
        const gameState = activeRapidFireGames.get(gameId);
        if (!gameState) {
          socket.emit('error', { message: 'Game session not active' });
          return;
        }

        const elapsed = Math.floor((Date.now() - gameState.startTime.getTime()) / 1000);
        if (elapsed >= GAME_DURATION) {
          socket.emit('error', { message: 'Game time has expired' });
          return;
        }

        // Find player
        const playerIndex = game.players.findIndex(p => p.user.toString() === socket.userId);
        if (playerIndex === -1) {
          socket.emit('error', { message: 'Player not found in game' });
          return;
        }

        const player = game.players[playerIndex];
        const alreadyAnswered = player.answers.some(answer => answer.questionIndex === questionIndex);
        
        if (alreadyAnswered) {
          console.log('⚠️ BULLETPROOF: Player already answered this question');
          socket.emit('error', { message: 'Already answered this question' });
          return;
        }

        // Get questions from memory or database
        let questions = gameState.questions;
        if (!questions || !questions[questionIndex]) {
          socket.emit('error', { message: 'Question not found' });
          return;
        }

        const question = questions[questionIndex];
        const isCorrect = question.options[selectedOption]?.isCorrect || false;

        // Update player score with proper negative marking
        if (isCorrect) {
          player.score += 1;
          player.correctAnswers = (player.correctAnswers || 0) + 1;
        } else {
          player.score -= 0.25; // NEGATIVE MARKING
          player.wrongAnswers = (player.wrongAnswers || 0) + 1;
        }
        
        player.questionsAnswered = (player.questionsAnswered || 0) + 1;
        
        // Store answer
        player.answers.push({
          questionId: question._id,
          questionIndex: questionIndex,
          selectedOption,
          isCorrect,
          answeredAt: new Date()
        });

        await game.save();

        // Broadcast live update
        const gameStateUpdate = {
          gameId: gameId,
          players: game.players.map(p => ({
            userId: p.user.toString(),
            score: p.score,
            correctAnswers: p.correctAnswers || 0,
            wrongAnswers: p.wrongAnswers || 0,
            questionsAnswered: p.questionsAnswered || 0
          })),
          currentQuestion: questionIndex,
          timeRemaining: Math.max(0, GAME_DURATION - elapsed)
        };

        io.to(`rapidfire-${gameId}`).emit('rapidfire-live-update', gameStateUpdate);

        // Send answer result to player
        socket.emit('answer-result', {
          questionIndex,
          isCorrect,
          correctAnswer: question.options.findIndex(opt => opt.isCorrect),
          explanation: question.explanation,
          newScore: player.score
        });

        // Check if game should end
        const allPlayersFinished = game.players.every(p => p.questionsAnswered >= TOTAL_QUESTIONS);
        if (allPlayersFinished) {
          if (gameState.timer) clearTimeout(gameState.timer);
          if (gameState.updateTimer) clearInterval(gameState.updateTimer);
          await endRapidFireGame(gameId, io);
        }

      } catch (error) {
        console.error('❌ BULLETPROOF: Error in submit-rapidfire-answer:', error);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    // ✅ FIXED: Skip question handler (MOVED INSIDE connection)
    socket.on('skip-rapidfire-question', async (data) => {
      try {
        const { gameId, questionIndex } = data;
        console.log('⏭️ BULLETPROOF: Question skipped:', { gameId, questionIndex, userId: socket.userId });

        const game = await RapidFireGame.findById(gameId);
        if (!game || game.status !== 'ongoing') {
          socket.emit('error', { message: 'Game not found or not ongoing' });
          return;
        }

        const gameState = activeRapidFireGames.get(gameId);
        if (!gameState) {
          socket.emit('error', { message: 'Game session not active' });
          return;
        }

        const elapsed = Math.floor((Date.now() - gameState.startTime.getTime()) / 1000);
        if (elapsed >= GAME_DURATION) {
          socket.emit('error', { message: 'Game time has expired' });
          return;
        }

        const playerIndex = game.players.findIndex(p => p.user.toString() === socket.userId);
        if (playerIndex === -1) {
          socket.emit('error', { message: 'Player not found in game' });
          return;
        }

        const player = game.players[playerIndex];
        const alreadyProcessed = player.answers.some(answer => answer.questionIndex === questionIndex);
        
        if (alreadyProcessed) {
          socket.emit('error', { message: 'Question already processed' });
          return;
        }

        // Record skip
        player.answers.push({
          questionId: gameState.questions[questionIndex]._id,
          questionIndex: questionIndex,
          selectedOption: -1,
          isCorrect: false,
          isSkipped: true,
          answeredAt: new Date()
        });

        player.questionsAnswered = (player.questionsAnswered || 0) + 1;
        await game.save();

        // Broadcast update
        const gameStateUpdate = {
          gameId: gameId,
          players: game.players.map(p => ({
            userId: p.user.toString(),
            score: p.score,
            correctAnswers: p.correctAnswers || 0,
            wrongAnswers: p.wrongAnswers || 0,
            questionsAnswered: p.questionsAnswered || 0
          })),
          currentQuestion: questionIndex,
          timeRemaining: Math.max(0, GAME_DURATION - elapsed)
        };

        io.to(`rapidfire-${gameId}`).emit('rapidfire-live-update', gameStateUpdate);
        socket.emit('question-skipped', { questionIndex, newScore: player.score });

        // Check if game should end
        const allPlayersFinished = game.players.every(p => p.questionsAnswered >= TOTAL_QUESTIONS);
        if (allPlayersFinished) {
          if (gameState.timer) clearTimeout(gameState.timer);
          if (gameState.updateTimer) clearInterval(gameState.updateTimer);
          await endRapidFireGame(gameId, io);
        }

      } catch (error) {
        console.error('❌ BULLETPROOF: Error in skip-rapidfire-question:', error);
        socket.emit('error', { message: 'Failed to skip question' });
      }
    });

    // Handle game timeout
    socket.on('rapidfire-game-timeout', async (gameId) => {
      try {
        console.log('⏰ BULLETPROOF: Game timeout received from frontend:', gameId);
        await endRapidFireGame(gameId, io);
      } catch (error) {
        console.error('❌ BULLETPROOF: Error handling game timeout:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log("🔌 RapidFire User disconnected:", socket.id, "Reason:", reason, "User:", socket.userId);
      if (socket.rapidFireGameId) {
        socket.to(`rapidfire-${socket.rapidFireGameId}`).emit('player-disconnected', {
          playerId: socket.userId
        });
      }
    });
  });
};
