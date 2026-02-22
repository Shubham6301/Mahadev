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

// BULLETPROOF: Calculate Elo rating changes (like Chess.com)
const calculateEloRatingChange = (playerRating, opponentRating, result, kFactor = 32) => {
  // result: 1 for win, 0 for loss, 0.5 for draw
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const ratingChange = Math.round(kFactor * (result - expectedScore));
  return ratingChange;
};

// BULLETPROOF: End game function with atomic database operations
const endRapidFireGame = async (gameId, io) => {
  try {
    console.log('🏁 BULLETPROOF: Ending rapid fire game:', gameId);

    const game = await RapidFireGame.findById(gameId)
      .populate('players.user', 'username profile.avatar ratings.rapidFireRating stats recentGameForm rapidFireHistory');

    if (!game) {
      console.error('❌ Game not found for ending:', gameId);
      return;
    }

    // Mark game as finished
    game.status = 'finished';
    game.endTime = new Date();

    // Sort players by score
    const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
    
    // Determine winner
    if (sortedPlayers.length >= 2) {
      const topScore = sortedPlayers[0].score;
      const isDraw = sortedPlayers[0].score === sortedPlayers[1].score;
      
      sortedPlayers.forEach((player, index) => {
        player.rank = isDraw ? 1 : index + 1;
      });
      
      if (!isDraw) {
        game.winner = sortedPlayers[0].user._id;
        game.result = 'win';
      } else {
        game.result = 'draw';
      }
    }

    // Calculate rating changes and update user stats
    const ratingUpdates = [];
    
    if (sortedPlayers.length === 2) {
      const [player1, player2] = sortedPlayers;
      const isDraw = player1.score === player2.score;
      
      // Store ranks
      player1.rank = 1;
      player2.rank = isDraw ? 1 : 2;
      
      // Get old ratings
      const player1OldRating = player1.user.ratings?.rapidFireRating || 1200;
      const player2OldRating = player2.user.ratings?.rapidFireRating || 1200;
      
      // Store old ratings in game
      player1.ratingBefore = player1OldRating;
      player2.ratingBefore = player2OldRating;
      
      // Determine results (W/L/D)
      const player1Result = isDraw ? 'D' : (player1.score > player2.score ? 'W' : 'L');
      const player2Result = isDraw ? 'D' : (player2.score > player1.score ? 'W' : 'L');
      
      // Calculate rating changes
      const player1Change = calculateEloRatingChange(
        player1OldRating, 
        player2OldRating, 
        isDraw ? 0.5 : (player1Result === 'W' ? 1 : 0),
        32
      );
      const player2Change = calculateEloRatingChange(
        player2OldRating, 
        player1OldRating, 
        isDraw ? 0.5 : (player2Result === 'W' ? 1 : 0),
        32
      );
      
      // Update player 1 with atomic operations
      if (player1.user._id) {
        const newRating = Math.max(100, player1OldRating + player1Change);
        player1.ratingAfter = newRating;
        player1.ratingChange = player1Change;

        // Atomic update to avoid version conflicts
        await User.findByIdAndUpdate(
          player1.user._id,
          {
            $set: {
              'ratings.rapidFireRating': newRating
            },
            $inc: {
              'stats.rapidFireGamesPlayed': 1,
              'stats.rapidFireGamesWon': player1Result === 'W' ? 1 : 0,
              'stats.rapidFireGamesLost': player1Result === 'L' ? 1 : 0,
              'stats.rapidFireGamesTied': player1Result === 'D' ? 1 : 0
            },
            $push: {
              recentGameForm: {
                $each: [{
                  gameType: 'rapidfire',
                  result: player1Result,
                  date: new Date(),
                  gameId: gameId,
                  opponentId: player2.user._id,
                  score: player1.score,
                  opponentScore: player2.score,
                  ratingChange: player1Change
                }],
                $position: 0,
                $slice: -10 // Keep only last 10 games
              }
            },
            $addToSet: {
              rapidFireHistory: {
                gameId: gameId,
                result: player1Result,
                date: new Date(),
                opponentId: player2.user._id,
                opponentUsername: player2.user.username,
                score: player1.score,
                opponentScore: player2.score,
                ratingChange: player1Change
              }
            }
          },
          { new: true }
        );

        ratingUpdates.push({
          userId: player1.user._id,
          username: player1.user.username,
          oldRating: player1OldRating,
          newRating: newRating,
          change: player1Change,
          result: player1Result,
          rank: player1.rank
        });
      }
      
      // Update player 2 with atomic operations
      if (player2.user._id) {
        const newRating = Math.max(100, player2OldRating + player2Change);
        player2.ratingAfter = newRating;
        player2.ratingChange = player2Change;

        // Atomic update to avoid version conflicts
        await User.findByIdAndUpdate(
          player2.user._id,
          {
            $set: {
              'ratings.rapidFireRating': newRating
            },
            $inc: {
              'stats.rapidFireGamesPlayed': 1,
              'stats.rapidFireGamesWon': player2Result === 'W' ? 1 : 0,
              'stats.rapidFireGamesLost': player2Result === 'L' ? 1 : 0,
              'stats.rapidFireGamesTied': player2Result === 'D' ? 1 : 0
            },
            $push: {
              recentGameForm: {
                $each: [{
                  gameType: 'rapidfire',
                  result: player2Result,
                  date: new Date(),
                  gameId: gameId,
                  opponentId: player1.user._id,
                  score: player2.score,
                  opponentScore: player1.score,
                  ratingChange: player2Change
                }],
                $position: 0,
                $slice: -10 // Keep only last 10 games
              }
            },
            $addToSet: {
              rapidFireHistory: {
                gameId: gameId,
                result: player2Result,
                date: new Date(),
                opponentId: player1.user._id,
                opponentUsername: player1.user.username,
                score: player2.score,
                opponentScore: player1.score,
                ratingChange: player2Change
              }
            }
          },
          { new: true }
        );

        ratingUpdates.push({
          userId: player2.user._id,
          username: player2.user.username,
          oldRating: player2OldRating,
          newRating: newRating,
          change: player2Change,
          result: player2Result,
          rank: player2.rank
        });
      }

      console.log('🏆 BULLETPROOF: Rating changes applied:', ratingUpdates);
    }

    await game.save();

    // Format results for frontend
    const gameResults = sortedPlayers.map(p => ({
      userId: p.user._id,
      username: p.user.username,
      avatar: p.user.profile?.avatar,
      score: p.score,
      correctAnswers: p.correctAnswers || 0,
      wrongAnswers: p.wrongAnswers || 0,
      questionsAnswered: p.questionsAnswered || 0,
      rank: p.rank,
      result: p.rank === 1 ? (game.result === 'draw' ? 'draw' : 'win') : 'loss',
      oldRating: p.ratingBefore || 1200,
      newRating: p.ratingAfter || p.ratingBefore || 1200,
      ratingChange: p.ratingChange || 0
    }));

    // Emit game finished event
    io.to(`rapidfire-${gameId}`).emit('rapidfire-game-finished', {
      gameId,
      result: game.result,
      winner: game.winner,
      finalScores: gameResults,
      ratingUpdates,
      gameDetails: {
        totalQuestions: game.totalQuestions,
        duration: game.timeLimit,
        gameResult: game.result,
        winner: game.winner,
        isDraw: game.result === 'draw'
      }
    });

    // Also emit the newer format expected by frontend
    io.to(`rapidfire-${gameId}`).emit('rapidfire-game-ended', {
      results: gameResults,
      ratingUpdates: ratingUpdates.map(update => ({
        ...update,
        userId: update.userId.toString()
      })),
      gameId,
      gameDetails: {
        totalQuestions: game.totalQuestions,
        duration: game.timeLimit,
        gameResult: game.result,
        winner: game.winner,
        isDraw: game.result === 'draw'
      }
    });

    // Clean up active game
    const activeGame = activeRapidFireGames.get(gameId);
    if (activeGame?.timer) {
      clearTimeout(activeGame.timer);
    }
    if (activeGame?.updateTimer) {
      clearInterval(activeGame.updateTimer);
    }
    if (activeGame?.timerSyncInterval) {
      clearInterval(activeGame.timerSyncInterval);
    }
    activeRapidFireGames.delete(gameId);

    console.log('✅ BULLETPROOF: Rapid fire game ended successfully with atomic stats updates');

  } catch (error) {
    console.error('❌ BULLETPROOF: Error ending rapid fire game:', error);
  }
};

