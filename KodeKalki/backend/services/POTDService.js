import Problem from '../models/Problem.js';
import ProblemOfTheDay from '../models/ProblemOfTheDay.js';

class POTDService {
  // Get today's Problem of the Day
  static async getTodaysPOTD() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      let potd = await ProblemOfTheDay.findOne({
        date: today,
        isActive: true
      }).populate('problem');
      
      if (!potd) {
        // Generate new POTD for today
        potd = await this.generateNewPOTD(today);
      }
      
      return potd;
    } catch (error) {
      console.error('Error getting today\'s POTD:', error);
      throw error;
    }
  }
  
  // Generate new Problem of the Day
  static async generateNewPOTD(date = new Date()) {
    try {
      date.setHours(0, 0, 0, 0);
      
      // Get all problems that have ever been used as POTD
      const allPOTDs = await ProblemOfTheDay.find({}).select('problem');
      const usedProblemIds = allPOTDs.map(potd => potd.problem);
      
      // Get problems that have NEVER been used
      const neverUsedProblems = await Problem.find({
        _id: { $nin: usedProblemIds }
      });
      
      // If there are problems that have never been used, prioritize them
      if (neverUsedProblems.length > 0) {
        const randomProblem = neverUsedProblems[Math.floor(Math.random() * neverUsedProblems.length)];
        
        const newPOTD = new ProblemOfTheDay({
          problem: randomProblem._id,
          date: date
        });
        
        await newPOTD.save();
        return await ProblemOfTheDay.findById(newPOTD._id).populate('problem');
      }
      
      // All problems have been used at least once, now avoid last 30 days
      const recentPOTDs = await ProblemOfTheDay.find({
        date: { $gte: new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000) }
      }).select('problem');
      
      const recentProblemIds = recentPOTDs.map(potd => potd.problem);
      
      // Get problems not used in last 30 days
      const availableProblems = await Problem.find({
        _id: { $nin: recentProblemIds }
      });
      
      if (availableProblems.length === 0) {
        // If all problems used in last 30 days, just get any problem
        const allProblems = await Problem.find({});
        if (allProblems.length === 0) {
          throw new Error('No problems available in database');
        }
        const randomProblem = allProblems[Math.floor(Math.random() * allProblems.length)];
        
        const newPOTD = new ProblemOfTheDay({
          problem: randomProblem._id,
          date: date
        });
        
        await newPOTD.save();
        return await ProblemOfTheDay.findById(newPOTD._id).populate('problem');
      }
      
      // Select random problem from available ones
      const randomProblem = availableProblems[Math.floor(Math.random() * availableProblems.length)];
      
      const newPOTD = new ProblemOfTheDay({
        problem: randomProblem._id,
        date: date
      });
      
      await newPOTD.save();
      return await ProblemOfTheDay.findById(newPOTD._id).populate('problem');
      
    } catch (error) {
      console.error('Error generating new POTD:', error);
      throw error;
    }
  }
  
  // Check if user has solved today's POTD
  static async hasUserSolvedTodaysPOTD(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const User = (await import('../models/User.js')).default;
    
    try {
      const user = await User.findById(userId);
      if (!user) return false;
      
      const todaysSolved = user.solvedPOTD.find(solved => {
        const solvedDate = new Date(solved.date);
        solvedDate.setHours(0, 0, 0, 0);
        return solvedDate.getTime() === today.getTime();
      });
      
      return !!todaysSolved;
    } catch (error) {
      console.error('Error checking user POTD status:', error);
      return false;
    }
  }
  
  // Award coins for solving POTD
 static async awardPOTDCoins(userId, problemId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const User = (await import('../models/User.js')).default;
  
  try {
    // Verify this is actually today's POTD
    const todaysPOTD = await this.getTodaysPOTD();
    if (!todaysPOTD || todaysPOTD.problem._id.toString() !== problemId.toString()) {
      return { awarded: false, reason: 'Not today\'s POTD' };
    }

    // Check if user already solved today's POTD
    const hasAlreadySolved = await this.hasUserSolvedTodaysPOTD(userId);
    if (hasAlreadySolved) {
      return { awarded: false, reason: 'Already solved today\'s POTD' };
    }

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // **NEW: Update streak logic**
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastSolvedPOTD = user.solvedPOTD.length > 0 
      ? user.solvedPOTD[user.solvedPOTD.length - 1] 
      : null;
    
    let newStreak = 1;
    if (lastSolvedPOTD) {
      const lastDate = new Date(lastSolvedPOTD.date);
      lastDate.setHours(0, 0, 0, 0);
      
      // Continue streak if solved yesterday
      if (lastDate.getTime() === yesterday.getTime()) {
        newStreak = (user.currentStreak || 0) + 1;
      }
    }
    
    // Update user with coins, solvedPOTD, AND streak
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { coins: 10 },
        $push: {
          solvedPOTD: {
            problemId: problemId,
            date: today,
            coinsEarned: 10
          }
        },
        // **NEW: Update streak fields**
        $set: {
          currentStreak: newStreak,
          maxStreak: Math.max(user.maxStreak || 0, newStreak),
          lastPOTDDate: today
        }
      },
      { new: true }
    );

    // Update POTD solved count
    await ProblemOfTheDay.findOneAndUpdate(
      { problem: problemId, date: today },
      { $inc: { solvedCount: 1 } }
    );

    return { 
      awarded: true, 
      coinsEarned: 10, 
      totalCoins: updatedUser.coins,
      streak: newStreak,
      reason: 'POTD solved successfully!'
    };
  } catch (error) {
    console.error('Error awarding POTD coins:', error);
    throw error;
  }
}
}
export default POTDService;