const setupRapidFireSocket = (io) => {
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

        // Get basic game data (WITHOUT questionSet population)
        const gameData = await RapidFireGame.findById(gameId)
          .populate('players.user', 'username profile.avatar ratings.rapidFireRating')
          .lean();

        if (!gameData) {
          socket.emit('error', { message: 'Rapid fire game not found' });
          return;
        }

        // Fetch questions
        const questions = await fetchQuestionsForGame(gameData.questionSet);
        
        if (questions.length === 0) {
          console.error('❌ BULLETPROOF: No valid questions found for game:', gameId);
          socket.emit('error', { message: 'No questions available for this game' });
          return;
        }

        console.log('✅ BULLETPROOF: Questions loaded for game:', questions.length);

        // Join game room
        socket.join(`rapidfire-${gameId}`);
        socket.rapidFireGameId = gameId;

        console.log('🔗 BULLETPROOF: User joined rapid fire room:', `rapidfire-${gameId}`);

        // Store questions in memory for this game session
        activeRapidFireGames.set(gameId, {
          questions: questions,
          gameData: gameData,
          startTime: new Date(),
          timer: null
        });

        // Send initial game state to the connecting user
        socket.emit('rapidfire-game-state', {
          ...gameData,
          questionSet: questions
        });

        console.log('✅ BULLETPROOF: Rapid fire game state sent to user');

        // Notify all other players in the room that this user joined
        socket.to(`rapidfire-${gameId}`).emit('rapidfire-player-joined', {
          game: {
            ...gameData,
            questionSet: questions
          },
          newPlayer: {
            user: {
              _id: socket.userId,
              username: socket.username || 'Unknown Player'
            }
          }
        });

        console.log('✅ BULLETPROOF: Player joined notification sent to other players');

        // If 2 players and game should start, start the 120-second timer
        if (gameData.players.length === 2 && gameData.status === 'waiting') {
          console.log('🚀 BULLETPROOF: Starting rapid fire game with 2 players - 120 second timer');
          
          // Update game status in database
          await RapidFireGame.findByIdAndUpdate(gameId, {
            status: 'ongoing',
            startTime: new Date()
          });

          // Start 120-second game timer
          const gameTimer = setTimeout(async () => {
            console.log(`⏰ BULLETPROOF: 120-second timer expired, ending game`);
            await endRapidFireGame(gameId, io);
          }, GAME_DURATION * 1000);
          
          // Store game state with timer
          activeRapidFireGames.set(gameId, {
            timer: gameTimer,
            startTime: new Date(),
            questions: questions,
            duration: GAME_DURATION,
            totalQuestions: TOTAL_QUESTIONS
          });

          // Emit game started event to all players
          io.to(`rapidfire-${gameId}`).emit('rapidfire-game-started', {
            ...gameData,
            questionSet: questions,
            status: 'ongoing',
            startTime: new Date(),
            duration: GAME_DURATION,
            totalQuestions: TOTAL_QUESTIONS
          });

          // CRITICAL FIX: Enhanced timer synchronization (every 1 second)
          const timerSyncInterval = setInterval(async () => {
            const gameState = activeRapidFireGames.get(gameId);
            if (gameState) {
              const elapsed = Math.floor((Date.now() - gameState.startTime.getTime()) / 1000);
              const remaining = Math.max(0, GAME_DURATION - elapsed);
              
              if (remaining > 0) {
                // Send precise timer sync to prevent 2-second lag
                io.to(`rapidfire-${gameId}`).emit('rapidfire-timer-sync', { 
                  gameId: gameId,
                  timeRemaining: remaining,
                  serverTime: Date.now()
                });
              } else {
                // Timer reached zero - end the game immediately
                console.log('⏰ CRITICAL: Timer reached zero in sync interval, ending game immediately');
                clearInterval(timerSyncInterval);
                clearInterval(gameState.updateTimer);
                clearTimeout(gameState.timer);
                await endRapidFireGame(gameId, io);
              }
            } else {
              clearInterval(timerSyncInterval);
            }
          }, 1000);
          
          // CRITICAL FIX: Enhanced game state updates with all player data (every 2 seconds)
          const updateTimer = setInterval(async () => {
            const gameState = activeRapidFireGames.get(gameId);
            if (gameState) {
              const elapsed = Math.floor((Date.now() - gameState.startTime.getTime()) / 1000);
              const remaining = Math.max(0, GAME_DURATION - elapsed);
              
              if (remaining > 0) {
                try {
                  // Get fresh game data from database for accurate player stats
                  const freshGame = await RapidFireGame.findById(gameId)
                    .populate('players.user', 'username profile.avatar ratings.rapidFireRating');
                  
                  if (freshGame) {
                    // CRITICAL FIX: Send complete player data to ALL clients
                    io.to(`rapidfire-${gameId}`).emit('rapidfire-live-update', { 
                      gameId: gameId,
                      timeRemaining: remaining,
                      players: freshGame.players.map(p => ({
                        userId: p.user._id.toString(),
                        username: p.user.username,
                        score: p.score || 0,
                        correctAnswers: p.correctAnswers || 0,
                        wrongAnswers: p.wrongAnswers || 0,
                        questionsAnswered: p.questionsAnswered || 0
                      }))
                    });
                  }
                } catch (dbError) {
                  console.error('❌ Error fetching fresh game data:', dbError);
                }
              } else {
                // Timer reached zero in live update - end the game
                console.log('⏰ CRITICAL: Timer reached zero in live update, ending game immediately');
                clearInterval(updateTimer);
                clearInterval(gameState.timerSyncInterval);
                clearTimeout(gameState.timer);
                await endRapidFireGame(gameId, io);
              }
            } else {
              clearInterval(updateTimer);
            }
          }, 2000);
          
          // Store timer references
          const gameState = activeRapidFireGames.get(gameId);
          if (gameState) {
            gameState.updateTimer = updateTimer;
            gameState.timerSyncInterval = timerSyncInterval;
            activeRapidFireGames.set(gameId, gameState);
          }
        }

      } catch (error) {
        console.error('❌ BULLETPROOF: Error in join-rapidfire-game:', error);
        socket.emit('error', { message: 'Failed to join rapid fire game' });
      }
    });

    // BULLETPROOF: Submit answer - Independent user states
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

        // Check if player has already answered this question
        const player = game.players[playerIndex];
        const alreadyAnswered = player.answers.some(answer => answer.questionIndex === questionIndex);
        
        if (alreadyAnswered) {
          console.log('⚠️ BULLETPROOF: Player already answered this question');
          socket.emit('error', { message: 'Already answered this question' });
          return;
        }

        // Get questions from memory
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
          player.score -= 0.25; // NEGATIVE MARKING (-0.25 for wrong answer)
          player.wrongAnswers = (player.wrongAnswers || 0) + 1;
        }
        
        player.questionsAnswered = (player.questionsAnswered || 0) + 1;
        
        // Store answer with question index for independent tracking
        player.answers.push({
          questionId: question._id,
          questionIndex: questionIndex,
          selectedOption,
          isCorrect,
          answeredAt: new Date()
        });

        console.log('🔍 BULLETPROOF: Updated player stats:', {
          playerId: socket.userId,
          score: player.score,
          correctAnswers: player.correctAnswers,
          wrongAnswers: player.wrongAnswers,
          questionsAnswered: player.questionsAnswered
        });

        await game.save();

        // Emit live game state update to ALL players
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

        // Send to ALL players in the game room
        io.to(`rapidfire-${gameId}`).emit('rapidfire-live-update', gameStateUpdate);

        // Send answer result to the specific player
        socket.emit('answer-result', {
          questionIndex,
          isCorrect,
          correctAnswer: question.options.findIndex(opt => opt.isCorrect),
          explanation: question.explanation,
          newScore: player.score
        });

        // Auto-advance to next question after a short delay (2.5 seconds)
        if (player.questionsAnswered < TOTAL_QUESTIONS) {
          setTimeout(() => {
            const nextQuestionIndex = questionIndex + 1;
            if (nextQuestionIndex < TOTAL_QUESTIONS && gameState && gameState.questions[nextQuestionIndex]) {
              socket.emit('rapidfire-next-question', {
                questionIndex: nextQuestionIndex,
                question: gameState.questions[nextQuestionIndex],
                timeRemaining: Math.max(0, GAME_DURATION - Math.floor((Date.now() - gameState.startTime.getTime()) / 1000))
              });
              console.log(`🚀 BULLETPROOF: Sending next question ${nextQuestionIndex} to player ${socket.userId}`);
            }
          }, 2500);
        }

        // Check if this player has completed all questions
        if (player.questionsAnswered >= TOTAL_QUESTIONS) {
          console.log(`🏁 BULLETPROOF: Player ${socket.userId} completed all questions`);
          
          socket.emit('rapidfire-player-completed', {
            message: 'You have completed all questions! Waiting for opponent...',
            questionsAnswered: player.questionsAnswered,
            finalScore: player.score
          });
          
          const opponent = game.players.find(p => p.user.toString() !== socket.userId);
          if (opponent && opponent.questionsAnswered < TOTAL_QUESTIONS) {
            io.to(`rapidfire-${gameId}`).emit('rapidfire-opponent-status', {
              message: `${game.players.find(p => p.user.toString() === socket.userId)?.user?.username || 'Opponent'} has completed all questions!`,
              completedPlayer: {
                username: game.players.find(p => p.user.toString() === socket.userId)?.user?.username,
                score: player.score,
                questionsAnswered: player.questionsAnswered
              }
            });
          }
        }

        // Check if both players have completed all questions
        const allPlayersFinished = game.players.every(p => p.questionsAnswered >= TOTAL_QUESTIONS);
        
        if (allPlayersFinished) {
          console.log('🏁 BULLETPROOF: All players finished, ending game immediately');
          if (gameState.timer) clearTimeout(gameState.timer);
          if (gameState.updateTimer) clearInterval(gameState.updateTimer);
          await endRapidFireGame(gameId, io);
        }

      } catch (error) {
        console.error('❌ BULLETPROOF: Error in submit-rapidfire-answer:', error);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    // BULLETPROOF: Skip question handler
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
          console.log('⚠️ BULLETPROOF: Player already processed this question');
          socket.emit('error', { message: 'Question already answered or skipped' });
          return;
        }

        // Record the skip
        player.answers.push({
          questionId: gameState.questions[questionIndex]._id,
          questionIndex: questionIndex,
          selectedOption: -1,
          isCorrect: false,
          isSkipped: true,
          answeredAt: new Date()
        });

        player.questionsAnswered = (player.questionsAnswered || 0) + 1;

        console.log('⏭️ BULLETPROOF: Question skipped, no score change:', {
          playerId: socket.userId,
          questionIndex,
          questionsAnswered: player.questionsAnswered
        });

        await game.save();

        // Emit live game state update to ALL players
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

        socket.emit('question-skipped', {
          questionIndex,
          newScore: player.score
        });

        // Auto-advance to next question after a short delay (1.5 seconds)
        if (player.questionsAnswered < TOTAL_QUESTIONS) {
          setTimeout(() => {
            const nextQuestionIndex = questionIndex + 1;
            if (nextQuestionIndex < TOTAL_QUESTIONS && gameState && gameState.questions[nextQuestionIndex]) {
              socket.emit('rapidfire-next-question', {
                questionIndex: nextQuestionIndex,
                question: gameState.questions[nextQuestionIndex],
                timeRemaining: Math.max(0, GAME_DURATION - Math.floor((Date.now() - gameState.startTime.getTime()) / 1000))
              });
              console.log(`🚀 BULLETPROOF: Sending next question ${nextQuestionIndex} to player ${socket.userId} after skip`);
            }
          }, 1500);
        }

        // Check if this player has completed all questions after skip
        if (player.questionsAnswered >= TOTAL_QUESTIONS) {
          console.log(`🏁 BULLETPROOF: Player ${socket.userId} completed all questions via skip`);
          
          socket.emit('rapidfire-player-completed', {
            message: 'You have completed all questions! Waiting for opponent...',
            questionsAnswered: player.questionsAnswered,
            finalScore: player.score
          });
          
          const opponent = game.players.find(p => p.user.toString() !== socket.userId);
          if (opponent && opponent.questionsAnswered < TOTAL_QUESTIONS) {
            io.to(`rapidfire-${gameId}`).emit('rapidfire-opponent-status', {
              message: `${game.players.find(p => p.user.toString() === socket.userId)?.user?.username || 'Opponent'} has completed all questions!`,
              completedPlayer: {
                username: game.players.find(p => p.user.toString() === socket.userId)?.user?.username,
                score: player.score,
                questionsAnswered: player.questionsAnswered
              }
            });
          }
        }

        // Check if both players have completed all questions
        const allPlayersFinished = game.players.every(p => p.questionsAnswered >= TOTAL_QUESTIONS);
        
        if (allPlayersFinished) {
          console.log('🏁 BULLETPROOF: All players finished, ending game immediately');
          if (gameState.timer) clearTimeout(gameState.timer);
          if (gameState.updateTimer) clearInterval(gameState.updateTimer);
          await endRapidFireGame(gameId, io);
        }

      } catch (error) {
        console.error('❌ BULLETPROOF: Error in skip-rapidfire-question:', error);
        socket.emit('error', { message: 'Failed to skip question' });
      }
    });

    // CRITICAL FIX: Handle frontend timeout event
    socket.on('rapidfire-game-timeout', async (gameId) => {
      try {
        console.log('⏰ CRITICAL: Frontend reported game timeout for game:', gameId);
        
        if (gameId) {
          const gameState = activeRapidFireGames.get(gameId);
          if (gameState) {
            if (gameState.timer) clearTimeout(gameState.timer);
            if (gameState.updateTimer) clearInterval(gameState.updateTimer);
            if (gameState.timerSyncInterval) clearInterval(gameState.timerSyncInterval);
          }
          
          await endRapidFireGame(gameId, io);
        }
      } catch (error) {
        console.error('❌ BULLETPROOF: Error in rapidfire-game-timeout:', error);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log("🔌 RapidFire User disconnected:", socket.id, "Reason:", reason, "User:", socket.userId);
    });
  });
};

export { setupRapidFireSocket };